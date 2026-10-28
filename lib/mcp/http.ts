import { ZodError } from "zod";
import { HorizonMcpError } from "./auth";
import { mcpConfig } from "./config";

export function apiError(error: unknown) {
  const known = error instanceof HorizonMcpError;
  const status = known ? error.status : error instanceof ZodError ? 400 : 503;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 401) {
    try {
      headers["WWW-Authenticate"] =
        `Bearer resource_metadata="${mcpConfig().origin}/.well-known/oauth-protected-resource/mcp"`;
    } catch {
      /* No untrusted host fallback. */
    }
  }
  return Response.json(
    {
      error: {
        code: known
          ? error.code
          : status === 400
            ? "invalid_input"
            : "unavailable",
        message: known
          ? error.message
          : status === 400
            ? "Invalid request fields."
            : "Dashboard integration is unavailable.",
        details: known ? error.details : undefined,
      },
    },
    { status, headers },
  );
}
