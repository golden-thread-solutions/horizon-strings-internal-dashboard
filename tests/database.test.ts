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
    const owner = crypto.randomUUID(),
      outsider = crypto.randomUUID();
    await db.query("insert into auth.users values ($1),($2)", [
      owner,
      outsider,
    ]);
    await db.query("insert into public.hs_owners values ($1,'Test owner')", [
      owner,
    ]);
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
    const second = (
      await db.query<{ event: typeof event }>(
        "select public.hs_save_event($1::jsonb) as event",
        [JSON.stringify(saved)],
      )
    ).rows[0].event;
    assert.equal(second.revision, 2);
    assert.equal(second.contacts.length, 1);
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
      await db.query<{ workspace: { events: unknown[] } }>(
        "select public.hs_load_workspace() as workspace",
      )
    ).rows[0].workspace;
    assert.equal(workspace.events.length, 1);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      outsider,
    ]);
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
