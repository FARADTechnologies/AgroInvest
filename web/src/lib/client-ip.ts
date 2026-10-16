/**
 * The visitor's address as the hosting edge saw it.
 *
 * On Render every request passes Cloudflare, which sets CF-Connecting-IP itself and overwrites
 * whatever the client sent; locally the nginx gateway sets X-Real-IP the same way. The leftmost
 * X-Forwarded-For entry is written by the client and must never be trusted, so the fallback is
 * the rightmost entry, the one added by the nearest proxy.
 */
export function clientIp(headers: Headers): string {
  const edge = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (edge?.trim()) return edge.trim();
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] ?? "local";
}
