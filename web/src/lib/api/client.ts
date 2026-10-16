import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/**
 * On the free hosting plan the API sleeps when idle and takes up to about a minute to wake.
 * Meanwhile the proxy answers 502/503/504, a bare 500 (its own timeout, not an API error:
 * the API always answers in JSON) or the connection drops. Those requests never reached
 * the API, so they are retried for up to ~70 s instead of failing with a vague error.
 */
function waking(res: Response): boolean {
  if ([502, 503, 504].includes(res.status)) return true;
  return res.status === 500 && !(res.headers.get("content-type") ?? "").includes("json");
}

/** Starts waking the API early (e.g. when the sign-in page opens); errors are irrelevant. */
export function wakeApi(): void {
  fetch("/api/v1/health", { cache: "no-store" }).catch(() => undefined);
}

async function wakingFetch(input: Request): Promise<Response> {
  const delays = [1500, 3000, 5000, 8000, 12000, 15000, 15000, 15000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input.clone());
      if (!waking(res) || attempt >= delays.length) return res;
    } catch (e) {
      if (attempt >= delays.length) throw e;
    }
    await new Promise((r) => setTimeout(r, delays[attempt]));
  }
}

/**
 * Typed client generated from the API's OpenAPI document (npm run gen:api).
 * Requests go to this origin; Next.js proxies /api to the backend, so the
 * session cookie stays first-party.
 */
export const api = createClient<paths>({ baseUrl: "", credentials: "same-origin", fetch: wakingFetch });

export type Schemas = components["schemas"];

export type FieldError = { field: string; message: string };

/** Problem Details (RFC 9457) returned by the API, with Azerbaijani messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: FieldError[] = []
  ) {
    super(message);
  }

  /** First message for a form field, matched on the field path suffix. */
  forField(name: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === name || e.field.endsWith(`.${name}`))?.message;
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Returns the data or throws an ApiError carrying the server's message. */
export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.ok) return data as T;
  const problem = (error ?? {}) as { title?: string; detail?: string; errors?: FieldError[] };
  throw new ApiError(
    response.status,
    problem.title ?? `http_${response.status}`,
    problem.detail ??
      ([500, 502, 503, 504].includes(response.status)
        ? "Server hazırda cavab vermir. Bir dəqiqə sonra yenidən cəhd edin."
        : "Xəta baş verdi"),
    problem.errors ?? []
  );
}
