import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  setFieldNotApplicable,
  fieldNotApplicable,
} from "../lib/event-details";
import { newEvent, defaultSettings } from "../lib/model";
import { HorizonService } from "../lib/mcp/service";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261029214158_horizon_readwrite_mcp.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const change = async (command: unknown, record: unknown) =>
      (
        await db.query<{ result: { record: typeof second; saved: boolean } }>(
          "select public.hs_mcp_change_record($1::jsonb,$2::jsonb) as result",
          [JSON.stringify(command), JSON.stringify(record)],
        )
      ).rows[0].result;
    const edit = {
      operation: "update_event",
      requestId: crypto.randomUUID(),
      id: second.id,
      expectedRevision: second.revision,
      patch: { name: "MCP updated event" },
    };
    const candidate = { ...second, ...edit.patch };
    await db.exec("set role authenticated");
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select public.hs_mcp_can_write() as ok",
        )
      ).rows[0].ok,
      false,
    );
    await assert.rejects(change(edit, candidate), /MCP write access denied/);
    await db.exec(
      "reset role; update public.hs_mcp_clients set write_enabled=true; set role authenticated",
    );
    const written = await change(edit, candidate);
    assert.equal(written.record.name, "MCP updated event");
    assert.equal(written.record.revision, 3);
    assert.deepEqual(written.record.finance, second.finance);
    assert.deepEqual(await change(edit, candidate), written);
    assert.deepEqual(
      (
        await db.query<{ result: unknown }>(
          "select public.hs_mcp_retry($1::jsonb) as result",
          [JSON.stringify(edit)],
        )
      ).rows[0].result,
      written,
    );
    await assert.rejects(
      change({ ...edit, patch: { name: "Different retry" } }, candidate),
      /Request ID reused/,
    );
    await assert.rejects(
      change({ ...edit, requestId: crypto.randomUUID() }, candidate),
      /Stale event/,
    );
    const bad = {
      ...edit,
      requestId: crypto.randomUUID(),
      expectedRevision: 3,
    };
    await assert.rejects(
      change(bad, {
        ...written.record,
        finance: { ...written.record.finance, performance: 999 },
      }),
      /Invalid event candidate/,
    );
    await assert.rejects(
      change({ ...bad, patch: { finance: {} } }, written.record),
      /Invalid event fields/,
    );
    await assert.rejects(
      change({ ...bad, patch: { archived: true } }, written.record),
      /Invalid event fields/,
    );
    const contact = {
      id: crypto.randomUUID(),
      name: "Added contact",
      role: "Planner",
      email: "",
      phone: "",
      notes: "",
    };
    const childCommand = {
      operation: "set_event_item",
      requestId: crypto.randomUUID(),
      id: second.id,
      expectedRevision: 3,
      collection: "contacts",
      data: contact,
    };
    const childSaved = await change(childCommand, {
      ...written.record,
      contacts: [...written.record.contacts, contact],
    });
    assert.equal(childSaved.record.contacts.length, 2);
    assert.equal(childSaved.record.revision, 4);
    assert.deepEqual(childSaved.record.contacts[0], second.contacts[0]);
    await assert.rejects(
      change(
        {
          ...childCommand,
          requestId: crypto.randomUUID(),
          expectedRevision: 4,
        },
        { ...childSaved.record, contacts: [contact] },
      ),
      /Invalid event candidate/,
    );
    // A valid second change must not change the receipt returned by the first retry.
    assert.deepEqual(await change(edit, candidate), written);
    const invalidDetail = {
      state: "Deferred",
      value: "",
      dueDate: "",
      trigger: "",
    };
    const failedCommand = {
      operation: "update_event",
      requestId: crypto.randomUUID(),
      id: second.id,
      expectedRevision: 4,
      patch: { details: { rehearsal: invalidDetail } },
    };
    await assert.rejects(
      change(failedCommand, {
        ...childSaved.record,
        details: { ...childSaved.record.details, rehearsal: invalidDetail },
      }),
      /check constraint/,
    );
    assert.equal(
      (
        await db.query<{ data: { events: (typeof second)[] } }>(
          "select public.hs_mcp_read_workspace() as data",
        )
      ).rows[0].data.events.find((e) => e.id === second.id)!.revision,
      4,
    );
    await assert.rejects(
      change(
        {
          ...failedCommand,
          operation: "set_event_item",
          collection: "musicians",
          data: { id: crypto.randomUUID(), fee: 123, paid: true },
        },
        childSaved.record,
      ),
      /Financial edits excluded/,
    );
    await assert.rejects(
      db.query("select hs_mcp_private.save_event($1::jsonb)", [
        JSON.stringify(childSaved.record),
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.hs_mcp_requests"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.hs_mcp_activity"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from public.hs_events")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.hs_save_event($1::jsonb)", [
        JSON.stringify(childSaved.record),
      ]),
      /Owner access required/,
    );
    const musicianId = crypto.randomUUID();
    const musicianData = {
      name: "Synthetic catalogue musician",
      instrument: "Violin",
      email: "",
      phone: "",
      notes: "",
    };
    const directoryCommand = {
      operation: "save_musician",
      requestId: crypto.randomUUID(),
      id: musicianId,
      expectedRevision: 0,
      data: musicianData,
    };
    const directorySaved = await change(directoryCommand, {
      ...musicianData,
      id: musicianId,
      revision: 0,
    });
    assert.equal(directorySaved.record.revision, 1);
    await db.exec("reset role");
    await setClaims({ sub: owner, role: "authenticated" });
    await db.exec("set role authenticated");
    await db.query(
      "update public.hs_musicians set notes='Human edit' where id=$1",
      [musicianId],
    );
    await setClaims(claims);
    await assert.rejects(
      change(
        {
          ...directoryCommand,
          requestId: crypto.randomUUID(),
          expectedRevision: 1,
        },
        { ...musicianData, id: musicianId, revision: 1 },
      ),
      /Stale directory record/,
    );
    const settingsCommand = {
      operation: "update_settings",
      requestId: crypto.randomUUID(),
      expectedRevision: settings.revision,
      patch: { responseDays: 3 },
    };
    const settingsWritten = await change(settingsCommand, {
      ...settings,
      responseDays: 3,
    });
    assert.equal(settingsWritten.record.revision, 2);
    const created = newEvent("Created through MCP", "2026-10-30");
    const createCommand = {
      operation: "create_event",
      requestId: crypto.randomUUID(),
      id: created.id,
      expectedRevision: 0,
      name: created.name,
    };
    const createdResult = await change(createCommand, created);
    assert.equal(createdResult.record.revision, 1);
    assert.deepEqual(await change(createCommand, created), createdResult);
    for (const altered of [
      { ...claims, aud: "wrong" },
      { ...claims, client_id: "unknown" },
      { ...claims, session_id: crypto.randomUUID() },
      { ...claims, is_anonymous: true },
      { sub: owner, role: "authenticated" },
    ]) {
      await setClaims(altered);
      await assert.rejects(change(edit, candidate), /MCP write access denied/);
    }
    await setClaims(claims);
    await db.exec(
      "reset role; update public.hs_mcp_clients set write_enabled=false; set role authenticated",
    );
    await assert.rejects(change(edit, candidate), /MCP write access denied/);
    assert.ok(
      (await db.query("select public.hs_mcp_read_workspace()")).rows.length,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.hs_mcp_activity")).rows.length,
      5,
    );
    assert.equal(
      (await db.query("select * from public.hs_mcp_requests")).rows.length,
      5,
    );
    // Exercise the actual service against PostgreSQL for every remaining variant.
    process.env.MCP_PUBLIC_ORIGIN = "https://horizon.example";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic";
    process.env.MCP_ENABLE_WRITES = "true";
    const writer = new HorizonService({
      rpc: async (name: string, args?: Record<string, unknown>) => {
        try {
          const query =
            name === "hs_mcp_change_record"
              ? await db.query<{ data: unknown }>(
                  "select public.hs_mcp_change_record($1::jsonb,$2::jsonb) as data",
                  [
                    JSON.stringify(args!.p_command),
                    JSON.stringify(args!.p_record),
                  ],
                )
              : name === "hs_mcp_retry"
                ? await db.query<{ data: unknown }>(
                    "select public.hs_mcp_retry($1::jsonb) as data",
                    [JSON.stringify(args!.p_command)],
                  )
                : await db.query<{ data: unknown }>(
                    `select public.${name}() as data`,
                  );
          return { data: query.rows[0].data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
    } as unknown as Pick<SupabaseClient, "rpc">);
    await db.exec(
      "update public.hs_mcp_clients set write_enabled=true; set role authenticated",
    );
    let eventRevision = 4;
    for (const item of [
      {
        collection: "tasks" as const,
        data: {
          id: crypto.randomUUID(),
          title: "Synthetic task",
          kind: "Task" as const,
          dueDate: "2027-01-01",
          assignee: "Owner",
          recipient: "",
          notes: "",
          done: false,
          completedAt: "",
        },
      },
      {
        collection: "communicationLog" as const,
        data: {
          id: crypto.randomUUID(),
          date: "2026-09-18",
          recipient: "Fixture",
          summary: "Recorded, not sent",
        },
      },
      {
        collection: "repertoire" as const,
        data: {
          id: crypto.randomUUID(),
          pieceId: "",
          title: "Synthetic request",
          moment: "Ceremony",
          status: "Requested" as const,
          notes: "",
        },
      },
      {
        collection: "musicians" as const,
        data: {
          id: crypto.randomUUID(),
          musicianId,
          name: "Synthetic catalogue musician",
          instrument: "Violin",
          confirmed: false,
          musicSent: false,
          contractRequired: false,
          signed: false,
          notes: "",
        },
      },
    ]) {
      const response = await writer.change({
        operation: "set_event_item",
        requestId: crypto.randomUUID(),
        id: second.id,
        expectedRevision: eventRevision,
        ...item,
      });
      eventRevision++;
      assert.equal((response.record as typeof second).revision, eventRevision);
      assert.deepEqual(
        (response.record as typeof second).finance,
        second.finance,
      );
    }
    const detailResponse = await writer.change({
      operation: "update_event",
      requestId: crypto.randomUUID(),
      id: second.id,
      expectedRevision: eventRevision,
      patch: {
        details: {
          rehearsal: {
            state: "Not Applicable",
            value: "",
            dueDate: "",
            trigger: "",
          },
        },
      },
    });
    assert.equal(
      (detailResponse.record as typeof second).details.rehearsal.state,
      "Not Applicable",
    );
    assert.deepEqual(
      (detailResponse.record as typeof second).details.timing,
      second.details.timing,
    );
    const newId = crypto.randomUUID();
    await writer.change({
      operation: "create_event",
      id: newId,
      expectedRevision: 0,
      requestId: crypto.randomUUID(),
      name: "Service-created event",
    });
    const pieceId = crypto.randomUUID();
    const pieceData = {
      title: "Synthetic piece",
      artist: "Fixture",
      musicUrl: "",
      genre: "Classical" as const,
      weddingSuitable: "Unreviewed" as const,
      notes: "",
    };
    await writer.change({
      operation: "save_piece",
      id: pieceId,
      expectedRevision: 0,
      requestId: crypto.randomUUID(),
      data: pieceData,
    });
    await writer.change({
      operation: "save_piece",
      id: pieceId,
      expectedRevision: 1,
      requestId: crypto.randomUUID(),
      data: { ...pieceData, notes: "Edited" },
    });
    await writer.change({
      operation: "save_musician",
      id: musicianId,
      expectedRevision: 2,
      requestId: crypto.randomUUID(),
      data: { ...musicianData, notes: "Edited through service" },
    });
    await writer.change({
      operation: "update_settings",
      expectedRevision: 2,
      requestId: crypto.randomUUID(),
      patch: { responseDays: 4 },
    });
    // Old records with operational={} still accept an unrelated name/notes edit.
    await db.exec("reset role");
    await db.query(
      "update public.hs_events set operational='{}'::jsonb where id=$1",
      [newId],
    );
    await db.exec("set role authenticated");
    await writer.change({
      operation: "update_event",
      id: newId,
      expectedRevision: 1,
      requestId: crypto.randomUUID(),
      patch: { notes: "Legacy-compatible edit" },
    });
    process.env.MCP_ENABLE_WRITES = "false";
    await db.exec("reset role; update public.hs_mcp_clients set enabled=false");
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
