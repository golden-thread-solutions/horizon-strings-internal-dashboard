import assert from "node:assert/strict";

// Runs only against the freshly created, synthetic cluster supplied by the
// rehearsal driver. No credentials or production connection URLs are accepted.
export async function regressAbsentRowRaces({ admin, a, b, claims, mutate }) {
  const observations = [];
  const identity = async (c, human = false) => {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(
        human
          ? { ...claims, client_id: undefined, aud: "authenticated" }
          : claims,
      ),
    ]);
    await c.query("set role authenticated");
  };
  const snapshot = async (c) => {
    const role = (await c.query("select current_user as role")).rows[0].role;
    await c.query("reset role");
    try {
      const state = {};
      const tables = await c.query(`select schemaname,tablename from pg_tables
        where (schemaname='public' and tablename like 'hs_%') or schemaname='hs_mcp_private'
        order by schemaname,tablename`);
      for (const { schemaname, tablename } of tables.rows) {
        // Names come only from this synthetic database's catalog.
        const ident = (v) => `"${v.replaceAll('"', '""')}"`;
        state[`${schemaname}.${tablename}`] = (
          await c.query(
            `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from ${ident(schemaname)}.${ident(tablename)} t`,
          )
        ).rows[0].rows;
      }
      return state;
    } finally {
      await c.query(`set role "${role.replaceAll('"', '""')}"`);
    }
  };
  const command = (operation, id, expectedRevision, data) => ({
    operation,
    id,
    expectedRevision,
    data,
    requestId: crypto.randomUUID(),
  });
  const ownerSave = async (c, e) =>
    (
      await c.query("select public.hs_save_event($1::jsonb) record", [
        JSON.stringify(e),
      ])
    ).rows[0].record;
  const readable = async () => {
    await identity(a);
    const w = (await a.query("select public.hs_mcp_read_workspace() w")).rows[0]
      .w;
    assert.ok(
      w.settings &&
        Array.isArray(w.events) &&
        Array.isArray(w.musicians) &&
        Array.isArray(w.pieces),
    );
    for (const e of w.events)
      for (const key of [
        "contacts",
        "tasks",
        "communicationLog",
        "musicians",
        "repertoire",
      ])
        assert.ok(Array.isArray(e[key]));
    for (const e of w.events)
      assert.ok(e.finance && e.details && Number.isInteger(e.revision));
  };
  const rejectedRace = async ({
    label,
    first,
    second,
    firstHuman = false,
    secondHuman = false,
    rejectedCommand,
    retryCommand,
    codes,
  }) => {
    await identity(a, firstHuman);
    await identity(b, secondHuman);
    await a.query("begin");
    let waiting;
    try {
      const original = await first(a);
      // This sees the winner's uncommitted rows, including its audit/receipt.
      const expected = await snapshot(a);
      let settled = false;
      waiting = second(b).then(
        (result) => {
          settled = true;
          return { result };
        },
        (error) => {
          settled = true;
          return { error };
        },
      );
      let observed;
      for (let i = 0; i < 300; i++) {
        const s = await admin.query(
          `select wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity
          where pid=$1 and wait_event_type='Lock'`,
          [b.processID],
        );
        if (s.rows[0]?.blockers.includes(a.processID)) {
          observed = s.rows[0];
          break;
        }
        if (settled) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(
        observed,
        `${label}: expected the second backend to wait on the first backend`,
      );
      assert.equal(
        settled,
        false,
        `${label}: second call must be blocked before first commits`,
      );
      await a.query("commit");
      const rejected = await waiting;
      assert.ok(
        rejected.error,
        `${label}: second writer must reject, not report success`,
      );
      assert.ok(
        codes.includes(rejected.error.code),
        `${label}: unexpected SQLSTATE ${rejected.error.code}`,
      );
      assert.deepEqual(
        await snapshot(admin),
        expected,
        `${label}: rejected writer changed business rows/revisions/audit/receipts/activity`,
      );
      if (rejectedCommand) {
        await admin.query("reset role");
        const evidence = await admin.query(
          `select
          (select count(*)::int from hs_mcp_private.receipts where request_id=$1) receipts,
          (select count(*)::int from hs_mcp_private.activity where request_id=$1) activity`,
          [rejectedCommand.requestId],
        );
        assert.deepEqual(evidence.rows[0], { receipts: 0, activity: 0 });
      }
      if (retryCommand) {
        await identity(a);
        assert.deepEqual(
          await mutate(a, retryCommand),
          original,
          `${label}: exact winner retry must return original result`,
        );
        assert.deepEqual(
          await snapshot(admin),
          expected,
          `${label}: exact retry repeated an effect`,
        );
      }
      await readable();
      observations.push({
        case: label,
        lockWait: observed.wait_event,
        rejected: rejected.error.code,
        unchanged: "all business tables/revisions/audit/receipts/activity",
      });
    } finally {
      await a.query("rollback");
      if (waiting) await waiting;
    }
  };

  const childTypes = [
    {
      operation: "upsert_event_contact",
      collection: "contacts",
      data: (id, label) => ({
        id,
        role: "Main",
        name: label,
        email: "",
        phone: "",
        notes: "Synthetic only",
      }),
    },
    {
      operation: "upsert_event_task",
      collection: "tasks",
      data: (id, label) => ({
        id,
        title: label,
        kind: "Task",
        dueDate: "2027-01-01",
        assignee: "",
        recipient: "",
        notes: "",
        done: false,
        completedAt: "",
      }),
    },
    {
      operation: "record_event_communication",
      collection: "communicationLog",
      data: (id, label) => ({
        id,
        date: "2026-09-18",
        recipient: "Synthetic",
        summary: label,
      }),
    },
    {
      operation: "upsert_event_musician",
      collection: "musicians",
      data: (id, label) => ({
        id,
        musicianId: "",
        name: label,
        instrument: "Violin",
        confirmed: false,
        musicSent: false,
        contractRequired: false,
        signed: false,
        notes: "",
      }),
    },
    {
      operation: "upsert_event_repertoire",
      collection: "repertoire",
      data: (id, label) => ({
        id,
        pieceId: "",
        title: label,
        moment: "Ceremony",
        status: "Requested",
        notes: "",
      }),
    },
  ];
  const withOwnerMoney = (spec, data) =>
    spec.collection === "musicians" ? { ...data, fee: 375, paid: true } : data;
  const fixtureEvent = async (spec, targetId) => {
    await identity(a);
    const created = await mutate(
      a,
      command("create_event", crypto.randomUUID(), 0, {
        name: `Synthetic ${spec.collection}`,
      }),
    );
    const e = created.record;
    e.finance.performance = 1250;
    e[spec.collection] = [
      withOwnerMoney(spec, spec.data(crypto.randomUUID(), "Preserved sibling")),
    ];
    if (targetId)
      e[spec.collection].push(
        withOwnerMoney(spec, spec.data(targetId, "Existing target")),
      );
    await identity(a, true);
    return ownerSave(a, e);
  };
  const ownerChild = (spec, e, data) => ({
    ...e,
    [spec.collection]: [
      ...e[spec.collection].filter((c) => c.id !== data.id),
      withOwnerMoney(spec, data),
    ],
  });
  for (const spec of childTypes) {
    for (const [firstMode, secondMode] of [
      ["mcp", "mcp"],
      ["owner", "mcp"],
      ["mcp", "owner"],
    ]) {
      const parentA = await fixtureEvent(spec),
        parentB = await fixtureEvent(spec),
        childId = crypto.randomUUID();
      const firstData = spec.data(childId, "First parent winner"),
        secondData = spec.data(childId, "Wrong-parent loser");
      const firstCommand = command(
        spec.operation,
        parentA.id,
        parentA.revision,
        firstData,
      );
      const secondCommand = command(
        spec.operation,
        parentB.id,
        parentB.revision,
        secondData,
      );
      await rejectedRace({
        label: `${spec.operation}:cross-parent:${firstMode}/${secondMode}`,
        first: (c) =>
          firstMode === "mcp"
            ? mutate(c, firstCommand)
            : ownerSave(c, ownerChild(spec, parentA, firstData)),
        second: (c) =>
          secondMode === "mcp"
            ? mutate(c, secondCommand)
            : ownerSave(c, ownerChild(spec, parentB, secondData)),
        firstHuman: firstMode === "owner",
        secondHuman: secondMode === "owner",
        rejectedCommand: secondMode === "mcp" ? secondCommand : undefined,
        retryCommand: firstMode === "mcp" ? firstCommand : undefined,
        codes: ["23505"],
      });
    }
    for (const [firstMode, secondMode] of [
      ["mcp", "mcp"],
      ["owner", "mcp"],
      ["mcp", "owner"],
    ]) {
      const childId = crypto.randomUUID(),
        e = await fixtureEvent(spec, childId);
      const firstData = spec.data(childId, "Same-parent winner"),
        secondData = spec.data(childId, "Stale loser");
      const firstCommand = command(spec.operation, e.id, e.revision, firstData);
      const secondCommand = command(
        spec.operation,
        e.id,
        e.revision,
        secondData,
      );
      await rejectedRace({
        label: `${spec.operation}:same-parent-stale:${firstMode}/${secondMode}`,
        first: (c) =>
          firstMode === "mcp"
            ? mutate(c, firstCommand)
            : ownerSave(c, ownerChild(spec, e, firstData)),
        second: (c) =>
          secondMode === "mcp"
            ? mutate(c, secondCommand)
            : ownerSave(c, ownerChild(spec, e, secondData)),
        firstHuman: firstMode === "owner",
        secondHuman: secondMode === "owner",
        rejectedCommand: secondMode === "mcp" ? secondCommand : undefined,
        retryCommand: firstMode === "mcp" ? firstCommand : undefined,
        codes: ["40001"],
      });
    }
  }

  const directories = [
    {
      operation: "upsert_musician",
      table: "hs_musicians",
      columns: ["name", "instrument", "email", "phone", "notes"],
      data: (label) => ({
        name: label,
        instrument: "Violin",
        email: "",
        phone: "",
        notes: "",
      }),
    },
    {
      operation: "upsert_piece",
      table: "hs_pieces",
      columns: [
        "title",
        "artist",
        "musicUrl",
        "genre",
        "weddingSuitable",
        "notes",
      ],
      data: (label) => ({
        title: label,
        artist: "Synthetic",
        musicUrl: "",
        genre: "Classical",
        weddingSuitable: "Unreviewed",
        notes: "",
      }),
    },
  ];
  const ownerUpsert = async (c, spec, id, data) =>
    (
      await c.query(
        `insert into public.${spec.table} as t
    select * from jsonb_populate_record(null::public.${spec.table},$1)
    on conflict(id) do update set ${spec.columns.map((k) => `"${k}"=excluded."${k}"`).join(",")}
    returning to_jsonb(t) record`,
        [JSON.stringify({ id, ...data, revision: 1 })],
      )
    ).rows[0].record;
  for (const spec of directories) {
    for (const firstMode of ["mcp", "owner"]) {
      const id = crypto.randomUUID();
      const firstCommand = command(
        spec.operation,
        id,
        0,
        spec.data("First creator"),
      );
      const secondCommand = command(
        spec.operation,
        id,
        0,
        spec.data("Conflicting creator"),
      );
      await rejectedRace({
        label: `${spec.operation}:create:${firstMode}/mcp`,
        first: (c) =>
          firstMode === "mcp"
            ? mutate(c, firstCommand)
            : ownerUpsert(c, spec, id, firstCommand.data),
        second: (c) => mutate(c, secondCommand),
        firstHuman: firstMode === "owner",
        rejectedCommand: secondCommand,
        retryCommand: firstMode === "mcp" ? firstCommand : undefined,
        codes: ["23505"],
      });
    }
    for (const firstMode of ["mcp", "owner"]) {
      await identity(a);
      const id = crypto.randomUUID();
      const initial = await mutate(
        a,
        command(spec.operation, id, 0, spec.data("Original directory")),
      );
      const firstCommand = command(
        spec.operation,
        id,
        initial.revision,
        spec.data("Winning directory update"),
      );
      const secondCommand = command(
        spec.operation,
        id,
        initial.revision,
        spec.data("Stale directory update"),
      );
      await rejectedRace({
        label: `${spec.operation}:stale-update:${firstMode}/mcp`,
        first: (c) =>
          firstMode === "mcp"
            ? mutate(c, firstCommand)
            : ownerUpsert(c, spec, id, firstCommand.data),
        second: (c) => mutate(c, secondCommand),
        firstHuman: firstMode === "owner",
        rejectedCommand: secondCommand,
        retryCommand: firstMode === "mcp" ? firstCommand : undefined,
        codes: ["40001"],
      });
    }
    // Ordinary dashboard upserts intentionally retain last-successful-save
    // behavior. Their trigger must advance revision and invalidate stale MCP edits.
    await identity(a);
    await identity(b, true);
    const id = crypto.randomUUID(),
      create = command(spec.operation, id, 0, spec.data("MCP creator"));
    await a.query("begin");
    let waiting;
    try {
      const original = await mutate(a, create);
      let settled = false;
      waiting = ownerUpsert(
        b,
        spec,
        id,
        spec.data("Ordinary owner upsert"),
      ).then((result) => {
        settled = true;
        return result;
      });
      let observed;
      for (let i = 0; i < 300; i++) {
        const s = await admin.query(
          "select wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1 and wait_event_type='Lock'",
          [b.processID],
        );
        if (s.rows[0]?.blockers.includes(a.processID)) {
          observed = s.rows[0];
          break;
        }
        if (settled) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(observed);
      assert.equal(settled, false);
      await a.query("commit");
      const human = await waiting;
      assert.deepEqual(human, {
        ...original.record,
        ...spec.data("Ordinary owner upsert"),
        revision: 2,
      });
      const expected = await snapshot(admin);
      assert.deepEqual(await mutate(a, create), original);
      const stale = command(
        spec.operation,
        id,
        original.revision,
        spec.data("Stale after owner"),
      );
      await assert.rejects(mutate(a, stale), (e) => e.code === "40001");
      assert.deepEqual(await snapshot(admin), expected);
      await readable();
      observations.push({
        case: `${spec.operation}:ordinary-owner-after-mcp`,
        lockWait: observed.wait_event,
        ownerRevision: 2,
        staleMcp: "40001",
        exactRetry: "original result, no effects",
      });
    } finally {
      await a.query("rollback");
      if (waiting) await waiting;
    }
  }
  await identity(a);
  await identity(b);
  for (const observation of observations)
    console.log(JSON.stringify(observation));
  assert.equal(observations.length, 40);
  return observations.length;
}
