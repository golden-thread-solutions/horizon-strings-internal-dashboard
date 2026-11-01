import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  newEvent,
  eventSchema,
  generalTaskSchema,
  type GeneralTask,
  type Person,
} from "../lib/model";

test("Trash, restore, people and general tasks preserve owner security, revisions and conversion links", async () => {
  const db = new PGlite();
  const migrate = async (name: string) =>
    db.exec(
      await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  const rpc = async <T>(sql: string, args: unknown[]) =>
    (await db.query<{ result: T }>(sql, args)).rows[0].result;
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin;
  create schema auth;create table auth.users(id uuid primary key);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
    await migrate("202609180001_dashboard_v1.sql");
    await db.exec(
      `create table public.website_enquiries(id uuid primary key,created_at timestamptz not null default now(),name text not null,email text not null,phone text,preferred_contact text not null,event_date date,venue text,area text,message text,email_status text not null default 'pending',payload_hash text not null);alter table public.website_enquiries enable row level security;revoke all on public.website_enquiries from public,anon,authenticated;`,
    );
    await migrate("202609230001_website_enquiry_inbox.sql");
    await migrate("202610110001_automatic_website_enquiries.sql");
    await migrate("20261028202257_horizon_readonly_mcp.sql");
    await migrate("20261101202353_board_trash_and_people.sql");
    const owner = crypto.randomUUID(),
      outsider = crypto.randomUUID();
    await db.query("insert into auth.users values($1),($2)", [owner, outsider]);
    await db.query("insert into public.hs_owners values($1,'Owner')", [owner]);
    const submission = crypto.randomUUID();
    await db.query(
      "insert into public.website_enquiries(id,name,email,preferred_contact,payload_hash) values($1,'Synthetic couple','test@example.com','email','fixture')",
      [submission],
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const people = (
      await db.query<Person>("select * from public.hs_people order by name")
    ).rows;
    assert.deepEqual(
      people.map((p) => p.name),
      ["Koby", "Mia"],
    );
    assert.equal(
      (await db.query("select * from public.hs_owners")).rows.length,
      1,
    );
    let event = eventSchema.parse(
      await rpc("select public.hs_convert_website_enquiry($1) result", [
        submission,
      ]),
    );
    const original = { ...event };
    event = eventSchema.parse(
      await rpc("select public.hs_set_event_deleted($1,$2,true) result", [
        event.id,
        event.revision,
      ]),
    );
    assert.ok(event.deletedAt);
    assert.equal(event.revision, original.revision + 1);
    await assert.rejects(
      rpc("select public.hs_set_event_deleted($1,$2,false) result", [
        event.id,
        original.revision,
      ]),
      /Event changed/,
    );
    await assert.rejects(
      rpc("select public.hs_save_event($1::jsonb) result", [
        JSON.stringify(event),
      ]),
      /Restore this event/,
    );
    const duplicate = eventSchema.parse(
      await rpc("select public.hs_convert_website_enquiry($1) result", [
        submission,
      ]),
    );
    assert.equal(duplicate.id, event.id);
    assert.ok(duplicate.deletedAt);
    await rpc("select public.hs_sync_and_load_workspace() result", []);
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length,
      1,
    );
    event = eventSchema.parse(
      await rpc("select public.hs_set_event_deleted($1,$2,false) result", [
        event.id,
        event.revision,
      ]),
    );
    assert.equal(event.deletedAt, "");
    assert.deepEqual(event.contacts, original.contacts);
    assert.equal(event.archived, original.archived);
    await assert.rejects(
      rpc("select public.hs_save_event($1::jsonb) result", [
        JSON.stringify(original),
      ]),
      /changed/,
    );
    const eventTask = {
      id: crypto.randomUUID(),
      title: "Synthetic event preparation",
      kind: "Task",
      dueDate: "2026-11-02",
      assignee: people[0].id,
      recipient: "",
      notes: "",
      done: false,
      completedAt: "",
    };
    event = eventSchema.parse(
      await rpc("select public.hs_save_event($1::jsonb) result", [
        JSON.stringify({ ...event, tasks: [eventTask] }),
      ]),
    );
    assert.equal(event.tasks[0].assignee, people[0].id);
    event = eventSchema.parse(
      await rpc("select public.hs_set_event_deleted($1,$2,true) result", [
        event.id,
        event.revision,
      ]),
    );
    event = eventSchema.parse(
      await rpc("select public.hs_set_event_deleted($1,$2,false) result", [
        event.id,
        event.revision,
      ]),
    );
    assert.deepEqual(event.tasks, [eventTask]);
    let task: GeneralTask = {
      id: crypto.randomUUID(),
      revision: 0,
      title: "Synthetic admin task",
      kind: "Task",
      dueDate: "2026-11-02",
      assignee: people[1].id,
      recipient: "",
      notes: "",
      done: false,
      completedAt: "",
    };
    task = generalTaskSchema.parse(
      await rpc("select public.hs_save_general_task($1::jsonb) result", [
        JSON.stringify(task),
      ]),
    );
    assert.equal(task.revision, 1);
    const stale = { ...task };
    task = generalTaskSchema.parse(
      await rpc("select public.hs_save_general_task($1::jsonb) result", [
        JSON.stringify({ ...task, done: true, completedAt: "2026-11-02" }),
      ]),
    );
    assert.equal(task.done, true);
    await assert.rejects(
      rpc("select public.hs_save_general_task($1::jsonb) result", [
        JSON.stringify(stale),
      ]),
      /Task changed/,
    );
    await assert.rejects(
      rpc("select public.hs_save_general_task($1::jsonb) result", [
        JSON.stringify({
          ...stale,
          id: crypto.randomUUID(),
          revision: 0,
          assignee: crypto.randomUUID(),
        }),
      ]),
      /active person/,
    );
    assert.equal(
      (await db.query("select * from public.hs_general_tasks")).rows.length,
      1,
    );
    await assert.rejects(
      rpc("select public.hs_save_person($1::jsonb) result", [
        JSON.stringify({
          id: crypto.randomUUID(),
          revision: 0,
          name: "koby",
          active: true,
        }),
      ]),
      /unique/,
    );
    const person = people[1];
    await rpc("select public.hs_save_person($1::jsonb) result", [
      JSON.stringify({ ...person, active: false }),
    ]);
    await assert.rejects(
      rpc("select public.hs_save_person($1::jsonb) result", [
        JSON.stringify(person),
      ]),
      /Person changed/,
    );
    // Existing assignments remain editable after a person is deactivated.
    await rpc("select public.hs_save_general_task($1::jsonb) result", [
      JSON.stringify({ ...task, notes: "retained assignment" }),
    ]);
    const workspace = await rpc<{
      people: Person[];
      generalTasks: GeneralTask[];
    }>("select public.hs_load_workspace() result", []);
    assert.equal(workspace.people.length, 2);
    assert.equal(workspace.generalTasks[0].assignee, person.id);
    for (const claims of [
      {},
      { client_id: "unapproved-client", role: "authenticated" },
    ]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        Object.keys(claims).length ? owner : outsider,
      ]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify(claims),
      ]);
      assert.equal(
        (await db.query("select * from public.hs_people")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.hs_general_tasks")).rows.length,
        0,
      );
      await assert.rejects(
        rpc("select public.hs_save_general_task($1::jsonb) result", [
          JSON.stringify(task),
        ]),
        /Owner access/,
      );
      await assert.rejects(
        rpc("select public.hs_save_person($1::jsonb) result", [
          JSON.stringify(person),
        ]),
        /Owner access/,
      );
      await assert.rejects(
        rpc("select public.hs_set_event_deleted($1,$2,true) result", [
          event.id,
          event.revision,
        ]),
        /Owner access/,
      );
    }
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select * from public.hs_people"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.hs_set_event_deleted($1,1,true)", [event.id]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
