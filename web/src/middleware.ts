import { NextResponse, type NextRequest } from "next/server";

import { clientIp } from "@/lib/client-ip";

/**
 * Requests to /api are proxied to the backend, which then sees this server, not the visitor.
 * The proxy passes the visitor's address in X-Portal-Client-Ip together with a secret shared
 * with the API (PORTAL_PROXY_SECRET), so the API's per-address sign-in and registration limits
 * count real visitors and cannot be dodged with a forged X-Forwarded-For. Headers of that name
 * arriving from outside are always dropped.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-portal-client-ip");
  headers.delete("x-portal-proxy-secret");
  const secret = process.env.PORTAL_PROXY_SECRET;
  if (secret) {
    headers.set("x-portal-client-ip", clientIp(request.headers));
    headers.set("x-portal-proxy-secret", secret);
  }
  return NextResponse.next({ request: { headers } });
}

// The assistant route runs here and limits by address itself.
export const config = { matcher: ["/api/((?!assistant).*)"] };
