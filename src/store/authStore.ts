/**
 * Auth store — single source of truth for server URL, token, and auth methods.
 * Wraps api.ts for all persistence (AsyncStorage via api.ts existing keys).
 * Components subscribe here for reactive updates; api.ts module vars stay in sync.
 */
import {create} from 'zustand';
import {
  getServerUrl,
  getToken,
  setServer,
  setToken,
  clearAuth,
  syncState,
} from '../services/api';

export interface AuthMethod {
  type: string;
  display_name: string;
}

interface AuthState {
  serverUrl: string;
  token: string;
  methods: AuthMethod[];
  /** True once loadConfig() has run and store is hydrated from AsyncStorage. */
  isReady: boolean;
  /** Call after api.loadConfig() resolves to sync store from AsyncStorage. */
  hydrate: () => void;
  setServerUrl: (url: string) => Promise<void>;
  setAuth: (token: string) => Promise<void>;
  setMethods: (methods: AuthMethod[]) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  serverUrl: '',
  token: '',
  methods: [{type: 'local', display_name: 'Sign in'}],
  isReady: false,

  hydrate: () => {
    set({serverUrl: getServerUrl(), token: getToken(), isReady: true});
  },

  setServerUrl: async (url) => {
    await setServer(url);
    set({serverUrl: url});
  },

  setAuth: async (token) => {
    await setToken(token);
    set({token});
  },

  setMethods: (methods) => set({methods}),

  logout: async () => {
    await clearAuth();
    syncState('', '');
    set({token: ''});
  },
}));
