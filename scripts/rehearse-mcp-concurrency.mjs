// Optional real PostgreSQL rehearsal. Uses disposable npm runtime packages,
// synthetic Auth tables/accounts and a new loopback-only temporary cluster.
// Never accepts a production connection string or reuses an existing cluster.
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { regressAbsentRowRaces } from "./mcp-race-regressions.mjs";
const runtime = process.env.MCP_TEST_RUNTIME || process.argv[2];
if (!runtime)
  throw new Error(
    "Set MCP_TEST_RUNTIME to a disposable directory containing embedded-postgres@17.11.0-beta.19 and pg@8.23.1.",
  );
const require = createRequire(join(resolve(runtime), "package.json"));
const EmbeddedPostgres = require("embedded-postgres").default;
const { Client } = require("pg");
const dir = await mkdtemp(join(tmpdir(), "horizon-mcp-pg-"));
const port = 55439;
const password = crypto.randomUUID();
const cluster = new EmbeddedPostgres({
  databaseDir: join(dir, "db"),
  user: "postgres",
  password,
  port,
  persistent: true,
  autoRehydrateSymlinks: true,
  createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
const clients = [];
const connect = async () => {
  const c = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
  });
  await c.connect();
  clients.push(c);
  return c;
};
try {
  await cluster.initialise();
  // Force loopback in the actual server config, independent of package defaults.
  await writeFile(
    join(dir, "db", "postgresql.auto.conf"),
    "listen_addresses = '127.0.0.1'\n",
  );
  await cluster.start();
  const admin = await connect(),
    a = await connect(),
    b = await connect();
  await admin.query(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;
    create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
    create table public.website_enquiries(id uuid primary key,created_at timestamptz not null default now(),name text not null,email text not null,
      phone text,preferred_contact text not null,event_date date,venue text,area text,message text,email_status text not null default 'pending',payload_hash text not null);
    alter table public.website_enquiries enable row level security;revoke all on public.website_enquiries from public,anon,authenticated;`);
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of (await readdir(migrationDir))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await admin.query(await readFile(new URL(f, migrationDir), "utf8"));
  const owner = crypto.randomUUID(),
    session = crypto.randomUUID(),
    id = crypto.randomUUID();
  await admin.query("insert into auth.users values($1)", [owner]);
  await admin.query("insert into auth.sessions values($1,$2,null)", [
    session,
    owner,
  ]);
  await admin.query(
    "insert into public.hs_owners values($1,'Synthetic concurrency owner')",
    [owner],
  );
  await admin.query(
    "insert into public.hs_mcp_clients(client_id,user_id,label,resource_url,enabled,write_enabled,write_consent_version,write_consented_at) values('synthetic-client',$1,'Synthetic','https://horizon.example/mcp',true,true,'operational-v1',now())",
    [owner],
  );
  await admin.query("update hs_mcp_private.control set writes_enabled=true");
  const claims = {
    sub: owner,
    role: "authenticated",
    client_id: "synthetic-client",
    aud: "https://horizon.example/mcp",
    session_id: session,
  };
  for (const c of [a, b]) {
    await c.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(claims),
    ]);
    await c.query("set role authenticated");
  }
  const command = (operation, expectedRevision, data) => ({
    operation,
    id,
    expectedRevision,
    data,
    requestId: crypto.randomUUID(),
  });
  const mutate = async (c, cmd) =>
    (
      await c.query("select public.hs_mcp_mutate($1::jsonb) result", [
        JSON.stringify(cmd),
      ])
    ).rows[0].result;
  await mutate(
    a,
    command("create_event", 0, { name: "Synthetic concurrency" }),
  );
  // Hold A's transaction open after its successful write; B must wait on the
  // event row and then reject its original expected revision after A commits.
  await a.query("begin");
  const first = await mutate(
    a,
    command("update_event", 1, { notes: "First editor" }),
  );
  let settled = false;
  const waiting = mutate(
    b,
    command("update_event", 1, { notes: "Stale concurrent editor" }),
  ).then(
    (v) => {
      settled = true;
      return { value: v };
    },
    (e) => {
      settled = true;
      return { error: e.code };
    },
  );
  const blocked = await admin.query(
    "select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock'",
  );
  if (blocked.rows[0].n === 0) {
    // Wait on the actual server condition rather than relying on a timing-only assertion.
    for (let i = 0; i < 100; i++) {
      const s = await admin.query(
        "select count(*)::int n from pg_stat_activity where wait_event_type='Lock'",
      );
      if (s.rows[0].n > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  assert.equal(settled, false);
  assert.ok(
    (
      await admin.query(
        "select count(*)::int n from pg_stat_activity where wait_event_type='Lock'",
      )
    ).rows[0].n > 0,
  );
  await a.query("commit");
  assert.equal((await waiting).error, "40001");
  // Same request ID: B waits for A's receipt transaction, then returns the same
  // original result without another revision or activity row.
  const retry = command("update_event", first.revision, {
    notes: "Single effect across sessions",
  });
  await a.query("begin");
  const original = await mutate(a, retry);
  const duplicate = mutate(b, retry);
  await a.query("commit");
  assert.deepEqual(await duplicate, original);
  const evidence = await admin.query(
    "select (select revision from public.hs_events where id=$1) revision,(select count(*)::int from hs_mcp_private.receipts where request_id=$2) receipts,(select count(*)::int from hs_mcp_private.activity where request_id=$2) activity",
    [id, retry.requestId],
  );
  assert.deepEqual(evidence.rows[0], { revision: 3, receipts: 1, activity: 1 });
  await assert.rejects(
    mutate(b, { ...retry, data: { notes: "Changed retry" } }),
    (e) => e.code === "22023",
  );
  const raceRegressions = await regressAbsentRowRaces({
    admin,
    a,
    b,
    claims,
    mutate,
  });
  console.log(
    JSON.stringify({
      postgres: (await admin.query("show server_version")).rows[0]
        .server_version,
      staleConcurrentEdit: "40001 after real row-lock wait",
      concurrentIdenticalRetry: "same result; one revision/receipt/activity",
      changedRetry: "22023",
      raceRegressions,
      data: "synthetic only",
      clusterStoppedOnExit: true,
    }),
  );
} finally {
  for (const c of clients) await c.end().catch(() => {});
  await cluster.stop();
  // Preserve this synthetic cluster for inspection; no recursive filesystem deletion.
}
