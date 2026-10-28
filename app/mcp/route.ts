import {
  authenticateRequest,
  userDatabase,
  HorizonMcpError,
} from "@/lib/mcp/auth";
import { HorizonService } from "@/lib/mcp/service";
import { mcpTransport } from "@/lib/mcp/transport";
import { apiError } from "@/lib/mcp/http";
import { readLimitedBody, MCP_MAX_BYTES } from "@/lib/mcp/body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
async function handleMcp(request: Request) {
  try {
    const service = new HorizonService(
      userDatabase(await authenticateRequest(request)),
    );
    // Enforce the DB grant for initialize and tools/list too; calls recheck it.
    await service.assertAccess();
    let forwarded = request;
    if (request.method === "POST") {
      if (
        request.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== "application/json"
      )
        throw new HorizonMcpError(
          415,
          "invalid_content_type",
          "Send application/json.",
        );
      forwarded = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: await readLimitedBody(request, MCP_MAX_BYTES),
      });
    }
    const response = await mcpTransport(service)(forwarded);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    return apiError(error);
  }
}
export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
