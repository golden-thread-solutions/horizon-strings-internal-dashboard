import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { newEvent, defaultSettings, type Dataset } from "../lib/model";
import { HorizonService } from "../lib/mcp/service";
import { mcpTransport } from "../lib/mcp/transport";
import { verifyAgent, authenticateRequest } from "../lib/mcp/auth";
import { readLimitedBody } from "../lib/mcp/body";
import { callbackUrl } from "../lib/mcp/consent";
import { GET as metadata } from "../app/.well-known/oauth-protected-resource/mcp/route";
import { POST as endpoint } from "../app/mcp/route";
import { mcpConfig } from "../lib/mcp/config";
import type { SupabaseClient } from "@supabase/supabase-js";
process.env.MCP_PUBLIC_ORIGIN = "https://horizon.example";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable";
process.env.MCP_ENABLED = "true";
const today = "2026-09-18";
function fixture(name = "Synthetic event"): Dataset {
  const e = newEvent(name, today);
  e.finance.performance = 1200;
  e.finance.travel = 100;
  e.notes = "Synthetic note";
  return {
    events: [e],
    settings: defaultSettings,
    musicians: [],
    pieces: [],
    websiteEnquiries: [],
  };
}
function service(data: Dataset, seen: string[] = []) {
  return new HorizonService({
    rpc: async (name: string) => {
      seen.push(name);
      return { data, error: null };
    },
  } as unknown as Pick<SupabaseClient, "rpc">);
}
async function rpc(
  handler: ReturnType<typeof mcpTransport>,
  method: string,
  params: unknown,
) {
  const response = await handler(
    new Request("https://horizon.example/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const body = await response.text();
  assert.equal(response.status, 200, body);
  return response.headers.get("content-type")?.includes("text/event-stream")
    ? JSON.parse(
        body
          .split("\n")
          .find((l) => l.startsWith("data:"))!
          .slice(5),
      )
    : JSON.parse(body);
}
test("real MCP transport discovers only read tools and reads complete event finance", async () => {
  const data = fixture(),
    seen: string[] = [],
    handler = mcpTransport(service(data, seen));
  data.musicians.push({
    id: crypto.randomUUID(),
    name: "Fixture violinist",
    instrument: "Violin",
    email: "player@example.com",
    phone: "",
    notes: "Fixture catalogue",
  });
  data.pieces.push({
    id: crypto.randomUUID(),
    title: "Fixture piece",
    artist: "Fixture composer",
    musicUrl: "https://example.com/music",
    genre: "Classical",
    weddingSuitable: "Yes",
    notes: "",
  });
  data.websiteEnquiries.push({
    id: crypto.randomUUID(),
    createdAt: "2026-09-18T00:00:00Z",
    name: "Fixture enquirer",
    email: "enquiry@example.com",
    phone: "",
    preferredContact: "email",
    eventDate: "",
    venue: "",
    area: "",
    message: "Fixture message",
    weddingPackage: "",
    requestedEnsemble: "",
    emailStatus: "pending",
    dashboardStatus: "new",
    dashboardEventId: "",
  });
  assert.equal(
    (
      await rpc(handler, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1" },
      })
    ).result.serverInfo.name,
    "horizon-strings-dashboard",
  );
  const tools = (await rpc(handler, "tools/list", {})).result.tools;
  assert.deepEqual(
    tools.map((t: { name: string }) => t.name).sort(),
    [
      "fetch",
      "get_event",
      "get_settings",
      "list_actions",
      "list_directory",
      "list_events",
      "list_website_enquiries",
      "search",
    ].sort(),
  );
  assert.ok(
    tools.every(
      (t: {
        annotations: { readOnlyHint: boolean; destructiveHint: boolean };
      }) => t.annotations.readOnlyHint && !t.annotations.destructiveHint,
    ),
  );
  const list = await rpc(handler, "tools/call", {
    name: "list_events",
    arguments: { query: "synthetic" },
  });
  const listed = JSON.parse(list.result.content[0].text);
  assert.equal(listed.records[0].totalFee, 1300);
  const full = await rpc(handler, "tools/call", {
    name: "get_event",
    arguments: { id: data.events[0].id },
  });
  assert.equal(
    JSON.parse(full.result.content[0].text).event.notes,
    "Synthetic note",
  );
  for (const [name, args] of [
    ["list_actions", {}],
    ["list_directory", { kind: "musicians" }],
    ["list_directory", { kind: "repertoire" }],
    ["list_website_enquiries", {}],
  ] as const) {
    const result = await rpc(handler, "tools/call", { name, arguments: args });
    assert.equal(JSON.parse(result.result.content[0].text).records.length, 1);
  }
  const settingsResult = await rpc(handler, "tools/call", {
    name: "get_settings",
    arguments: {},
  });
  assert.equal(
    JSON.parse(settingsResult.result.content[0].text).timezone,
    "Australia/Sydney",
  );
  const forbidden = await rpc(handler, "tools/call", {
    name: "save_event",
    arguments: {},
  });
  assert.ok(forbidden.error || forbidden.result.isError);
  const extra = await rpc(handler, "tools/call", {
    name: "get_settings",
    arguments: { operation: "delete" },
  });
  assert.ok(extra.error || extra.result.isError);
  assert.deepEqual([...new Set(seen)], ["hs_mcp_read_workspace"]);
});
test("lists page without losing archived records and search/fetch remain caller-bound", async () => {
  const data = fixture("Alpha"),
    archived = newEvent("Archived example", today);
  archived.archived = true;
  data.events.push(archived);
  const a = service(data),
    b = service(fixture("Other owner snapshot"));
  assert.equal((await a.events({})).total, 1);
  const page = await a.events({ includeArchived: true, limit: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.nextOffset, 1);
  assert.equal(
    (await a.events({ includeArchived: true, limit: 1, offset: 1 })).nextOffset,
    null,
  );
  const found = await a.search("archived");
  assert.equal(found.results.length, 1);
  assert.ok(
    (await a.fetch(found.results[0].id)).text.includes("Archived example"),
  );
  await assert.rejects(b.fetch(found.results[0].id), /Record not found/);
  await assert.rejects(a.fetch("https://untrusted.example"), /Use an ID/);
  await assert.rejects(a.events({ offset: -1 }));
  await assert.rejects(
    new HorizonService({
      rpc: async () => ({ data: null, error: { code: "42501" } }),
    } as unknown as Pick<SupabaseClient, "rpc">).settings(),
    /revoked/,
  );
});
test("OAuth signatures, resource audience, issuer, expiry and identity are checked", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "fixture";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const token = async (overrides: Record<string, unknown> = {}) =>
    new SignJWT({
      role: "authenticated",
      client_id: "fixture-client",
      session_id: "22222222-2222-4222-8222-222222222222",
      sub: "11111111-1111-4111-8111-111111111111",
      iss: "https://database.example/auth/v1",
      aud: "https://horizon.example/mcp",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...overrides,
    })
      .setProtectedHeader({ alg: "ES256", kid: "fixture" })
      .sign(privateKey);
  assert.equal(
    (await verifyAgent(await token(), keys)).clientId,
    "fixture-client",
  );
  for (const changed of [
    { client_id: undefined },
    { aud: "authenticated" },
    { iss: "https://other.example" },
    { exp: 1 },
    { session_id: undefined },
    { role: "service_role" },
    { is_anonymous: true },
    { iat: Math.floor(Date.now() / 1000) + 1000 },
  ])
    await assert.rejects(verifyAgent(await token(changed), keys));
  await assert.rejects(
    authenticateRequest(new Request("https://horizon.example/mcp")),
    (e) => (e as { status: number }).status === 401,
  );
  await assert.rejects(
    authenticateRequest(
      new Request("https://horizon.example/mcp", {
        headers: { origin: "https://evil.example" },
      }),
    ),
    (e) => (e as { status: number }).status === 403,
  );
});
test("metadata/challenge, disabled endpoint, body limits and callback validation fail closed", async () => {
  assert.equal(
    (await metadata().json()).resource,
    "https://horizon.example/mcp",
  );
  const response = await endpoint(
    new Request("https://horizon.example/mcp", { method: "POST", body: "{}" }),
  );
  assert.equal(response.status, 401);
  assert.ok(
    response.headers
      .get("www-authenticate")
      ?.includes("/.well-known/oauth-protected-resource/mcp"),
  );
  assert.equal(
    await readLimitedBody(
      new Request("https://horizon.example", { method: "POST", body: "{}" }),
      2,
    ),
    "{}",
  );
  await assert.rejects(
    readLimitedBody(
      new Request("https://horizon.example", {
        method: "POST",
        body: "x".repeat(10),
      }),
      9,
    ),
  );
  assert.equal(
    callbackUrl("https://chatgpt.com/callback?code=fixture"),
    "https://chatgpt.com/callback?code=fixture",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "http://remote.example",
  ])
    assert.throws(() => callbackUrl(url));
  process.env.MCP_ENABLED = "false";
  try {
    assert.equal(
      (await endpoint(new Request("https://horizon.example/mcp"))).status,
      503,
    );
    assert.equal(metadata().status, 503);
  } finally {
    process.env.MCP_ENABLED = "true";
  }
  process.env.MCP_PUBLIC_ORIGIN = "https://horizon.example/path";
  try {
    assert.throws(() => mcpConfig());
  } finally {
    process.env.MCP_PUBLIC_ORIGIN = "https://horizon.example";
  }
});
