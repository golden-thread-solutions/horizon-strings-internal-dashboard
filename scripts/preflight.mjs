const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let safeKey = !!key && key.startsWith("sb_publishable_");
if (key?.startsWith("eyJ")) {
  try {
    safeKey =
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role === "anon";
  } catch {
    safeKey = false;
  }
}
const checks = [
  [Number(process.versions.node.split(".")[0]) >= 22, "Node 22 or newer"],
  [
    !!url && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url),
    "Supabase project URL",
  ],
  [safeKey, "Supabase publishable or legacy anon key"],
  [
    !process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY,
    "No privileged Supabase key in the app environment",
  ],
];
for (const [ok, label] of checks)
  console.log(`${ok ? "PASS" : "MISSING"} ${label}`);
console.log(
  "No environment variable values are printed. Owner access and database checks still require the live smoke test.",
);
if (checks.some(([ok]) => !ok)) process.exitCode = 1;
