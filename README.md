# NOBA Mobile

Mobile companion app for [NOBA Command Center](https://github.com/raizenica/noba-enterprise). Monitor your infrastructure, review alerts, and approve self-healing actions from your phone.

**iOS & Android** | React Native | TypeScript

## Features

- **Dashboard** — Real-time CPU, memory, swap, disk gauges with color thresholds. Agent overview with online/offline status. Service health summary. Notification feed.
- **Alerts** — Alert history feed with severity badges, active/all filter, expandable detail with timestamps.
- **Agents** — Per-agent cards with CPU, memory, architecture, disk usage breakdowns. Expandable detail with uptime and platform info.
- **Healing** — Approve or deny pending self-healing actions with confirmation dialogs. Healing history ledger with outcome badges.
- **Settings** — User profile, server info, component health (database, collector, agents, integrations), logout.
- **Biometric lock** — Face ID / fingerprint gate after initial login.

## Screenshots

*Coming soon*

## Setup

### Prerequisites

- Node.js >= 22.11.0
- React Native CLI environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- A running [NOBA server](https://github.com/raizenica/noba-enterprise)

### Install

```bash
git clone https://github.com/raizenica/noba-mobile.git
cd noba-mobile
npm install
```

### iOS

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

### Android

```bash
npx react-native run-android
```

### Connect to NOBA

On the login screen, enter your NOBA server URL (e.g. `http://192.168.1.10:8080`), username, and password. The app supports TOTP two-factor authentication.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.84 (bare CLI) |
| Language | TypeScript 5.8 |
| State | Zustand |
| Navigation | React Navigation 7 (bottom tabs + native stack) |
| Charts | react-native-chart-kit |
| Icons | react-native-vector-icons (Ionicons) |
| Storage | AsyncStorage |

## Architecture

```
App.tsx                     Auth gate + bottom tab navigator
src/
  screens/                  Dashboard, Alerts, Agents, Healing, Settings, Login
  components/               Card, StatusBadge (reusable)
  services/api.ts           HTTP client (fetch, Bearer auth, timeout)
  store/
    authStore.ts            Auth state (Zustand + AsyncStorage)
    dataStore.ts            Data fetching + polling (Zustand)
  theme/colors.ts           Color palette, spacing, typography
```

## Related

- [NOBA Enterprise](https://github.com/raizenica/noba-enterprise) — the server
- [NOBA Website](https://www.nobacmd.com) — project website

## License

MIT
