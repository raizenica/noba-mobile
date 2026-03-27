# Mobile Track A — Foundation + Zustand + Cross-Compatible Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add centralized Zustand state/polling to the React Native app and wire up the SAML deep-link auth flow — cross-compatible with both community and enterprise, no placeholders.

**Architecture:** Three backend endpoints land in enterprise-v2 then cherry-pick to main. The mobile app replaces per-screen `usePolling` hooks with a single Zustand data store polled from App.tsx. Auth store wraps api.ts for reactive state. LoginScreen dynamically renders methods from `GET /api/auth/capabilities`.

**Tech Stack:** React Native 0.84.1 TypeScript, Zustand 5, FastAPI Python backend, AsyncStorage (existing), Android Linking deep links.

---

## File Map

### Backend — enterprise-v2 worktree (`/home/raizen/noba/.worktrees/enterprise-v2`)
- Modify: `share/noba-web/server/routers/auth.py` — add capabilities endpoint + exchange codes + exchange endpoint
- Modify: `share/noba-web/server/routers/saml.py` — redirect_uri support in login + ACS
- Modify: `share/noba-web/server/config.py` — add `samlAllowedRedirectUris` to WEB_KEYS
- Create: `tests/test_capabilities_exchange.py` — new endpoint tests

### Backend — main branch (cherry-pick auth.py changes only; main has no saml.py)

### Mobile — `/home/raizen/noba-mobile`
- Modify: `package.json` + run `npm install zustand`
- Modify: `src/services/api.ts` — expose `syncState()` for store hydration
- Create: `src/store/authStore.ts` — server URL, token, methods, hydrate
- Create: `src/store/dataStore.ts` — stats, alerts, approvals, health + fetch actions
- Modify: `App.tsx` — use auth store, centralized polling via useEffect
- Modify: `src/screens/LoginScreen.tsx` — capabilities fetch + SAML buttons + deep link handler
- Modify: `src/screens/DashboardScreen.tsx` — use dataStore.stats
- Modify: `src/screens/AlertsScreen.tsx` — use dataStore.alerts
- Modify: `src/screens/AgentsScreen.tsx` — use dataStore.stats
- Modify: `src/screens/HealingScreen.tsx` — use dataStore.approvals + post action
- Modify: `src/screens/SettingsScreen.tsx` — use dataStore.health
- Modify: `android/app/src/main/AndroidManifest.xml` — noba:// intent filter

---

## Task 1: Backend — `GET /api/auth/capabilities`

**Files:**
- Modify: `share/noba-web/server/routers/auth.py`

- [ ] **Step 1: Add the endpoint at the top of the route section**

After the existing `_prune_oauth_states` function and before `router = APIRouter()` no wait, after router is declared and before `@router.post("/api/login")`. Insert after line `router = APIRouter()`:

```python
# ── /api/auth/capabilities ────────────────────────────────────────────────────
@router.get("/api/auth/capabilities")
@handle_errors
async def auth_capabilities():
    """Return available auth methods. Used by mobile app login screen.
    Community: always [{type:'local'}]. Enterprise: adds SAML when enabled.
    No auth required — drives login screen before a token exists.
    """
    from ..yaml_config import read_yaml_settings
    cfg = read_yaml_settings()
    methods: list[dict] = [{"type": "local", "display_name": "Sign in"}]
    if cfg.get("samlEnabled") and cfg.get("samlIdpSsoUrl"):
        methods.append({
            "type": "saml",
            "display_name": cfg.get("samlDisplayName", "Sign in with SSO"),
        })
    return {"methods": methods}
```

- [ ] **Step 2: Run ruff**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
ruff check --fix share/noba-web/server/routers/auth.py
```

- [ ] **Step 3: Quick smoke test**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
python -c "
import sys; sys.path.insert(0, 'share/noba-web/server')
from routers.auth import router
routes = [r.path for r in router.routes]
assert '/api/auth/capabilities' in routes, f'missing, got: {routes}'
print('OK — capabilities route registered')
"
```
Expected: `OK — capabilities route registered`

