import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { mcpConfig } from "./config";

export class HorizonMcpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export type AgentIdentity = { token: string; userId: string; clientId: string };
const remoteKeys = new Map<string, JWTVerifyGetKey>();

export async function verifyAgent(
  token: string,
  keys?: JWTVerifyGetKey,
): Promise<AgentIdentity> {
  const config = mcpConfig();
  if (!remoteKeys.has(config.issuer))
    remoteKeys.set(
      config.issuer,
      createRemoteJWKSet(new URL(`${config.issuer}/.well-known/jwks.json`)),
    );
  try {
    const { payload } = await jwtVerify(
      token,
      keys || remoteKeys.get(config.issuer)!,
      {
        issuer: config.issuer,
        audience: config.resource,
        algorithms: ["ES256", "RS256"],
        requiredClaims: ["sub", "exp", "iat", "client_id", "session_id"],
      },
    );
    if (
      payload.is_anonymous === true ||
      typeof payload.session_id !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
        payload.session_id,
      ) ||
      typeof payload.iat !== "number" ||
      payload.iat > Date.now() / 1000 + 30 ||
      payload.role !== "authenticated" ||
      typeof payload.sub !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payload.sub) ||
      typeof payload.client_id !== "string" ||
      !payload.client_id
    )
      throw new Error("Invalid identity");
    return { token, userId: payload.sub, clientId: payload.client_id };
  } catch {
    throw new HorizonMcpError(
      401,
      "unauthorised",
      "A valid dashboard OAuth token is required.",
    );
  }
}

export function userDatabase(identity: AgentIdentity) {
  const config = mcpConfig();
  return createClient(config.supabaseUrl, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${identity.token}` } },
  });
}

export async function authenticateRequest(request: Request) {
  const config = mcpConfig();
  if (!config.enabled)
    throw new HorizonMcpError(
      503,
      "disabled",
      "The dashboard MCP is not enabled.",
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== config.origin)
    throw new HorizonMcpError(
      403,
      "origin_denied",
      "This browser origin is not permitted.",
    );
  const match = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/i);
  if (!match || match[1].length > 16384)
    throw new HorizonMcpError(
      401,
      "unauthorised",
      "Sign in through dashboard OAuth.",
    );
  return verifyAgent(match[1]);
}
