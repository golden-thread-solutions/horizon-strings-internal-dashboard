export function mcpConfig() {
  const origin = process.env.MCP_PUBLIC_ORIGIN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!origin || !supabaseUrl || !key)
    throw new Error("MCP configuration is incomplete");
  const publicUrl = new URL(origin);
  if (
    publicUrl.protocol !== "https:" &&
    !(
      publicUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(publicUrl.hostname)
    )
  )
    throw new Error("MCP requires HTTPS");
  if (
    publicUrl.pathname !== "/" ||
    publicUrl.search ||
    publicUrl.hash ||
    publicUrl.username ||
    publicUrl.password
  )
    throw new Error("MCP_PUBLIC_ORIGIN must be an origin");
  return {
    origin: publicUrl.origin,
    resource: `${publicUrl.origin}/mcp`,
    supabaseUrl,
    issuer: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
    key,
    enabled: process.env.MCP_ENABLED === "true",
  };
}
