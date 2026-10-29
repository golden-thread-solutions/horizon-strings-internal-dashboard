import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  setFieldNotApplicable,
  fieldNotApplicable,
} from "../lib/event-details";
import { newEvent, defaultSettings } from "../lib/model";

test("migration, RLS, atomic save, stale revisions and settings against Postgres", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609180001_dashboard_v1.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`
      create table public.website_enquiries (
        id uuid primary key,
        created_at timestamptz not null default now(),
        name text not null,
        email text not null,
        phone text,
        preferred_contact text not null,
        event_date date,
        venue text,
        area text,
        message text,
        email_status text not null default 'pending',
        payload_hash text not null
      );
      alter table public.website_enquiries enable row level security;
      revoke all on public.website_enquiries from anon, authenticated;
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609230001_website_enquiry_inbox.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const owner = crypto.randomUUID(),
      outsider = crypto.randomUUID();
    await db.query("insert into auth.users values ($1),($2)", [
      owner,
      outsider,
    ]);
    await db.query("insert into public.hs_owners values ($1,'Test owner')", [
      owner,
    ]);
    const websiteEnquiry = crypto.randomUUID();
    await db.query(
      `insert into public.website_enquiries
        (id,name,email,phone,preferred_contact,event_date,venue,area,message,email_status,payload_hash,wedding_package,requested_ensemble)
       values ($1,'Website couple','couple@example.com','0400000000','email','2027-02-20','Garden venue','Coffs Harbour','Ceremony enquiry','sent',repeat('a',64),'signature','quartet')`,
      [websiteEnquiry],
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.hs_events"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.hs_load_workspace()"),
      /permission denied/,
    );
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      outsider,
    ]);
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into public.hs_owners values ($1,'Self appointed')", [
        outsider,
      ]),
      /permission denied/,
    );
    const event = newEvent("Private example", "2026-09-18");
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(event),
      ]),
      /Owner access required/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const result = await db.query<{ event: typeof event }>(
      "select public.hs_save_event($1::jsonb) as event",
      [JSON.stringify(event)],
    );
    const saved = result.rows[0].event;
    assert.equal(saved.code, "E00001");
    assert.equal(saved.revision, 1);
    assert.deepEqual(saved.details, event.details);
    saved.contacts.push({
      id: crypto.randomUUID(),
      role: "Main contact",
      name: "Example",
      phone: "0400000000",
      email: "",
      notes: "",
    });
    saved.operational.venueSetup.secondAddress = "Retained address";
    setFieldNotApplicable(saved, "venueSetup", "secondAddress", true);
    saved.operational.timing.ceremonyStartTime = "15:30";
    saved.operational.timing.ceremonyDurationMinutes = 30;
    const second = (
      await db.query<{ event: typeof event }>(
        "select public.hs_save_event($1::jsonb) as event",
        [JSON.stringify(saved)],
      )
    ).rows[0].event;
    assert.equal(
      fieldNotApplicable(second, "venueSetup", "secondAddress"),
      true,
    );
    assert.equal(
      second.operational.venueSetup.secondAddress,
      "Retained address",
    );
    assert.equal(second.revision, 2);
    assert.equal(second.contacts.length, 1);
    assert.equal(second.operational.timing.ceremonyStartTime, "15:30");
    assert.equal(second.operational.timing.ceremonyDurationMinutes, 30);
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(saved),
      ]),
      /another session/,
    );
    const invalid = structuredClone(second);
    invalid.name = "Should roll back";
    invalid.details.wetWeather = {
      state: "Deferred",
      value: "",
      dueDate: "",
      trigger: "",
    };
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(invalid),
      ]),
      /check constraint/,
    );
    const unchanged = (
      await db.query<{ event: typeof event }>(
        "select public.hs_get_event($1) as event",
        [saved.id],
      )
    ).rows[0].event;
    assert.equal(unchanged.name, "Private example");
    assert.equal(unchanged.revision, 2);
    assert.equal(unchanged.contacts.length, 1);
    const settings = (
      await db.query<{ settings: typeof defaultSettings }>(
        "select public.hs_save_settings($1::jsonb) as settings",
        [JSON.stringify({ ...defaultSettings, musiciansWeeks: 8 })],
      )
    ).rows[0].settings;
    assert.equal(settings.musiciansWeeks, 8);
    assert.equal(settings.revision, 1);
    await assert.rejects(
      db.query("select public.hs_save_settings($1::jsonb)", [
        JSON.stringify(defaultSettings),
      ]),
      /another session/,
    );
    const workspace = (
      await db.query<{
        workspace: { events: unknown[]; websiteEnquiries: unknown[] };
      }>("select public.hs_load_workspace() as workspace")
    ).rows[0].workspace;
    assert.equal(workspace.events.length, 1);
    assert.equal(workspace.websiteEnquiries.length, 1);
    const converted = (
      await db.query<{ event: typeof event }>(
        "select public.hs_convert_website_enquiry($1) as event",
        [websiteEnquiry],
      )
    ).rows[0].event;
    assert.equal(converted.name, "Website couple");
    assert.equal(converted.source, "Website enquiry");
    assert.equal(converted.ensemble, "Quartet");
    assert.equal(converted.contacts[0].email, "couple@example.com");
    const duplicateConversion = (
      await db.query<{ event: typeof event }>(
        "select public.hs_convert_website_enquiry($1) as event",
        [websiteEnquiry],
      )
    ).rows[0].event;
    assert.equal(duplicateConversion.id, converted.id);
    const linked = await db.query<{
      dashboard_status: string;
      dashboard_event_id: string;
    }>(
      "select dashboard_status,dashboard_event_id from public.website_enquiries where id=$1",
      [websiteEnquiry],
    );
    assert.equal(linked.rows[0].dashboard_status, "converted");
    assert.equal(linked.rows[0].dashboard_event_id, converted.id);
    assert.equal(
      (
        await db.query<{ workspace: { events: unknown[] } }>(
          "select public.hs_load_workspace() as workspace",
        )
      ).rows[0].workspace.events.length,
      2,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      outsider,
    ]);
    assert.equal(
      (await db.query("select * from public.website_enquiries")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.hs_contacts")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query<{ event: unknown }>(
          "select public.hs_get_event($1) as event",
          [saved.id],
        )
      ).rows[0].event,
      null,
    );
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(second),
      ]),
      /Owner access required/,
    );
    await db.exec("reset role");
    // Enable only synthetic OAuth access in this embedded database.
    await db.exec(`create role supabase_auth_admin;
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant execute on function auth.jwt() to authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610110001_automatic_website_enquiries.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261028202257_horizon_readonly_mcp.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const session = crypto.randomUUID();
    await db.query("insert into auth.sessions values($1,$2,null)", [
      session,
      owner,
    ]);
    await db.query(
      "insert into public.hs_mcp_clients values($1,$2,'Synthetic ChatGPT','https://horizon.example/mcp',true)",
      ["test-client", owner],
    );
    const claims = {
      sub: owner,
      role: "authenticated",
      client_id: "test-client",
      aud: "https://horizon.example/mcp",
      session_id: session,
      is_anonymous: false,
    };
    const pendingEnquiry = crypto.randomUUID();
    await db.query(
      `insert into public.website_enquiries(id,name,email,preferred_contact,message,payload_hash)
       values ($1,'Pending synthetic enquiry','pending@example.com','email','Do not convert during MCP reads',repeat('b',64))`,
      [pendingEnquiry],
    );
    const eventCountBeforeRead = (
      await db.query("select id from public.hs_events")
    ).rows.length;
    const setClaims = async (value: unknown) => {
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify(value),
      ]);
    };
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await setClaims(claims);
    await db.exec("set role authenticated");
    const delegated = await db.query<{
      data: { events: (typeof event)[]; websiteEnquiries: unknown[] };
    }>("select public.hs_mcp_read_workspace() as data");
    assert.ok(delegated.rows[0].data.events.some((e) => e.id === saved.id));
    assert.ok(Array.isArray(delegated.rows[0].data.websiteEnquiries));
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.website_enquiries")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select * from public.hs_mcp_clients"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(second),
      ]),
      /Owner access required/,
    );
    await assert.rejects(
      db.query("select public.hs_convert_website_enquiry($1)", [
        websiteEnquiry,
      ]),
      /Owner access required/,
    );
    await assert.rejects(
      db.query("select public.hs_sync_and_load_workspace()"),
      /Owner access required/,
    );
    await assert.rejects(
      db.query("select public.hs_save_settings($1::jsonb)", [
        JSON.stringify(settings),
      ]),
      /Settings changed/,
    );
    await assert.rejects(
      db.query(
        "insert into public.hs_musicians(id,name,instrument,email,phone,notes) values($1,'Blocked','Violin','','','')",
        [crypto.randomUUID()],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select public.hs_mcp_token_hook('{}'::jsonb)"),
      /permission denied/,
    );
    for (const changed of [
      { ...claims, aud: "authenticated" },
      { ...claims, client_id: "unknown" },
      { ...claims, role: undefined },
      { ...claims, session_id: crypto.randomUUID() },
      { ...claims, is_anonymous: true },
    ]) {
      await setClaims(changed);
      await assert.rejects(
        db.query("select public.hs_mcp_read_workspace()"),
        /MCP access denied/,
      );
    }
    await setClaims(claims);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select id from public.hs_events")).rows.length,
      eventCountBeforeRead,
    );
    assert.equal(
      (
        await db.query<{ id: string | null }>(
          "select dashboard_event_id as id from public.website_enquiries where id=$1",
          [pendingEnquiry],
        )
      ).rows[0].id,
      null,
    );
    await db.exec("update public.hs_mcp_clients set enabled=false");
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.hs_mcp_read_workspace()"),
      /MCP access denied/,
    );
    await db.exec("reset role;update public.hs_mcp_clients set enabled=true");
    const hook = (
      await db.query<{ data: { claims: { aud: string } } }>(
        "select public.hs_mcp_token_hook($1::jsonb) as data",
        [
          JSON.stringify({
            user_id: owner,
            client_id: "test-client",
            claims: { aud: "authenticated" },
          }),
        ],
      )
    ).rows[0].data;
    assert.equal(hook.claims.aud, "https://horizon.example/mcp");
    await db.query("delete from auth.sessions where id=$1", [session]);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.hs_mcp_read_workspace()"),
      /MCP access denied/,
    );
    await db.exec("reset role");
    await db.query("insert into auth.sessions values($1,$2,null)", [
      session,
      owner,
    ]);
    await db.query("delete from public.hs_owners where user_id=$1", [owner]);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.hs_mcp_read_workspace()"),
      /MCP access denied/,
    );
    await db.exec("reset role");
    await db.query("insert into public.hs_owners values($1,'Test owner')", [
      owner,
    ]);
    await setClaims({ sub: owner, role: "authenticated" });
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length > 0,
      true,
    );
    await db.exec("reset role");
    const policies = await db.query(
      "select tablename from pg_tables where schemaname='public' and tablename like 'hs_%' and not rowsecurity",
    );
    assert.equal(policies.rows.length, 0);
  } finally {
    await db.close();
  }
});
