import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { eventSchema, type EventRecord } from "../lib/model";
import { deriveStage, eventActions } from "../lib/workflow";
import { defaultSettings } from "../lib/model";

test("automatic website sync preserves privacy, mapping, history and owner edits", async () => {
  const db = new PGlite();
  const migration = async (name: string) =>
    db.exec(
      await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    await migration("202609180001_dashboard_v1.sql");
    await db.exec(`
      create table public.website_enquiries (
        id uuid primary key, created_at timestamptz not null default now(),
        name text not null, email text not null, phone text,
        preferred_contact text not null, event_date date, venue text, area text,
        message text, email_status text not null default 'pending', payload_hash text not null
      );
      alter table public.website_enquiries enable row level security;
      revoke all on public.website_enquiries from public, anon, authenticated;
    `);
    await migration("202609230001_website_enquiry_inbox.sql");
    const owner = crypto.randomUUID(),
      outsider = crypto.randomUUID();
    const earlier = crypto.randomUUID(),
      fresh = crypto.randomUUID();
    await db.query("insert into auth.users values ($1),($2)", [
      owner,
      outsider,
    ]);
    await db.query("insert into public.hs_owners values ($1,'Test owner')", [
      owner,
    ]);
    await db.query(
      `insert into public.website_enquiries
      (id,created_at,name,email,preferred_contact,payload_hash)
      values ($1,'2020-01-01','Earlier example','earlier@example.com','email','example')`,
      [earlier],
    );
    await migration("202610110001_automatic_website_enquiries.sql");
    const activation = (
      await db.query("select enabled_from from public.hs_website_enquiry_sync")
    ).rows;
    await migration("202610110001_automatic_website_enquiries.sql");
    assert.deepEqual(
      (
        await db.query(
          "select enabled_from from public.hs_website_enquiry_sync",
        )
      ).rows,
      activation,
    );
    await db.query(
      `insert into public.website_enquiries
      (id,name,email,phone,preferred_contact,event_date,area,message,wedding_package,requested_ensemble,payload_hash)
      values ($1,'Website example','example@example.com','0400000000','text','2027-03-01',
        'Coffs Harbour','A ceremony enquiry','signature','quartet','example')`,
      [fresh],
    );
    const sync = async () =>
      (
        await db.query<{
          workspace: { events: EventRecord[]; websiteEnquiries: unknown[] };
        }>("select public.hs_sync_and_load_workspace() as workspace")
      ).rows[0].workspace;
    await db.exec("set role anon");
    await assert.rejects(sync(), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      outsider,
    ]);
    await assert.rejects(sync(), /Owner access required/);
    assert.equal(
      (await db.query("select * from public.hs_website_enquiry_sync")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.website_enquiries")).rows.length,
      0,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await assert.rejects(
      db.query(
        "update public.hs_website_enquiry_sync set enabled_from='2020-01-01'",
      ),
      /permission denied/,
    );
    const first = await sync();
    assert.equal(first.events.length, 1);
    const event = eventSchema.parse(first.events[0]);
    assert.equal(event.source, "Website enquiry");
    assert.equal(event.eventDate, "2027-03-01");
    assert.equal(event.area, "Coffs Harbour");
    assert.equal(event.ensemble, "Quartet");
    assert.equal(event.contacts[0].email, "example@example.com");
    assert.equal(event.contacts[0].phone, "0400000000");
    assert.match(event.contacts[0].notes, /Text/);
    assert.match(event.notes, /ceremony enquiry/);
    assert.match(event.notes, /signature/);
    assert.equal(deriveStage(event, defaultSettings), "New Enquiry");
    assert.ok(
      eventActions(event, defaultSettings).some(
        (a) => a.title === "Respond to enquiry",
      ),
    );
    assert.equal(
      (
        await db.query<{ id: string | null }>(
          "select dashboard_event_id as id from public.website_enquiries where id=$1",
          [earlier],
        )
      ).rows[0].id,
      null,
    );
    event.notes = "Owner edited this record";
    event.archived = true;
    event.archiveReason = "Synthetic example declined";
    const edited = (
      await db.query<{ event: EventRecord }>(
        "select public.hs_save_event($1::jsonb) as event",
        [JSON.stringify(event)],
      )
    ).rows[0].event;
    const second = await sync();
    assert.equal(second.events.length, 1);
    assert.deepEqual(second.events[0], edited);
    const manualRetry = (
      await db.query<{ event: EventRecord }>(
        "select public.hs_convert_website_enquiry($1) as event",
        [fresh],
      )
    ).rows[0].event;
    assert.deepEqual(manualRetry, edited);
    await db.exec("reset role");
    await db.exec(`insert into public.website_enquiries
      (id,name,email,preferred_contact,payload_hash,requested_ensemble)
      select gen_random_uuid(),'No fixed date ' || n,'example@example.com','email','example','still-deciding'
      from generate_series(1,101) n`);
    await db.exec("set role authenticated");
    const backlog = await sync();
    assert.equal(backlog.events.length, 102);
    assert.equal(backlog.websiteEnquiries.length, 100);
    for (const added of backlog.events.filter((e) => e.id !== event.id)) {
      const valid = eventSchema.parse(added);
      assert.equal(valid.eventDate, "");
      assert.equal(valid.ensemble, "");
    }
    assert.equal((await sync()).events.length, 102);
    await db.exec("reset role");
    const pending = crypto.randomUUID();
    await db.query(
      `insert into public.website_enquiries
      (id,name,email,preferred_contact,payload_hash) values ($1,'Retry example','example@example.com','email','example')`,
      [pending],
    );
    await db.exec(`create function public.test_conversion_failure() returns trigger language plpgsql as $$
      begin raise exception 'Synthetic conversion failure'; end $$;
      create trigger test_failure before insert on public.hs_contacts
      for each row execute function public.test_conversion_failure();`);
    await db.exec("set role authenticated");
    await assert.rejects(sync(), /Synthetic conversion failure/);
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length,
      102,
    );
    assert.equal(
      (
        await db.query<{ id: string | null }>(
          "select dashboard_event_id as id from public.website_enquiries where id=$1",
          [pending],
        )
      ).rows[0].id,
      null,
    );
    await db.exec(
      "reset role; drop trigger test_failure on public.hs_contacts; set role authenticated",
    );
    assert.equal((await sync()).events.length, 103);
  } finally {
    await db.close();
  }
});