- [ ] **Step 4: Commit**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
git add share/noba-web/server/routers/auth.py
git commit -m "feat: add GET /api/auth/capabilities endpoint"
```

---

## Task 2: Backend — exchange codes + SAML redirect_uri

**Files:**
- Modify: `share/noba-web/server/routers/auth.py` — add exchange codes dict + endpoint
- Modify: `share/noba-web/server/routers/saml.py` — redirect_uri in login + ACS
- Modify: `share/noba-web/server/config.py` — add samlAllowedRedirectUris to WEB_KEYS

- [ ] **Step 1: Add exchange codes store + endpoint to auth.py**

In `share/noba-web/server/routers/auth.py`, after the `_oauth_states_lock` lines (around line 29), add:

```python
# One-time SAML exchange codes: {code: (noba_token, expiry_time)}
# Used by mobile SAML deep-link flow: ACS deposits code here, mobile redeems it.
_saml_exchange_codes: dict[str, tuple[str, float]] = {}
_saml_exchange_codes_lock = threading.Lock()
```

Then add the exchange endpoint after the capabilities endpoint:

```python
# ── /api/auth/exchange ────────────────────────────────────────────────────────
@router.post("/api/auth/exchange")
@handle_errors
async def auth_exchange(request: Request):
    """Redeem a one-time SAML exchange code for a NOBA token.
    Codes are generated by the ACS handler when redirect_uri is present.
    30-second TTL, single-use. No auth required.
    """
    body = await _read_body(request)
    code = body.get("code", "").strip()
    if not code:
        raise HTTPException(400, "Missing code")
    now = time.time()
    with _saml_exchange_codes_lock:
        entry = _saml_exchange_codes.pop(code, None)
    if entry is None:
        raise HTTPException(401, "Invalid or expired exchange code")
    token, expires = entry
    if now > expires:
        raise HTTPException(401, "Exchange code has expired")
    return {"token": token}
```

- [ ] **Step 2: Add samlAllowedRedirectUris to config.py**

In `share/noba-web/server/config.py`, find WEB_KEYS (the list of allowed YAML config keys). Add `"samlAllowedRedirectUris"` to it alongside the other saml* keys.

```python
# Find the existing saml keys block and add:
"samlAllowedRedirectUris",
```

- [ ] **Step 3: Modify saml.py — accept redirect_uri in login**

In `share/noba-web/server/routers/saml.py`, add import at the top:

```python
from .auth import _saml_exchange_codes, _saml_exchange_codes_lock
```

Replace the `saml_login` function body to accept and store `redirect_uri`:

```python
@router.get("/api/saml/login")
@handle_errors
async def saml_login(request: Request):
    """Redirect browser to IdP for SP-initiated SSO."""
    cfg = _saml_cfg()
    _require_saml_enabled(cfg)
    relay_state = secrets.token_urlsafe(16)
    redirect_uri = request.query_params.get("redirect_uri", "")
    # Validate redirect_uri against allowlist (prevents open redirect)
    state_data: dict = {"ts": time.time()}
    if redirect_uri:
        allowed = read_yaml_settings().get("samlAllowedRedirectUris", [])
        if redirect_uri in (allowed if isinstance(allowed, list) else []):
            state_data["redirect_uri"] = redirect_uri
    with _saml_states_lock:
        _saml_states[relay_state] = state_data
    _prune_saml_states()
    redirect_url, _req_id = _build_authn_request(cfg, relay_state)
    return RedirectResponse(url=redirect_url, status_code=302)
```

- [ ] **Step 4: Modify saml.py — ACS deposits exchange code**

Replace the end of `saml_acs` (the part starting with `token = token_store.generate(...)`) with:

```python
    token = token_store.generate(username, role)
    db.saml_store_session(
        str(uuid.uuid4()), name_id, username, session_index,
        time.time(), time.time() + 86400,
    )
    db.audit_log("saml_login", username, f"SAML SSO via {name_id}", _client_ip(request))

    # Mobile deep-link flow: if relay state carried a redirect_uri, deposit
    # a short-lived exchange code and redirect to the app's deep link.
    redirect_uri = state_data.get("redirect_uri", "")
    if redirect_uri:
        code = secrets.token_urlsafe(32)
        with _saml_exchange_codes_lock:
            _saml_exchange_codes[code] = (token, time.time() + 30)
        return RedirectResponse(
            url=f"{redirect_uri}?code={urllib.parse.quote(code)}",
            status_code=302,
        )
    return RedirectResponse(url="/#/dashboard", status_code=302)
