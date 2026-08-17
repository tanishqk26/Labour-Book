/**
 * LabourBook API Client
 *
 * Base fetch wrapper that reads NEXT_PUBLIC_API_URL from environment.
 * All API calls throughout the app should go through these helpers.
 *
 * Usage:
 *   import { apiFetch, apiGet, apiPost } from "@/lib/api";
 *
 *   const data = await apiGet("/health");
 *   const labour = await apiPost("/api/v1/labours", { name: "Deepak", ... });
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// -------------------------------------------------------------------------
// Core fetch wrapper
// -------------------------------------------------------------------------

interface ApiFetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { params, headers, ...rest } = options;

  // Build URL with optional query params
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// -------------------------------------------------------------------------
// HTTP method helpers
// -------------------------------------------------------------------------

export const apiGet = <T = unknown>(
  path: string,
  params?: ApiFetchOptions["params"]
) => apiFetch<T>(path, { method: "GET", params });

export const apiPost = <T = unknown>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const apiPut = <T = unknown>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const apiPatch = <T = unknown>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const apiDelete = <T = unknown>(path: string) =>
  apiFetch<T>(path, { method: "DELETE" });
