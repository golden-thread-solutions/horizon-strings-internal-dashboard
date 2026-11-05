import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { newEvent } from "../lib/model";
import { HorizonService } from "../lib/mcp/service";
import { schemaSql } from "../scripts/generate-mcp-validation";
import type { SupabaseClient } from "@supabase/supabase-js";

test("SQL validation contract tracks the reader model", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261029214158_horizon_readwrite_mcp.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    sql.includes(schemaSql()),
    "Regenerate the SQL schemas after changing the model",
  );
});

test("direct authenticated writes reject malformed persisted values atomically and keep workspace readable", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin;
      create schema auth; create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;
      create table public.website_enquiries(id uuid primary key,created_at timestamptz not null default now(),name text not null,email text not null,phone text,preferred_contact text not null,event_date date,venue text,area text,message text,email_status text not null default 'pending',payload_hash text not null);
      alter table public.website_enquiries enable row level security;
      revoke all on public.website_enquiries from anon,authenticated;`);
    // Rehearse the real current production migration order: board already exists
    // when the older, previously unreleased read-write migration is applied.
    for (const file of [
      "202609180001_dashboard_v1.sql",
      "202609230001_website_enquiry_inbox.sql",
      "202610110001_automatic_website_enquiries.sql",
      "20261028202257_horizon_readonly_mcp.sql",
      "20261101202353_board_trash_and_people.sql",
      "20261029214158_horizon_readwrite_mcp.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    const owner = crypto.randomUUID(),
      session = crypto.randomUUID();
    await db.query("insert into auth.users values($1)", [owner]);
    await db.query(
      "insert into public.hs_owners values($1,'Synthetic owner')",
      [owner],
    );
    await db.query("insert into auth.sessions values($1,$2,null)", [
      session,
      owner,
    ]);
    await db.query(
      "insert into public.hs_mcp_clients(client_id,user_id,label,resource_url,enabled,write_enabled) values('fixture',$1,'Fixture','https://horizon.example/mcp',true,true)",
      [owner],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: owner,
        role: "authenticated",
        client_id: "fixture",
        aud: "https://horizon.example/mcp",
        session_id: session,
        is_anonymous: false,
      }),
    ]);
    await db.exec("set role authenticated");
    const direct = (command: unknown, record: unknown) =>
      db.query("select public.hs_mcp_change_record($1::jsonb,$2::jsonb)", [
        JSON.stringify(command),
        JSON.stringify(record),
      ]);
    const event = newEvent("Synthetic schema fixture", "2026-09-18");
    await direct(
      {
        operation: "create_event",
        requestId: crypto.randomUUID(),
        id: event.id,
        expectedRevision: 0,
        name: event.name,
      },
      event,
    );
    const service = new HorizonService({
      rpc: async (name: string) => {
        assert.equal(name, "hs_mcp_read_workspace");
        return {
          data: (
            await db.query<{ data: unknown }>(
              "select public.hs_mcp_read_workspace() as data",
            )
          ).rows[0].data,
          error: null,
        };
      },
    } as unknown as Pick<SupabaseClient, "rpc">);
    const baseline = await service.data(),
      saved = baseline.events[0];
    const counters = async () => {
      await db.exec("reset role");
      const result = (
        await db.query(
          "select (select count(*) from public.hs_mcp_requests) receipts,(select count(*) from public.hs_mcp_activity) activity,(select count(*) from public.hs_audit) audit",
        )
      ).rows[0];
      await db.exec("set role authenticated");
      return result;
    };
    const counts = await counters();
    const reject = async (command: unknown, record: unknown, label: string) => {
      await assert.rejects(
        direct(command, record),
        (error: unknown) => (error as { code?: string }).code === "22023",
        label,
      );
      assert.deepEqual(
        await service.data(),
        baseline,
        `${label}: saved data/revisions stay unchanged and full reader succeeds`,
      );
      assert.deepEqual(
        await counters(),
        counts,
        `${label}: no receipt/activity/audit`,
      );
    };
    const patchAt = (obj: any, path: string[], value: unknown) => {
      let at = obj;
      for (const k of path.slice(0, -1)) at = at[k] ??= {};
      at[path.at(-1)!] = value;
    };
    const invalid: [string[], unknown][] = [
      [["operational", "timing"], null],
      [["operational", "timing"], []],
      [["operational", "timing", "bad"], null],
      [["operational", "timing", "bad"], true],
      [["operational", "timing", "bad"], {}],
      [["operational", "timing", "bad"], []],
      [["operational"], null],
      [["milestones"], null],
      [["milestones", "responded"], 42],
      [["milestones", "responded"], "2026-02-30"],
      [["milestones", "responded"], "2999-01-01"],
      [["eventDate"], "2026-13-01"],
      [["eventDate"], {}],
      [["eventDate"], 42],
      [["name"], true],
      [["name"], " "],
      [["name"], "\t\n\u00a0\ufeff"],
      [["name"], "😀".repeat(151)],
      [["durationMinutes"], "30"],
      [["durationMinutes"], 1.5],
      [["durationMinutes"], 1441],
      [["details", "timing", "state"], "Made up"],
      [["details", "timing", "value"], false],
      [["details", "timing", "dueDate"], "2026-02-30"],
      [["details", "timing"], []],
    ];
    for (const [path, value] of invalid) {
      const patch = {},
        record = structuredClone(saved);
      patchAt(patch, path, value);
      patchAt(record, path, value);
      await reject(
        {
          operation: "update_event",
          requestId: crypto.randomUUID(),
          id: saved.id,
          expectedRevision: saved.revision,
          patch,
        },
        record,
        path.join("."),
      );
    }
    for (const [path, value] of [
      [["operational", "timing"], null],
      [["createdDate"], "2026-02-30"],
      [["name"], []],
    ] as [string[], unknown][]) {
      const record = newEvent("Invalid creation", "2026-09-18");
      patchAt(record, path, value);
      await reject(
        {
          operation: "create_event",
          requestId: crypto.randomUUID(),
          id: record.id,
          expectedRevision: 0,
          name: record.name,
        },
        record,
        "invalid new event",
      );
    }
    const contact = {
      id: crypto.randomUUID(),
      name: "Fixture",
      role: "Planner",
      email: "fixture@example.com",
      phone: "",
      notes: "",
    };
    for (const data of [
      { ...contact, name: [] },
      { ...contact, email: "broken" },
      { ...contact, phone: false },
      { ...contact, notes: {} },
      { id: contact.id, name: "Missing fields" },
    ])
      await reject(
        {
          operation: "set_event_item",
          requestId: crypto.randomUUID(),
          id: saved.id,
          expectedRevision: saved.revision,
          collection: "contacts",
          data,
        },
        { ...saved, contacts: [data] },
        "invalid contact",
      );
    const task = {
      id: crypto.randomUUID(),
      title: "Fixture",
      kind: "Task",
      dueDate: "2027-01-01",
      assignee: "",
      recipient: "",
      notes: "",
      done: false,
      completedAt: "",
    };
    for (const data of [
      { ...task, dueDate: "2026-02-30" },
      { ...task, done: "false" },
      { ...task, completedAt: "2999-01-01" },
      { ...task, kind: "Unknown" },
    ])
      await reject(
        {
          operation: "set_event_item",
          requestId: crypto.randomUUID(),
          id: saved.id,
          expectedRevision: saved.revision,
          collection: "tasks",
          data,
        },
        { ...saved, tasks: [data] },
        "invalid task",
      );
    for (const [collection, data] of [
      [
        "communicationLog",
        {
          id: crypto.randomUUID(),
          date: "2026-09-18",
          recipient: "",
          summary: [],
        },
      ],
      [
        "repertoire",
        {
          id: crypto.randomUUID(),
          pieceId: "",
          title: "Fixture",
          moment: "",
          status: false,
          notes: "",
        },
      ],
    ] as const)
      await reject(
        {
          operation: "set_event_item",
          requestId: crypto.randomUUID(),
          id: saved.id,
          expectedRevision: saved.revision,
          collection,
          data,
        },
        { ...saved, [collection]: [data] },
        "invalid recorded communication/repertoire",
      );
    for (const data of [
      {
        name: "Fixture",
        instrument: "Violin",
        email: "broken",
        phone: "",
        notes: "",
      },
      { name: [], instrument: "Violin", email: "", phone: "", notes: "" },
    ]) {
      const id = crypto.randomUUID();
      await reject(
        {
          operation: "save_musician",
          requestId: crypto.randomUUID(),
          id,
          expectedRevision: 0,
          data,
        },
        { ...data, id, revision: 0 },
        "invalid directory musician",
      );
    }
    for (const musicUrl of [
      "javascript:alert(1)",
      "https://example.com:99999/a",
      "not a URL",
    ]) {
      const id = crypto.randomUUID(),
        data = {
          title: "Fixture",
          artist: "",
          musicUrl,
          genre: "Classical",
          weddingSuitable: "Unreviewed",
          notes: "",
        };
      await reject(
        {
          operation: "save_piece",
          requestId: crypto.randomUUID(),
          id,
          expectedRevision: 0,
          data,
        },
        { ...data, id, revision: 0 },
        "invalid catalogue URL",
      );
    }
    for (const patch of [
      { readyRequiresPayment: "true" },
      { internalWeeks: 1.5 },
      { internalWeeks: 1, finalWeeks: 4 },
    ])
      await reject(
        {
          operation: "update_settings",
          requestId: crypto.randomUUID(),
          expectedRevision: baseline.settings.revision,
          patch,
        },
        { ...baseline.settings, ...patch },
        "invalid settings",
      );
    // A valid email and legitimate operational scalar values still persist.
    await direct(
      {
        operation: "set_event_item",
        requestId: crypto.randomUUID(),
        id: saved.id,
        expectedRevision: saved.revision,
        collection: "contacts",
        data: contact,
      },
      { ...saved, contacts: [contact] },
    );
    assert.equal(
      (await service.data()).events[0].contacts[0].email,
      contact.email,
    );
    const nowSaved = (await service.data()).events[0];
    await db.exec("reset role");
    await assert.rejects(
      db.query("select public.hs_set_event_deleted($1,$2,true)", [
        saved.id,
        nowSaved.revision,
      ]),
      /Owner access required/,
    );
    await db.query(
      "update public.hs_events set operational='{}'::jsonb where id=$1",
      [saved.id],
    );
    await db.exec("set role authenticated");
    const legacy = (await service.data()).events[0];
    await direct(
      {
        operation: "update_event",
        requestId: crypto.randomUUID(),
        id: saved.id,
        expectedRevision: legacy.revision,
        patch: { notes: "Legacy remains editable" },
      },
      { ...legacy, notes: "Legacy remains editable" },
    );
    assert.equal(
      (await service.data()).events[0].notes,
      "Legacy remains editable",
    );
  } finally {
    await db.close();
  }
});