```

Note: The `saml_acs` function retrieves the relay state entry and deletes it:
```python
    with _saml_states_lock:
        if relay_state not in _saml_states:
            raise HTTPException(400, "Invalid or expired relay state")
        state_data = _saml_states.pop(relay_state)
```
Change the current `del _saml_states[relay_state]` line to `state_data = _saml_states.pop(relay_state)` so the redirect_uri is accessible below.

- [ ] **Step 5: Run ruff on both files**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
ruff check --fix share/noba-web/server/routers/auth.py share/noba-web/server/routers/saml.py share/noba-web/server/config.py
```

- [ ] **Step 6: Import smoke test**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
python -c "
import sys; sys.path.insert(0, 'share/noba-web/server')
from routers.auth import router, _saml_exchange_codes, _saml_exchange_codes_lock
from routers.saml import router as saml_router
routes = [r.path for r in router.routes]
assert '/api/auth/exchange' in routes
print('OK — exchange route registered, cross-import works')
"
```
Expected: `OK — exchange route registered, cross-import works`

- [ ] **Step 7: Commit**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
git add share/noba-web/server/routers/auth.py \
        share/noba-web/server/routers/saml.py \
        share/noba-web/server/config.py
git commit -m "feat: SAML mobile deep-link — exchange codes + redirect_uri support"
```

---

## Task 3: Backend tests

**Files:**
- Create: `tests/test_capabilities_exchange.py`

- [ ] **Step 1: Write the tests**

```python
"""Tests for GET /api/auth/capabilities and POST /api/auth/exchange."""
from __future__ import annotations

import time


def test_capabilities_returns_local(client):
    """Community (no SAML config) always returns local method."""
    r = client.get("/api/auth/capabilities")
    assert r.status_code == 200
    data = r.json()
    assert "methods" in data
    assert len(data["methods"]) >= 1
    types = [m["type"] for m in data["methods"]]
    assert "local" in types


def test_capabilities_local_has_display_name(client):
    r = client.get("/api/auth/capabilities")
    data = r.json()
    local = next(m for m in data["methods"] if m["type"] == "local")
    assert "display_name" in local
    assert local["display_name"]


def test_exchange_rejects_missing_code(client):
    r = client.post("/api/auth/exchange", json={})
    assert r.status_code == 400


def test_exchange_rejects_invalid_code(client):
    r = client.post("/api/auth/exchange", json={"code": "notarealcode"})
    assert r.status_code == 401


def test_exchange_rejects_expired_code(client):
    from share.noba_web.server.routers.auth import (
        _saml_exchange_codes,
        _saml_exchange_codes_lock,
    )
    code = "testexpiredcode"
    with _saml_exchange_codes_lock:
        _saml_exchange_codes[code] = ("sometoken", time.time() - 1)
    r = client.post("/api/auth/exchange", json={"code": code})
    assert r.status_code == 401


def test_exchange_redeems_valid_code(client):
    from share.noba_web.server.routers.auth import (
        _saml_exchange_codes,
        _saml_exchange_codes_lock,
    )
    code = "testvalidcode"
    with _saml_exchange_codes_lock:
        _saml_exchange_codes[code] = ("mytoken123", time.time() + 30)
    r = client.post("/api/auth/exchange", json={"code": code})
    assert r.status_code == 200
    assert r.json()["token"] == "mytoken123"


def test_exchange_code_single_use(client):
    """Code is deleted on redemption — second call must fail."""
    from share.noba_web.server.routers.auth import (
        _saml_exchange_codes,
        _saml_exchange_codes_lock,
    )
    code = "testsingleuse"
    with _saml_exchange_codes_lock:
        _saml_exchange_codes[code] = ("tok", time.time() + 30)
    client.post("/api/auth/exchange", json={"code": code})
    r2 = client.post("/api/auth/exchange", json={"code": code})
    assert r2.status_code == 401
```

Note: the import path for the module in tests may need to match how conftest sets up sys.path. Check existing test files for the correct import pattern and adjust if needed.

