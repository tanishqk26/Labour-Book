/**
 * LabourBook Mobile API Client
 *
 * Auth uses a Bearer token.
 * Native: expo-secure-store. Web: localStorage (SecureStore is not available).
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = Platform.select({
  web: "http://localhost:8000",
  default: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000",
}) as string;

const TOKEN_KEY = "labourbook_auth_token";
let _cachedToken: string | null = null;

function webStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function loadAuthToken(): Promise<string | null> {
  if (_cachedToken !== null) return _cachedToken;
  try {
    if (Platform.OS === "web") {
      _cachedToken = webStorage()?.getItem(TOKEN_KEY) ?? null;
    } else {
      _cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    _cachedToken = null;
  }
  return _cachedToken;
}

export async function setAuthToken(token: string): Promise<void> {
  _cachedToken = token;
  try {
    if (Platform.OS === "web") {
      webStorage()?.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch {
    // In-memory token still works for this session
  }
}

export async function clearAuthToken(): Promise<void> {
  _cachedToken = null;
  try {
    if (Platform.OS === "web") {
      webStorage()?.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

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

  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }

  const token = await loadAuthToken();
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const response = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
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

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

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
