import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { HorizonService } from "../lib/mcp/service";
import { mcpTransport } from "../lib/mcp/transport";
import { writeInputs, type WriteOperation } from "../lib/mcp/commands";
import { POST as workspacePost } from "../app/api/workspace/route";
process.env.MCP_PUBLIC_ORIGIN = "https://horizon.example";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable";
process.env.MCP_ENABLED = "true";
async function rpc(
  handler: ReturnType<typeof mcpTransport>,
  name: string,
  args: unknown,
) {
  const response = await handler(
    new Request("https://horizon.example/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  const body = await response.text();
  return response.headers.get("content-type")?.includes("text/event-stream")
    ? JSON.parse(
        body
          .split("\n")
          .find((l) => l.startsWith("data:"))!
          .slice(5),
      )
    : JSON.parse(body);
}
test("all ten write tools enforce the application switch and forward exact bounded commands", async () => {
  const id = crypto.randomUUID(),
    base = { id, expectedRevision: 1, requestId: crypto.randomUUID() };
  const examples: Record<WriteOperation, unknown> = {
    create_event: { ...base, expectedRevision: 0, data: { name: "Synthetic" } },
    update_event: { ...base, data: { notes: "Synthetic" } },
    upsert_event_contact: {
      ...base,
      data: {
        id: crypto.randomUUID(),
        role: "Main",
        name: "Synthetic",
        email: "",
        phone: "",
        notes: "",
      },
    },
    upsert_event_task: {
      ...base,
      data: {
        id: crypto.randomUUID(),
        title: "Synthetic",
        kind: "Communication",
        dueDate: "2027-01-01",
        assignee: "",
        recipient: "Synthetic",
        notes: "",
        done: false,
        completedAt: "",
      },
    },
    record_event_communication: {
      ...base,
      data: {
        id: crypto.randomUUID(),
        date: "2026-09-18",
        recipient: "Synthetic",
        summary: "Recorded, never sent",
      },
    },
    upsert_event_musician: {
      ...base,
      data: {
        id: crypto.randomUUID(),
        musicianId: "",
        name: "Synthetic",
        instrument: "Violin",
        confirmed: false,
        musicSent: false,
        contractRequired: false,
        signed: false,
        notes: "",
      },
    },
    upsert_event_repertoire: {
      ...base,
      data: {
        id: crypto.randomUUID(),
        pieceId: "",
        title: "Synthetic",
        moment: "",
        status: "Requested",
        notes: "",
      },
    },
    upsert_musician: {
      ...base,
      data: {
        name: "Synthetic",
        instrument: "Violin",
        email: "",
        phone: "",
        notes: "",
      },
    },
    upsert_piece: {
      ...base,
      data: {
        title: "Synthetic",
        artist: "Synthetic",
        musicUrl: "",
        genre: "",
        weddingSuitable: "Unreviewed",
        notes: "",
      },
    },
    update_workflow_settings: {
      requestId: crypto.randomUUID(),
      expectedRevision: 1,
      data: { musiciansWeeks: 8 },
    },
  };
  const calls: { name: string; args: unknown }[] = [];
  const service = new HorizonService({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: { revision: 2 }, error: null };
    },
  } as unknown as Pick<SupabaseClient, "rpc">);
  const handler = mcpTransport(service);
  process.env.MCP_WRITE_ENABLED = "false";
  for (const [operation, args] of Object.entries(examples)) {
    const denied = await rpc(handler, operation, args);
    assert.equal(denied.result.isError, true);
    assert.match(denied.result.content[0].text, /writes_disabled/);
  }
  assert.equal(calls.length, 0);
  process.env.MCP_WRITE_ENABLED = "true";
  for (const [operation, args] of Object.entries(examples)) {
    const result = await rpc(handler, operation, args);
    assert.ok(!result.result.isError);
    assert.deepEqual(calls.at(-1), {
      name: "hs_mcp_mutate",
      args: { p_command: { operation, ...(args as object) } },
    });
  }
  assert.equal(calls.length, Object.keys(writeInputs).length);
  const before = calls.length;
  const malformed = await rpc(handler, "update_event", {
    ...base,
    data: { milestones: { responded: null } },
  });
  assert.ok(malformed.error || malformed.result?.isError);
  assert.equal(calls.length, before);
  process.env.MCP_WRITE_ENABLED = "false";
});
test("ordinary owner API rejects delegated identity before any write RPC", async () => {
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  const user = crypto.randomUUID();
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: user,
        email: "synthetic@example.com",
        role: "authenticated",
      });
    if (url.includes("/rest/v1/hs_owners")) return Response.json([]);
    throw new Error("Unexpected network request");
  };
  try {
    const response = await workspacePost(
      new NextRequest("https://horizon.example/api/workspace", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic-delegated-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operation: "event", data: {} }),
      }),
    );
    assert.equal(response.status, 403);
    assert.ok(seen.some((u) => u.includes("hs_owners")));
    assert.ok(seen.every((u) => !u.includes("/rpc/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