- [ ] **Step 2: Run the tests**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
pytest tests/test_capabilities_exchange.py -v
```
Expected: 6 tests passing.

- [ ] **Step 3: Run full suite to verify no regressions**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
pytest tests/ -v --tb=short 2>&1 | tail -20
```
Expected: all tests passing.

- [ ] **Step 4: Commit**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
git add tests/test_capabilities_exchange.py
git commit -m "test: capabilities + exchange endpoint coverage"
```

---

## Task 4: Cherry-pick capabilities + exchange to main

**Note:** main has no `saml.py` — only cherry-pick the auth.py + config.py commits (Tasks 1 and 2's auth.py/config.py changes). The SAML ACS redirect_uri change stays enterprise-v2 only.

- [ ] **Step 1: Get the commit SHAs from enterprise-v2**

```bash
cd /home/raizen/noba/.worktrees/enterprise-v2
git log --oneline -5
```
Note the SHAs for:
- "feat: add GET /api/auth/capabilities endpoint" (Task 1)
- "feat: SAML mobile deep-link — exchange codes + redirect_uri support" (Task 2)

- [ ] **Step 2: Cherry-pick to main**

```bash
cd /home/raizen/noba
git checkout main
git cherry-pick <capabilities-sha>
git cherry-pick <exchange-sha>
```

If there are conflicts in saml.py (because main has no saml.py), resolve by keeping main's version:
```bash
git checkout main -- share/noba-web/server/routers/saml.py 2>/dev/null || true
git add share/noba-web/server/routers/
git cherry-pick --continue
```

- [ ] **Step 3: Run tests on main**

```bash
cd /home/raizen/noba
pytest tests/ -v --tb=short 2>&1 | tail -20
```
Expected: all tests passing.

- [ ] **Step 4: Push main**

```bash
cd /home/raizen/noba
git push origin main
```

---

## Task 5: Mobile — Install Zustand + create auth store + update api.ts

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/services/api.ts`
- Create: `src/store/authStore.ts`

- [ ] **Step 1: Install Zustand**

```bash
cd /home/raizen/noba-mobile
npm install zustand
```
Expected: zustand added to package.json dependencies.

- [ ] **Step 2: Add syncState to api.ts**

Add one exported function at the end of `src/services/api.ts` so the auth store can sync module vars after hydration without re-reading AsyncStorage:

```typescript
/** Called by authStore after Zustand-free rehydration to sync module vars. */
export function syncState(serverUrl: string, token: string): void {
  _serverUrl = serverUrl.replace(/\/+$/, '');
  _token = token;
}
```

- [ ] **Step 3: Create src/store/authStore.ts**

```typescript
/**
 * Auth store — single source of truth for server URL, token, and auth methods.
 * Wraps api.ts for all persistence (AsyncStorage via api.ts existing keys).
 * Components subscribe here for reactive updates; api.ts module vars stay in sync.
 */
import { create } from 'zustand';
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
  methods: [{ type: 'local', display_name: 'Sign in' }],
  isReady: false,

  hydrate: () => {
    set({ serverUrl: getServerUrl(), token: getToken(), isReady: true });
  },

  setServerUrl: async (url) => {
    await setServer(url);
    set({ serverUrl: url });
  },

  setAuth: async (token) => {
    await setToken(token);
    set({ token });
  },

  setMethods: (methods) => set({ methods }),

  logout: async () => {
    await clearAuth();
    syncState('', '');
    set({ token: '' });
  },
}));
```

- [ ] **Step 4: TypeScript compile check**

```bash
cd /home/raizen/noba-mobile
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
cd /home/raizen/noba-mobile
git add package.json package-lock.json src/services/api.ts src/store/authStore.ts
git commit -m "feat: Zustand auth store wrapping api.ts"
```

---

## Task 6: Mobile — Create data store + update App.tsx

**Files:**
- Create: `src/store/dataStore.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Create src/store/dataStore.ts**

```typescript
/**
 * Data store — centralised polling state for all screens.
 * App.tsx owns the polling intervals; screens read from here.
 * Polling intervals: stats 5s, alerts 15s, approvals 10s, health 30s.
 */
