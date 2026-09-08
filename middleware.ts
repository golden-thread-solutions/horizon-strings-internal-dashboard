import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  if (!password) {
    return NextResponse.next();
  }

  const username = process.env.DASHBOARD_USERNAME || "horizon";
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    try {
      const encoded = authHeader.slice("Basic ".length);
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const suppliedUsername = decoded.slice(0, separatorIndex);
      const suppliedPassword = decoded.slice(separatorIndex + 1);

      if (suppliedUsername === username && suppliedPassword === password) {
        return NextResponse.next();
      }
    } catch {
      return unauthorized();
    }
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Horizon Strings Operations"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
