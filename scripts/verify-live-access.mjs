// Read-only checks against the configured live project's public API.
// Run: node --env-file=.env.local scripts/verify-live-access.mjs [deployment-url]
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith("sb_publishable_")) {
  throw new Error("Configure the project URL and publishable key first.");
}
const checks = [
  ["Public event reads denied", "/rest/v1/hs_events?select=id&limit=1", {}, (response) => [401, 403].includes(response.status)],
  ["Public workspace RPC denied", "/rest/v1/rpc/hs_load_workspace", { method: "POST", body: "{}" }, (response) => [401, 403].includes(response.status)],
  ["Signup disabled and email sign-in enabled", "/auth/v1/settings", {}, (response, body) => response.ok && body.disable_signup === true && body.external?.email === true],
];
let passed = true;
for (const [label, path, options, validate] of checks) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  const ok = validate(response, body);
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (HTTP ${response.status})`);
  passed &&= ok;
}
const deploymentUrl = process.argv[2]?.replace(/\/$/, "");
if (deploymentUrl) {
  for (const method of ["GET", "POST"]) {
    const response = await fetch(`${deploymentUrl}/api/workspace`, {
      method,
      ...(method === "POST" ? { body: "{}", headers: { "Content-Type": "application/json" } } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const ok = response.status === 401 && response.headers.get("cache-control")?.includes("no-store");
    console.log(`${ok ? "PASS" : "FAIL"} Deployed anonymous ${method} denied and uncached (HTTP ${response.status})`);
    passed &&= ok;
  }
  const page = await fetch(deploymentUrl, { signal: AbortSignal.timeout(15000) });
  // The sign-in form renders after client hydration; verify its content in a browser.
  const ok = page.ok && page.headers.get("x-frame-options") === "DENY";
  console.log(`${ok ? "PASS" : "FAIL"} Deployed page available with frame protection (HTTP ${page.status})`);
  passed &&= ok;
}
if (!passed) process.exitCode = 1;
