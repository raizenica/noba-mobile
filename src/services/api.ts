// Copyright (c) 2024-2026 Kevin Van Nieuwenhove. All rights reserved.
// NOBA Command Center — Licensed under Apache 2.0.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER = '@noba_server_url';
const STORAGE_KEY_TOKEN = '@noba_token';

let _serverUrl = '';
let _token = '';

export async function loadConfig(): Promise<void> {
  _serverUrl = (await AsyncStorage.getItem(STORAGE_KEY_SERVER)) || '';
  _token = (await AsyncStorage.getItem(STORAGE_KEY_TOKEN)) || '';
}

export async function setServer(url: string): Promise<void> {
  _serverUrl = url.replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEY_SERVER, _serverUrl);
}

export async function setToken(token: string): Promise<void> {
  _token = token;
  await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export async function clearAuth(): Promise<void> {
  _token = '';
  await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
}

export function getServerUrl(): string {
  return _serverUrl;
}

export function getToken(): string {
  return _token;
}

export function isConfigured(): boolean {
  return !!_serverUrl;
}

export function isAuthenticated(): boolean {
  return !!_token;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  timeout?: number;
}

export async function api<T = any>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {method = 'GET', body, timeout = 15000} = options;

  if (!_serverUrl) {
    throw new Error('Server not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (_token) {
      headers.Authorization = `Bearer ${_token}`;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await fetch(`${_serverUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (resp.status === 401) {
      await clearAuth();
      throw new Error('Session expired');
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.detail || `HTTP ${resp.status}`);
    }

    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await resp.json()) as T;
    }
    return (await resp.text()) as unknown as T;
  } finally {
    clearTimeout(timer);
  }
}

// Convenience methods
export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, {method: 'POST', body});
export const del = <T = any>(path: string) =>
  api<T>(path, {method: 'DELETE'});

/** Called by authStore after hydration to sync module-level vars without re-reading AsyncStorage. */
export function syncState(serverUrl: string, token: string): void {
  _serverUrl = serverUrl.replace(/\/+$/, '');
  _token = token;
}
