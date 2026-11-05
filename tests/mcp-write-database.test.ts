import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { newEvent, eventSchema, defaultSettings } from "../lib/model";
import { HorizonService } from "../lib/mcp/service";
import { contractSql, migration } from "../scripts/generate-mcp-write-contract";
import { writeInputs, type WriteOperation } from "../lib/mcp/commands";
import type { SupabaseClient } from "@supabase/supabase-js";
const owner = crypto.randomUUID(),
  session = crypto.randomUUID();
const client = "synthetic-existing-client",
  resource = "https://horizon.example/mcp";
const claims = {
  sub: owner,
  role: "authenticated",
  client_id: client,
  aud: resource,
  session_id: session,
};
const day = "2026-09-18";
const cmd = (
  operation: string,
  id: string,
  expectedRevision: number,
  data: unknown,
) => ({
  operation,
  id,
  expectedRevision,
  data,
  requestId: crypto.randomUUID(),
});
async function setup(includeWrites = true) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;
    create table public.website_enquiries(id uuid primary key,created_at timestamptz not null default now(),name text not null,
      email text not null,phone text,preferred_contact text not null,event_date date,venue text,area text,message text,
      email_status text not null default 'pending',payload_hash text not null);
    alter table public.website_enquiries enable row level security; revoke all on public.website_enquiries from public,anon,authenticated;`);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(dir))
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        (includeWrites || !f.endsWith("authenticated_mcp_writes.sql")),
    )
    .sort())
    await db.exec(await readFile(new URL(file, dir), "utf8"));
  await db.query("insert into auth.users values($1)", [owner]);
  await db.query("insert into auth.sessions values($1,$2,null)", [
    session,
    owner,
  ]);
  await db.query("insert into public.hs_owners values($1,'Synthetic owner')", [
    owner,
  ]);
  await db.query(
    "insert into public.hs_mcp_clients(client_id,user_id,label,resource_url,enabled) values($1,$2,'Synthetic registered client',$3,true)",
    [client, owner, resource],
  );
  await setClaims(db, claims);
  return db;
}
async function setClaims(db: PGlite, value: unknown) {
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(value),
  ]);
}
async function mutate(db: PGlite, c: unknown) {
  return (
    await db.query<{ result: any }>(
      "select public.hs_mcp_mutate($1::jsonb) as result",
      [JSON.stringify(c)],
    )
  ).rows[0].result;
}
async function enable(db: PGlite) {
  await db.exec(
    "reset role; update hs_mcp_private.control set writes_enabled=true; update public.hs_mcp_clients set write_enabled=true",
  );
  await setClaims(db, {
    ...claims,
    client_id: undefined,
    aud: "authenticated",
  });
  await db.exec("set role authenticated");
  await db.query("select public.hs_mcp_consent_write($1,true)", [client]);
  await setClaims(db, claims);
}
async function snapshot(db: PGlite) {
  await db.exec("reset role");
  const state = (
    await db.query<{ state: unknown }>(`select jsonb_build_object(
    'workspace',public.hs_mcp_read_workspace(),
    'audits',(select coalesce(jsonb_agg(a order by id),'[]') from public.hs_audit a),
    'receipts',(select coalesce(jsonb_agg(r order by request_id),'[]') from hs_mcp_private.receipts r),
    'activity',(select coalesce(jsonb_agg(a order by request_id),'[]') from hs_mcp_private.activity a)
  ) state`)
  ).rows[0].state;
  await db.exec("set role authenticated");
  return state;
}
async function rejectUnchanged(db: PGlite, c: unknown, pattern?: RegExp) {
  const before = await snapshot(db);
  if (pattern) await assert.rejects(mutate(db, c), pattern);
  else await assert.rejects(mutate(db, c));
  assert.deepEqual(
    await snapshot(db),
    before,
    "rejected write must leave complete workspace, revisions, receipts and activity unchanged",
  );
  const w = (
    await db.query<{ w: { events: unknown[] } }>(
      "select public.hs_mcp_read_workspace() w",
    )
  ).rows[0].w;
  for (const e of w.events)
    assert.equal(
      eventSchema.safeParse(e).success,
      true,
      "complete event remains readable",
    );
}
test("generated closed database command contract matches application schemas", async () => {
  assert.ok((await readFile(migration, "utf8")).includes(contractSql()));
});
test("all operations, preservation, stale revisions, retries and owner compatibility in PostgreSQL", async () => {
  const db = await setup();
  try {
    const id = crypto.randomUUID();
    await db.exec("set role authenticated");
    await rejectUnchanged(
      db,
      cmd("create_event", id, 0, { name: "Synthetic" }),
      /write access denied/,
    );
    await enable(db);
    const c = cmd("create_event", id, 0, {
      name: "Synthetic",
      operational: { timing: { ceremonyStartTime: "15:30" } },
    });
    let saved = await mutate(db, c);
    assert.equal(saved.revision, 1);
    assert.equal(eventSchema.safeParse(saved.record).success, true);
    const beforeRetry = await snapshot(db);
    assert.deepEqual(await mutate(db, c), saved);
    assert.deepEqual(await snapshot(db), beforeRetry);
    await rejectUnchanged(
      db,
      { ...c, data: { name: "changed" } },
      /bound to another command/,
    );
    await rejectUnchanged(
      db,
      cmd("update_event", id, 0, { notes: "stale" }),
      /revision changed/,
    );
    const update = cmd("update_event", id, 1, {
      notes: "Updated",
      details: {
        timing: {
          state: "Deferred",
          value: "",
          dueDate: "",
          trigger: "Final Details",
        },
      },
      milestones: { responded: day },
      operational: { logistics: { guestCount: 70 } },
    });
    saved = await mutate(db, update);
    assert.equal(saved.revision, 2);
    assert.equal(saved.record.operational.timing.ceremonyStartTime, "15:30");
    assert.equal(saved.record.operational.logistics.guestCount, 70);
    const musicianId = crypto.randomUUID(),
      pieceId = crypto.randomUUID();
    const musician = {
      name: "Synthetic violinist",
      instrument: "Violin",
      email: "player@example.com",
      phone: "",
      notes: "",
    };
    const piece = {
      title: "Synthetic piece",
      artist: "Synthetic",
      musicUrl: "https://example.com/music",
      genre: "Classical",
      weddingSuitable: "Yes",
      notes: "",
    };
    let m = await mutate(db, cmd("upsert_musician", musicianId, 0, musician));
    assert.equal(m.revision, 1);
    m = await mutate(
      db,
      cmd("upsert_musician", musicianId, 1, {
        ...musician,
        notes: "Updated directory",
      }),
    );
    assert.equal(m.revision, 2);
    let p = await mutate(db, cmd("upsert_piece", pieceId, 0, piece));
    assert.equal(p.revision, 1);
    p = await mutate(
      db,
      cmd("upsert_piece", pieceId, 1, { ...piece, notes: "Updated catalogue" }),
    );
    assert.equal(p.revision, 2);
    const items = [
      [
        "upsert_event_contact",
        {
          id: crypto.randomUUID(),
          role: "Main",
          name: "Synthetic contact",
          email: "contact@example.com",
          phone: "",
          notes: "",
        },
        "contacts",
      ],
      [
        "upsert_event_task",
        {
          id: crypto.randomUUID(),
          title: "Synthetic task",
          kind: "Task",
          dueDate: "2027-02-20",
          assignee: "Legacy assignee",
          recipient: "",
          notes: "",
          done: false,
          completedAt: "",
        },
        "tasks",
      ],
      [
        "record_event_communication",
        {
          id: crypto.randomUUID(),
          date: day,
          recipient: "Synthetic",
          summary: "Recorded only",
        },
        "communicationLog",
      ],
      [
        "upsert_event_musician",
        {
          id: crypto.randomUUID(),
          musicianId,
          name: musician.name,
          instrument: "Violin",
          confirmed: true,
          musicSent: false,
          contractRequired: true,
          signed: false,
          notes: "",
        },
        "musicians",
      ],
      [
        "upsert_event_repertoire",
        {
          id: crypto.randomUUID(),
          pieceId,
          title: piece.title,
          moment: "Ceremony",
          status: "Available",
          notes: "",
        },
        "repertoire",
      ],
    ] as const;
    for (const [op, data, collection] of items) {
      saved = await mutate(db, cmd(op, id, saved.revision, data));
      const sibling = { ...data, id: crypto.randomUUID() };
      saved = await mutate(db, cmd(op, id, saved.revision, sibling));
      saved = await mutate(db, cmd(op, id, saved.revision, data));
      assert.equal(saved.record[collection].length, 2);
      assert.equal(saved.record[collection][1].id, sibling.id);
      if (collection === "musicians") {
        assert.equal(saved.record[collection][0].fee, 0);
        assert.equal(saved.record[collection][0].paid, false);
      }
    }
    const settingsRevision = (
      await db.query<{ w: any }>("select public.hs_mcp_read_workspace() w")
    ).rows[0].w.settings.revision;
    const settings = await mutate(db, {
      operation: "update_workflow_settings",
      requestId: crypto.randomUUID(),
      expectedRevision: settingsRevision,
      data: { musiciansWeeks: 10 },
    });
    assert.equal(settings.record.musiciansWeeks, 10);
    assert.equal(settings.revision, settingsRevision + 1);
    // Ordinary owner saving must advance the same event and directory revisions.
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    const ownerEvent = { ...saved.record, notes: "Human owner edit" };
    const ownerSave = (
      await db.query<{ e: any }>("select public.hs_save_event($1::jsonb) e", [
        JSON.stringify(ownerEvent),
      ])
    ).rows[0].e;
    assert.equal(ownerSave.revision, saved.revision + 1);
    await db.query(
      "update public.hs_musicians set notes='Human update' where id=$1",
      [musicianId],
    );
    await setClaims(db, claims);
    await rejectUnchanged(
      db,
      cmd("update_event", id, saved.revision, { notes: "stale after owner" }),
      /revision changed/,
    );
    await rejectUnchanged(
      db,
      cmd("upsert_musician", musicianId, 2, musician),
      /revision changed/,
    );
    // Retain nonzero legacy assignment financial values during operational edits.
    await db.exec("reset role");
    await db.query(
      "update public.hs_event_musicians set fee=250,paid=true where id=$1",
      [items[3][1].id],
    );
    await db.exec("set role authenticated");
    saved = await mutate(
      db,
      cmd("upsert_event_musician", id, ownerSave.revision, {
        ...items[3][1],
        confirmed: false,
      }),
    );
    assert.equal(saved.record.musicians[0].fee, 250);
    assert.equal(saved.record.musicians[0].paid, true);
    assert.equal(saved.record.finance.depositRequired, 400);
  } finally {
    await db.close();
  }
});

test("malformed direct calls cannot corrupt any persisted shape or leave receipts/activity", async (t) => {
  const db = await setup();
  try {
    await enable(db);
    const id = crypto.randomUUID();
    await mutate(
      db,
      cmd("create_event", id, 0, { name: "Synthetic integrity fixture" }),
    );
    const examples: Record<WriteOperation, any> = {
      create_event: cmd("create_event", crypto.randomUUID(), 0, {
        name: "Synthetic",
        details: {
          timing: {
            state: "Deferred",
            value: "",
            dueDate: "2027-01-01",
            trigger: "",
          },
        },
        operational: {
          timing: { ceremonyStartTime: "15:30", preCeremonyMinutes: 30 },
          rehearsal: { date: "2027-01-01" },
        },
        milestones: { responded: day },
      }),
      update_event: cmd("update_event", id, 1, {
        notes: "Synthetic",
        durationMinutes: 90,
        ensemble: "Trio",
        details: {
          wetWeather: {
            state: "Filled",
            value: "Legacy structured content",
            dueDate: "",
            trigger: "",
          },
        },
        operational: { logistics: { guestCount: 50 } },
        milestones: { finalConfirmed: day },
      }),
      upsert_event_contact: cmd("upsert_event_contact", id, 1, {
        id: crypto.randomUUID(),
        role: "Main",
        name: "Synthetic",
        email: "a@example.com",
        phone: "",
        notes: "",
      }),
      upsert_event_task: cmd("upsert_event_task", id, 1, {
        id: crypto.randomUUID(),
        title: "Synthetic",
        kind: "Task",
        dueDate: "2027-01-01",
        assignee: "",
        recipient: "",
        notes: "",
        done: false,
        completedAt: "",
      }),
      record_event_communication: cmd("record_event_communication", id, 1, {
        id: crypto.randomUUID(),
        date: day,
        recipient: "Synthetic",
        summary: "Record only",
      }),
      upsert_event_musician: cmd("upsert_event_musician", id, 1, {
        id: crypto.randomUUID(),
        musicianId: "",
        name: "Synthetic",
        instrument: "Violin",
        confirmed: false,
        musicSent: false,
        contractRequired: false,
        signed: false,
        notes: "",
      }),
      upsert_event_repertoire: cmd("upsert_event_repertoire", id, 1, {
        id: crypto.randomUUID(),
        pieceId: "",
        title: "Synthetic",
        moment: "",
        status: "Requested",
        notes: "",
      }),
      upsert_musician: cmd("upsert_musician", crypto.randomUUID(), 0, {
        name: "Synthetic",
        instrument: "Violin",
        email: "",
        phone: "",
        notes: "",
      }),
      upsert_piece: cmd("upsert_piece", crypto.randomUUID(), 0, {
        title: "Synthetic",
        artist: "Synthetic",
        musicUrl: "https://example.com/music",
        genre: "Classical",
        weddingSuitable: "Yes",
        notes: "",
      }),
      update_workflow_settings: {
        operation: "update_workflow_settings",
        requestId: crypto.randomUUID(),
        expectedRevision: 1,
        data: { internalWeeks: 12, readyRequiresPayment: false },
      },
    };
    function paths(v: any, p: string[] = []): string[][] {
      return [
        p,
        ...(v && typeof v === "object" && !Array.isArray(v)
          ? Object.entries(v).flatMap(([k, x]) => paths(x, [...p, k]))
          : []),
      ];
    }
    let rejected = 0;
    for (const [operation, example] of Object.entries(examples)) {
      for (const path of paths(example))
        for (const bad of [null, [], {}, true, 42, "invalid", "2026-02-30"]) {
          const copy = structuredClone(example);
          let mutated: any = copy;
          if (path.length) {
            let parent = copy;
            for (const k of path.slice(0, -1)) parent = parent[k];
            parent[path.at(-1)!] = bad;
          } else mutated = bad;
          const input =
            mutated && typeof mutated === "object"
              ? (({ operation: _, ...rest }) => rest)(mutated)
              : mutated;
          if (
            writeInputs[operation as WriteOperation].safeParse(input).success &&
            mutated?.operation === operation
          )
            continue;
          await rejectUnchanged(db, mutated);
          rejected++;
        }
    }
    assert.ok(rejected > 500);
    t.diagnostic(
      `${rejected} malformed direct commands rejected with unchanged workspace, revisions, receipts and activity`,
    );
    const badCommands = [
      cmd("update_event", id, 1, { eventDate: "2027-02-29" }),
      cmd("update_event", id, 1, { eventDate: "0000-01-01" }),
      cmd("update_event", id, 1, { milestones: { responded: "2099-01-01" } }),
      cmd("update_event", id, 1, {
        details: {
          timing: { state: "Deferred", value: "", dueDate: "", trigger: "" },
        },
      }),
      cmd("update_event", id, 1, { finance: { performance: 1 } }),
      cmd("update_event", id, 1, { archived: true }),
      cmd("update_event", id, 1, { deletedAt: day }),
      cmd("upsert_event_musician", id, 1, {
        ...examples.upsert_event_musician.data,
        fee: 500,
      }),
      cmd("upsert_event_musician", id, 1, {
        ...examples.upsert_event_musician.data,
        paid: true,
      }),
      cmd("upsert_event_musician", id, 1, {
        ...examples.upsert_event_musician.data,
        musicianId: crypto.randomUUID(),
      }),
      cmd("upsert_event_repertoire", id, 1, {
        ...examples.upsert_event_repertoire.data,
        pieceId: crypto.randomUUID(),
      }),
      cmd("upsert_event_task", id, 1, {
        ...examples.upsert_event_task.data,
        done: true,
      }),
      cmd("upsert_event_task", id, 1, {
        ...examples.upsert_event_task.data,
        completedAt: day,
      }),
      cmd("record_event_communication", id, 1, {
        ...examples.record_event_communication.data,
        date: "2099-01-01",
      }),
      cmd("upsert_piece", crypto.randomUUID(), 0, {
        ...examples.upsert_piece.data,
        musicUrl: "javascript:alert(1)",
      }),
      cmd("update_event", id, 1, {
        operational: {
          timing: { ceremonyStartTime: "25:99", preCeremonyMinutes: -1 },
        },
      }),
      cmd("update_event", id, 1, {
        operational: { rehearsal: { date: "2026-02-30" } },
      }),
      {
        operation: "update_workflow_settings",
        requestId: crypto.randomUUID(),
        expectedRevision: 1,
        data: { internalWeeks: 0, finalWeeks: 12 },
      },
      {
        operation: "update_workflow_settings",
        requestId: crypto.randomUUID(),
        expectedRevision: 1,
        data: { responseDays: 31 },
      },
    ];
    for (const bad of badCommands) await rejectUnchanged(db, bad);
    for (const op of [
      "delete_event",
      "archive_event",
      "restore_event",
      "convert_website_enquiry",
      "send_message",
      "download_file",
      "upsert_person",
      "upsert_general_task",
    ])
      await rejectUnchanged(db, cmd(op, id, 1, { name: "Forbidden" }));
    const other = crypto.randomUUID();
    await mutate(
      db,
      cmd("create_event", other, 0, { name: "Other synthetic event" }),
    );
    const contact = examples.upsert_event_contact.data;
    await mutate(db, cmd("upsert_event_contact", other, 1, contact));
    await rejectUnchanged(
      db,
      cmd("upsert_event_contact", id, 1, contact),
      /another event/,
    );
    // Legacy fields not in today's operational form are preserved during unrelated edits.
    await db.exec("reset role");
    await db.query(
      "update public.hs_events set operational=$1::jsonb where id=$2",
      [
        JSON.stringify({
          timing: { legacyText: "Keep", ceremonyDurationMinutes: "30" },
        }),
        id,
      ],
    );
    await db.exec("set role authenticated");
    const result = await mutate(
      db,
      cmd("update_event", id, 1, { notes: "Safe unrelated edit" }),
    );
    assert.equal(result.record.operational.timing.legacyText, "Keep");
    assert.equal(
      result.record.operational.timing.ceremonyDurationMinutes,
      "30",
    );
  } finally {
    await db.close();
  }
});

test("overlapping requests, actor/client request binding, migration rehearsal and capability rollback", async () => {
  const db = await setup(false);
  try {
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    await db.exec("set role authenticated");
    const legacy = newEvent("Synthetic pre-migration event", day);
    legacy.operational.timing.legacyText = "Preserved";
    legacy.contacts.push({
      id: crypto.randomUUID(),
      role: "Main",
      name: "Synthetic",
      email: "",
      phone: "",
      notes: "Legacy",
    });
    const prior = (
      await db.query<{ e: any }>("select public.hs_save_event($1::jsonb) e", [
        JSON.stringify(legacy),
      ])
    ).rows[0].e;
    await db.exec("reset role");
    await db.exec(await readFile(migration, "utf8"));
    assert.deepEqual(
      (
        await db.query<{ e: any }>("select public.hs_get_event($1) e", [
          legacy.id,
        ])
      ).rows[0].e,
      prior,
    );
    await enable(db);
    const id = legacy.id;
    // PGlite queues overlapping calls on one connection. A hosted two-session
    // rehearsal must independently verify real row/advisory lock contention.
    const edits = await Promise.allSettled([
      mutate(
        db,
        cmd("update_event", id, prior.revision, {
          notes: "First synthetic editor",
        }),
      ),
      mutate(
        db,
        cmd("update_event", id, prior.revision, {
          notes: "Second synthetic editor",
        }),
      ),
    ]);
    assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(edits.filter((r) => r.status === "rejected").length, 1);
    const revision = prior.revision + 1;
    const retry = cmd("update_event", id, revision, {
      notes: "Retry synthetic editor",
    });
    const results = await Promise.all([
      mutate(db, retry),
      mutate(db, retry),
      mutate(db, retry),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[1], results[2]);
    assert.equal(results[0].revision, revision + 1);
    const before = await snapshot(db);
    // Another explicitly allowed actor/client cannot claim the same request ID.
    const otherOwner = crypto.randomUUID(),
      otherSession = crypto.randomUUID();
    await db.exec("reset role");
    await db.query("insert into auth.users values($1)", [otherOwner]);
    await db.query(
      "insert into public.hs_owners values($1,'Other synthetic owner')",
      [otherOwner],
    );
    await db.query("insert into auth.sessions values($1,$2,null)", [
      otherSession,
      otherOwner,
    ]);
    await db.query(
      "insert into public.hs_mcp_clients(client_id,user_id,label,resource_url,enabled,write_enabled,write_consent_version,write_consented_at) values('other-client',$1,'Other synthetic',$2,true,true,'operational-v1',now())",
      [otherOwner, resource],
    );
    await db.exec("set role authenticated");
    await setClaims(db, {
      ...claims,
      sub: otherOwner,
      session_id: otherSession,
      client_id: "other-client",
    });
    await assert.rejects(mutate(db, retry), /bound to another command/);
    await setClaims(db, claims);
    assert.deepEqual(await snapshot(db), before);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../supabase/disable-mcp-writes.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await rejectUnchanged(db, retry, /write access denied/);
    await enable(db);
    assert.deepEqual(await mutate(db, retry), results[0]);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../supabase/rollback-mcp-writes.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await rejectUnchanged(db, retry, /permission denied/);
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    const human = {
      ...results[0].record,
      notes: "Owner works after capability rollback",
    };
    assert.ok(
      (
        await db.query("select public.hs_save_event($1::jsonb)", [
          JSON.stringify(human),
        ])
      ).rows.length,
    );
    const humanWorkspace = (
      await db.query<{ w: any }>("select public.hs_load_workspace() w")
    ).rows[0].w;
    assert.ok(humanWorkspace.events.length);
    assert.ok(Array.isArray(humanWorkspace.people));
    assert.ok(Array.isArray(humanWorkspace.generalTasks));
  } finally {
    await db.close();
  }
});

test("permission gates, revocation/recovery, protected routes, retries and read side effects", async () => {
  const db = await setup();
  try {
    await enable(db);
    const id = crypto.randomUUID(),
      c = cmd("create_event", id, 0, { name: "Synthetic permissions" });
    const original = await mutate(db, c);
    for (const change of [
      "update public.hs_mcp_clients set write_enabled=false",
      "update public.hs_mcp_clients set write_consent_version=null",
      "update hs_mcp_private.control set writes_enabled=false",
    ]) {
      await db.exec(`reset role; ${change}; set role authenticated`);
      await rejectUnchanged(
        db,
        cmd("update_event", id, 1, { notes: "Denied" }),
        /write access denied/,
      );
      await rejectUnchanged(db, c, /write access denied/);
      await enable(db);
      assert.deepEqual(await mutate(db, c), original);
    }
    for (const changed of [
      { ...claims, aud: "authenticated" },
      { ...claims, client_id: "unregistered" },
      { ...claims, sub: crypto.randomUUID() },
      { ...claims, session_id: crypto.randomUUID() },
      { ...claims, is_anonymous: true },
      { ...claims, role: "anon" },
    ]) {
      const before = await snapshot(db);
      await setClaims(db, changed);
      await assert.rejects(mutate(db, c), /write access denied/);
      await assert.rejects(
        db.query("select public.hs_mcp_read_workspace()"),
        /access denied/,
      );
      await setClaims(db, claims);
      assert.deepEqual(await snapshot(db), before);
    }
    for (const change of [
      "update public.hs_mcp_clients set enabled=false",
      `delete from auth.sessions where id='${session}'`,
      `delete from public.hs_owners where user_id='${owner}'`,
      `update auth.sessions set not_after=now()-interval '1 minute' where id='${session}'`,
    ]) {
      const before = await snapshot(db);
      await db.exec(`reset role; ${change}; set role authenticated`);
      await assert.rejects(mutate(db, c), /write access denied/);
      await assert.rejects(
        db.query("select public.hs_mcp_read_workspace()"),
        /access denied/,
      );
      await db.exec(
        "reset role; update public.hs_mcp_clients set enabled=true",
      );
      await db.query(
        "insert into auth.sessions values($1,$2,null) on conflict(id) do update set not_after=null",
        [session, owner],
      );
      await db.query(
        "insert into public.hs_owners values($1,'Synthetic owner') on conflict do nothing",
        [owner],
      );
      await db.exec("set role authenticated");
      assert.deepEqual(await snapshot(db), before);
      assert.deepEqual(await mutate(db, c), original);
    }
    for (const sql of [
      "select public.hs_mcp_owner_clients()",
      `select public.hs_mcp_consent_write('${client}',true)`,
      "select public.hs_sync_and_load_workspace()",
      `select public.hs_convert_website_enquiry('${crypto.randomUUID()}')`,
      "select public.hs_save_event('{}'::jsonb)",
      "select public.hs_save_person('{}'::jsonb)",
      "select public.hs_save_general_task('{}'::jsonb)",
      `select public.hs_set_event_deleted('${id}',1,true)`,
      "select * from public.hs_mcp_clients",
      "select * from hs_mcp_private.receipts",
      "select hs_mcp_private.command_contract()",
      "select public.hs_mcp_token_hook('{}')",
    ])
      await assert.rejects(db.query(sql));
    for (const table of [
      "hs_events",
      "hs_finance",
      "hs_contacts",
      "hs_musicians",
      "hs_pieces",
      "hs_people",
      "hs_general_tasks",
      "hs_audit",
    ])
      assert.equal(
        (await db.query(`select * from public.${table}`)).rows.length,
        0,
      );
    // Ordinary settings RPC remains RLS-denied for delegated tokens.
    await assert.rejects(
      db.query("select public.hs_save_settings($1::jsonb)", [
        JSON.stringify({ ...defaultSettings, revision: 1 }),
      ]),
    );
    // No enquiry conversion or new receipts on reads, including the actual service projection.
    await db.exec("reset role");
    await db.query(
      "insert into public.website_enquiries(id,name,email,preferred_contact,payload_hash) values($1,'Synthetic submission','synthetic@example.com','email',repeat('a',64))",
      [crypto.randomUUID()],
    );
    await db.exec("set role authenticated");
    const before = await snapshot(db);
    const service = new HorizonService({
      rpc: async (name: string) => ({
        data: (
          await db.query<{ data: unknown }>(`select public.${name}() data`)
        ).rows[0].data,
        error: null,
      }),
    } as unknown as Pick<SupabaseClient, "rpc">);
    assert.equal((await service.events({})).records.length, 1);
    assert.equal(
      (await service.enquiries({})).records[0].dashboardStatus,
      "new",
    );
    assert.deepEqual(await snapshot(db), before);
    // Archive/Lost/Trash stay owner-only; ordinary archive and restore remain usable.
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    let archived = (
      await db.query<{ e: any }>("select public.hs_save_event($1::jsonb) e", [
        JSON.stringify({
          ...original.record,
          archived: true,
          archiveReason: "Synthetic Lost",
        }),
      ])
    ).rows[0].e;
    await setClaims(db, claims);
    await rejectUnchanged(
      db,
      cmd("update_event", id, archived.revision, { notes: "Blocked Lost" }),
      /Archived/,
    );
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    archived = (
      await db.query<{ e: any }>("select public.hs_save_event($1::jsonb) e", [
        JSON.stringify({ ...archived, archived: false }),
      ])
    ).rows[0].e;
    const trashed = (
      await db.query<{ e: any }>(
        "select public.hs_set_event_deleted($1,$2,true) e",
        [id, archived.revision],
      )
    ).rows[0].e;
    await setClaims(db, claims);
    await rejectUnchanged(
      db,
      cmd("update_event", id, trashed.revision, { notes: "Blocked Trash" }),
      /trashed/,
    );
    assert.equal((await service.events({})).records.length, 0);
    await setClaims(db, {
      ...claims,
      client_id: undefined,
      aud: "authenticated",
    });
    await db.query("select public.hs_set_event_deleted($1,$2,false)", [
      id,
      trashed.revision,
    ]);
    await db.query("select public.hs_mcp_consent_write($1,false)", [client]);
    await setClaims(db, claims);
    await rejectUnchanged(db, c, /write access denied/);
  } finally {
    await db.close();
  }
});
