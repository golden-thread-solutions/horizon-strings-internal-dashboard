import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
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
    saved.operational.timing.ceremonyStartTime = "15:30";
    saved.operational.timing.ceremonyDurationMinutes = 30;
    const second = (
      await db.query<{ event: typeof event }>(
        "select public.hs_save_event($1::jsonb) as event",
        [JSON.stringify(saved)],
      )
    ).rows[0].event;
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
    const policies = await db.query(
      "select tablename from pg_tables where schemaname='public' and tablename like 'hs_%' and not rowsecurity",
    );
    assert.equal(policies.rows.length, 0);
  } finally {
    await db.close();
  }
});
