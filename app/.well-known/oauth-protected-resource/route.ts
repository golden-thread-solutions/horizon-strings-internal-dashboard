import { mcpConfig } from "@/lib/mcp/config";
import { apiError } from "@/lib/mcp/http";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    const config = mcpConfig();
    if (!config.enabled)
      return Response.json(
        { error: "MCP is disabled" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      {
        resource: config.resource,
        resource_name: "Horizon Strings dashboard",
        authorization_servers: [config.issuer],
        bearer_methods_supported: ["header"],
        scopes_supported: ["openid"],
        resource_documentation: `${config.origin}/oauth/consent`,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