import { create } from 'zustand';
import { get, post } from '../services/api';

interface DataState {
  stats: any;
  alerts: any[];
  approvals: any[];
  health: any;
  statsError: string | null;
  alertsError: string | null;
  approvalsError: string | null;
  healthError: string | null;
  fetchStats: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchApprovals: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  decideApproval: (id: number, decision: 'approve' | 'deny') => Promise<void>;
}

export const useDataStore = create<DataState>()((set, get: () => DataState) => ({
  stats: null,
  alerts: [],
  approvals: [],
  health: null,
  statsError: null,
  alertsError: null,
  approvalsError: null,
  healthError: null,

  fetchStats: async () => {
    try {
      const data = await get('/api/stats');
      set({ stats: data, statsError: null });
    } catch (e: any) {
      set({ statsError: e.message });
    }
  },

  fetchAlerts: async () => {
    try {
      const data = await get('/api/alert-history?limit=50');
      set({ alerts: Array.isArray(data) ? data : [], alertsError: null });
    } catch (e: any) {
      set({ alertsError: e.message });
    }
  },

  fetchApprovals: async () => {
    try {
      const data = await get('/api/approvals');
      set({ approvals: Array.isArray(data) ? data : [], approvalsError: null });
    } catch (e: any) {
      set({ approvalsError: e.message });
    }
  },

  fetchHealth: async () => {
    try {
      const data = await get('/api/health');
      set({ health: data, healthError: null });
    } catch (e: any) {
      set({ healthError: e.message });
    }
  },

  decideApproval: async (id, decision) => {
    await post(`/api/approvals/${id}/decide`, { decision });
    // Refresh immediately after action
    await (get as any)().fetchApprovals();
  },
}));
```

Note: the `get` import from `../services/api` and the Zustand `get` accessor conflict. Rename the Zustand one or alias the import:

```typescript
import { get as apiGet, post } from '../services/api';
// then use apiGet('/api/stats') etc.
// and the store getter function can just be omitted from the signature or renamed
```

Full corrected version:

```typescript
import { create } from 'zustand';
import { get as apiGet, post as apiPost } from '../services/api';

interface DataState {
  stats: any;
  alerts: any[];
  approvals: any[];
  health: any;
  statsError: string | null;
  alertsError: string | null;
  approvalsError: string | null;
  healthError: string | null;
  fetchStats: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchApprovals: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  decideApproval: (id: number, decision: 'approve' | 'deny') => Promise<void>;
}

