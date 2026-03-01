const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const ALLOWED_HOSTS = new Set([
  "api-open.data.gov.sg",
  "s3.ap-southeast-1.amazonaws.com",
  "blobs.data.gov.sg",
]);

function withCors(upstreamHeaders) {
  const headers = new Headers(upstreamHeaders || {});
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set("Vary", "Origin");
  return headers;
}

function badRequest(message, status = 400) {
  return new Response(message, {
    status,
    headers: withCors({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return badRequest("Only GET/HEAD supported", 405);
    }

    const incoming = new URL(request.url);
    const rawUrl = incoming.searchParams.get("url");
    if (!rawUrl) return badRequest("Missing ?url=");

    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      return badRequest("Invalid url");
    }

    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return badRequest("Host not allowed", 403);
    }

    try {
      const upstream = await fetch(target.toString(), {
        method: request.method,
        headers: { "User-Agent": "sqkiimapper-proxy/1.0" },
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: withCors(upstream.headers),
      });
    } catch (err) {
      return badRequest(`Upstream fetch failed: ${String(err?.message || err)}`, 502);
    }
  },
};
