import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/**
 * Typed client generated from the API's OpenAPI document (npm run gen:api).
 * Requests go to this origin; Next.js proxies /api to the backend, so the
 * session cookie stays first-party.
 */
export const api = createClient<paths>({ baseUrl: "", credentials: "same-origin" });

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
    problem.detail ?? "Xəta baş verdi",
    problem.errors ?? []
  );
}