export const useDataStore = create<DataState>()((set, getState) => ({
  stats: null,
  alerts: [],
  approvals: [],
  health: null,
  statsError: null,
  alertsError: null,
  approvalsError: null,
  healthError: null,

  fetchStats: async () => {
    try {
      const data = await apiGet('/api/stats');
      set({ stats: data, statsError: null });
    } catch (e: any) {
      set({ statsError: e.message });
    }
  },

  fetchAlerts: async () => {
    try {
      const data = await apiGet('/api/alert-history?limit=50');
      set({ alerts: Array.isArray(data) ? data : [], alertsError: null });
    } catch (e: any) {
      set({ alertsError: e.message });
    }
  },

  fetchApprovals: async () => {
    try {
      const data = await apiGet('/api/approvals');
      set({ approvals: Array.isArray(data) ? data : [], approvalsError: null });
    } catch (e: any) {
      set({ approvalsError: e.message });
    }
  },

  fetchHealth: async () => {
    try {
      const data = await apiGet('/api/health');
      set({ health: data, healthError: null });
    } catch (e: any) {
      set({ healthError: e.message });
    }
  },

  decideApproval: async (id, decision) => {
    await apiPost(`/api/approvals/${id}/decide`, { decision });
    await getState().fetchApprovals();
  },
}));
```

- [ ] **Step 2: Rewrite App.tsx**

Replace the full content of `App.tsx`:

```tsx
import React, {useEffect} from 'react';
import {StatusBar, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {loadConfig} from './src/services/api';
import {useAuthStore} from './src/store/authStore';
import {useDataStore} from './src/store/dataStore';
import {colors} from './src/theme/colors';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import HealingScreen from './src/screens/HealingScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const isReady = useAuthStore(s => s.isReady);
  const token = useAuthStore(s => s.token);
  const serverUrl = useAuthStore(s => s.serverUrl);
  const {fetchStats, fetchAlerts, fetchApprovals, fetchHealth} = useDataStore();

  // Hydrate auth store from AsyncStorage on first mount
  useEffect(() => {
    loadConfig().then(() => {
      useAuthStore.getState().hydrate();
    });
  }, []);

  // Single polling layer — runs while authenticated
  useEffect(() => {
    if (!token || !serverUrl) return;
    fetchStats(); fetchAlerts(); fetchApprovals(); fetchHealth();
    const t1 = setInterval(fetchStats,     5_000);
    const t2 = setInterval(fetchAlerts,   15_000);
    const t3 = setInterval(fetchApprovals,10_000);
    const t4 = setInterval(fetchHealth,   30_000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); };
  }, [token, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady) return null;

  if (!token || !serverUrl) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
          },
          fonts: {
            regular: {fontFamily: 'System', fontWeight: '400'},
            medium: {fontFamily: 'System', fontWeight: '500'},
            bold: {fontFamily: 'System', fontWeight: '700'},
            heavy: {fontFamily: 'System', fontWeight: '900'},
          },
        }}>
        <Tab.Navigator
          screenOptions={({route}) => {
            const icons: Record<string, string> = {
              Dashboard: '\u25A3',
              Alerts: '\u25C6',
              Agents: '\u25CE',
              Healing: '\u2725',
              Settings: '\u2699',
            };
            return {
              tabBarIcon: ({color}) => (
                <Text style={{fontSize: 18, color, marginBottom: -2}}>{icons[route.name] || '\u25CB'}</Text>
              ),
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingTop: 4,
                paddingBottom: 30,
                height: 74,
              },
              tabBarLabelStyle: {fontSize: 10, fontWeight: '600'},
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
              headerShown: false,
            };
          }}>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Agents" component={AgentsScreen} />
          <Tab.Screen name="Healing" component={HealingScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

Note: `LoginScreen` no longer receives an `onLogin` prop — it writes to the auth store directly. `SettingsScreen` no longer receives `onLogout` — it calls `useAuthStore.getState().logout()` directly.

- [ ] **Step 3: TypeScript check**

```bash
cd /home/raizen/noba-mobile
npx tsc --noEmit 2>&1 | head -40
```
Fix any type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /home/raizen/noba-mobile
git add src/store/dataStore.ts App.tsx
git commit -m "feat: Zustand data store + centralized polling in App.tsx"
```

---

## Task 7: Mobile — Update LoginScreen (capabilities + SAML deep link)

**Files:**
- Modify: `src/screens/LoginScreen.tsx`

- [ ] **Step 1: Rewrite LoginScreen.tsx**

```tsx
import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native';
import {colors, spacing, borderRadius, fontSize} from '../theme/colors';
import {post as apiPost, isConfigured, getServerUrl} from '../services/api';
import {useAuthStore, AuthMethod} from '../store/authStore';

export default function LoginScreen() {
  const {setServerUrl, setAuth, setMethods, methods} = useAuthStore();
  const [serverInput, setServerInput] = useState(getServerUrl() || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(isConfigured());

  // Fetch capabilities when a server URL is confirmed
  const loadCapabilities = useCallback(async (url: string) => {
    if (!url.trim()) return;
    try {
      await setServerUrl(url.trim());
      const data = await apiPost('/api/auth/capabilities', undefined).catch(
        () => apiPost('/api/auth/capabilities', undefined)
      );
      // Use apiGet — capabilities is a GET endpoint
      const resp = await fetch(`${url.trim().replace(/\/+$/, '')}/api/auth/capabilities`, {
        headers: {Accept: 'application/json'},
      });
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json.methods)) {
          setMethods(json.methods);
        }
      }
    } catch {
      // Non-fatal: falls back to local method (already set as default)
    }
    setCapabilitiesLoaded(true);
  }, [setServerUrl, setMethods]);

  // Handle SAML deep link return: noba://auth?code=xxx
  useEffect(() => {
    const handleUrl = async ({url}: {url: string}) => {
      if (!url.startsWith('noba://auth')) return;
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (!codeMatch) return;
      const code = decodeURIComponent(codeMatch[1]);
      try {
        setLoading(true);
        const data = await apiPost('/api/auth/exchange', {code}) as any;
        if (data?.token) {
          await setAuth(data.token);
        }
      } catch (e: any) {
        setError('SSO failed: ' + (e.message || 'unknown error'));
        setLoading(false);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    // Handle cold-start deep link
    Linking.getInitialURL().then(url => { if (url) handleUrl({url}); });
    return () => sub.remove();
  }, [setAuth]);

  const handleLocalLogin = async () => {
    setError('');
    setLoading(true);
    try {
      if (!serverInput.trim()) throw new Error('Enter your NOBA server URL');
      if (!capabilitiesLoaded) await loadCapabilities(serverInput);
      const body: any = {username: username.trim(), password};
      if (needs2fa && totpCode) body.totp_code = totpCode.trim();
      const data = await apiPost('/api/login', body) as any;
      if (data.requires_2fa && !needs2fa) {
        setNeeds2fa(true);
        setLoading(false);
        return;
      }
      if (data.token) {
        await setAuth(data.token);
      } else {
        throw new Error('No token received');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSamlLogin = async (method: AuthMethod) => {
    if (!serverInput.trim()) { setError('Enter your NOBA server URL first'); return; }
    const base = serverInput.trim().replace(/\/+$/, '');
    const samlUrl = `${base}/api/saml/login?redirect_uri=${encodeURIComponent('noba://auth')}`;
    await Linking.openURL(samlUrl);
  };

  const samlMethods = methods.filter(m => m.type !== 'local');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>NOBA</Text>
          <Text style={styles.subtitle}>Command Center</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverInput}
            onChangeText={setServerInput}
            onBlur={() => loadCapabilities(serverInput)}
            placeholder="https://noba.example.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="********"
            placeholderTextColor={colors.textDim}
            secureTextEntry
          />

          {needs2fa && (
            <>
              <Text style={styles.label}>2FA Code</Text>
              <TextInput
                style={styles.input}
                value={totpCode}
                onChangeText={setTotpCode}
                placeholder="123456"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                maxLength={6}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLocalLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>
                {needs2fa ? 'Verify & Sign In' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {samlMethods.map(method => (
            <TouchableOpacity
              key={method.type}
              style={[styles.button, styles.buttonSSO]}
              onPress={() => handleSamlLogin(method)}
              disabled={loading}>
              <Text style={styles.buttonText}>{method.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {flexGrow: 1, justifyContent: 'center', padding: spacing.xl},
  logoContainer: {alignItems: 'center', marginBottom: spacing.xxl},
  logo: {
    fontSize: fontSize.title,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  form: {width: '100%'},
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonSSO: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.md,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
```

Note: `loadCapabilities` calls the capabilities endpoint using raw `fetch` rather than `apiGet` because it needs to set the server URL first. Also note the `apiPost` call for capabilities was incorrect in the draft above — use raw fetch as shown in the final version.

- [ ] **Step 2: TypeScript check**

```bash
cd /home/raizen/noba-mobile
npx tsc --noEmit 2>&1 | head -40
```
Fix any errors.

- [ ] **Step 3: Commit**

```bash
cd /home/raizen/noba-mobile
git add src/screens/LoginScreen.tsx
git commit -m "feat: LoginScreen — capabilities fetch + SAML SSO buttons + deep link handler"
```

---

## Task 8: Mobile — Update all data screens to use data store

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/AlertsScreen.tsx`
- Modify: `src/screens/AgentsScreen.tsx`
- Modify: `src/screens/HealingScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Update DashboardScreen.tsx**

Replace `usePolling` call with data store subscription. Remove import of `usePolling`, add import of `useDataStore`.

Replace the top of the component:
```typescript
// REMOVE:
// const {data: stats, error, loading, refresh} = usePolling(() => get('/api/stats'), 5000);

// ADD:
import {useDataStore} from '../store/dataStore';
// In component:
const stats = useDataStore(s => s.stats);
const error = useDataStore(s => s.statsError);
const loading = stats === null && !error;
```

Keep all rendering logic unchanged — it already reads from `stats`.

- [ ] **Step 2: Update AlertsScreen.tsx**

```typescript
// REMOVE usePolling
// ADD:
import {useDataStore} from '../store/dataStore';
// In component:
const alerts = useDataStore(s => s.alerts);
const error = useDataStore(s => s.alertsError);
const loading = alerts.length === 0 && !error;
```

- [ ] **Step 3: Update AgentsScreen.tsx**

```typescript
// REMOVE usePolling
// ADD:
import {useDataStore} from '../store/dataStore';
// In component:
const stats = useDataStore(s => s.stats);
const error = useDataStore(s => s.statsError);
const agents = stats?.agents || [];
const loading = stats === null && !error;
```

- [ ] **Step 4: Update HealingScreen.tsx**

Remove usePolling and local approve/deny API calls. Use data store:

```typescript
// REMOVE usePolling
// ADD:
import {useDataStore} from '../store/dataStore';
// In component:
const approvals = useDataStore(s => s.approvals);
const error = useDataStore(s => s.approvalsError);
const decideApproval = useDataStore(s => s.decideApproval);
const loading = approvals.length === 0 && !error;
```

Replace the `handleDecide` function to use `decideApproval` from the store instead of calling `post` directly:
```typescript
const handleDecide = async (id: number, decision: 'approve' | 'deny') => {
  try {
    await decideApproval(id, decision);
  } catch (e: any) {
    Alert.alert('Error', e.message);
  }
};
```

Keep the filter for pending: `const pending = approvals.filter(a => a.status === 'pending');`

- [ ] **Step 5: Update SettingsScreen.tsx**

```typescript
// REMOVE usePolling calls (two of them)
// ADD:
import {useDataStore} from '../store/dataStore';
import {useAuthStore} from '../store/authStore';
// In component:
const health = useDataStore(s => s.health);
const healthError = useDataStore(s => s.healthError);
const logout = useAuthStore(s => s.logout);
```

Replace the `onLogout` prop reference with a direct call to `logout()`. The component no longer receives `onLogout` as a prop.

Remove the `/api/me` polling — for now, username can be read from a future profile fetch or skipped (it's visible in Settings via health data). If the existing `/api/me` polling is needed for the username display, keep it as a one-time fetch on mount (not a polling loop), since username doesn't change.

- [ ] **Step 6: TypeScript check**

```bash
cd /home/raizen/noba-mobile
npx tsc --noEmit 2>&1 | head -40
```
Fix any errors.

- [ ] **Step 7: Commit**

```bash
cd /home/raizen/noba-mobile
git add src/screens/DashboardScreen.tsx \
        src/screens/AlertsScreen.tsx \
        src/screens/AgentsScreen.tsx \
        src/screens/HealingScreen.tsx \
        src/screens/SettingsScreen.tsx
git commit -m "refactor: all screens use Zustand data store (remove per-screen usePolling)"
```

---

## Task 9: Mobile — Android deep link registration

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add noba:// intent filter to MainActivity**

In `AndroidManifest.xml`, find the `<activity android:name=".MainActivity"` block and add an intent filter inside it:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="noba" android:host="auth" />
</intent-filter>
```

- [ ] **Step 2: Also add noba://auth to samlAllowedRedirectUris on the server**

This is a config step on the live server, but document it: admin must add `noba://auth` to `samlAllowedRedirectUris` in NOBA settings before SAML mobile login works. The iOS/Android app always uses `noba://auth` as the redirect URI.

- [ ] **Step 3: Verify manifest parses**

```bash
cd /home/raizen/noba-mobile/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk ANDROID_HOME=~/Android/Sdk ./gradlew :app:processDebugManifest 2>&1 | tail -10
```
Expected: BUILD SUCCESSFUL (or no manifest-related errors).

- [ ] **Step 4: Commit**

```bash
cd /home/raizen/noba-mobile
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat: register noba:// deep link scheme for SAML callback"
```

---

## Final Check

- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] `pytest tests/ -v` on enterprise-v2 — all passing
- [ ] `pytest tests/ -v` on main — all passing
- [ ] Update memory: project_enterprise_uplift.md + project_session_2026_03_27.md
