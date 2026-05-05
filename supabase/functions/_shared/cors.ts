// Shared CORS helper for edge functions called by the Ditt web app.
// Webhooks (auth-email-hook, handle-email-*, etc) MUST NOT use this — they
// receive requests from external servers and need an open CORS policy.

const ALLOWED_ORIGINS = [
  "https://mobilefix.dev",
  "https://www.mobilefix.dev",
  "https://smart-repairs-hub.lovable.app",
  "https://id-preview--e3694ec1-6193-47c4-8976-db44c7371a52.lovable.app",
  "https://e3694ec1-6193-47c4-8976-db44c7371a52.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
];

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type";

/**
 * Returns CORS headers for the given request, echoing the origin only when it
 * is on the allow-list. Unknown origins receive a non-matching value so the
 * browser will block the response.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function preflightResponse(req: Request): Response {
  return new Response(null, { headers: getCorsHeaders(req) });
}
