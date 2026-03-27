/**
 * Data store — centralised polling state for all screens.
 * App.tsx owns the polling intervals; screens only read from here.
 * Polling: stats 5s, alerts 15s, approvals 10s, health 30s, notifs 60s, ledger 30s.
 */
import {create} from 'zustand';
import {get as apiGet, post as apiPost} from '../services/api';

interface DataState {
  stats: any;
  alerts: any[];
  approvals: any[];
  health: any;
  notifs: any[];
  unreadCount: number;
  ledger: any[];
  statsError: string | null;
  alertsError: string | null;
  approvalsError: string | null;
  healthError: string | null;
  notifsError: string | null;
  ledgerError: string | null;
  fetchStats: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchApprovals: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchNotifs: () => Promise<void>;
  fetchLedger: () => Promise<void>;
  decideApproval: (id: number, decision: 'approve' | 'deny') => Promise<void>;
  markNotifRead: (id: number) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
}

export const useDataStore = create<DataState>()((set, getState) => ({
  stats: null,
  alerts: [],
  approvals: [],
  health: null,
  notifs: [],
  unreadCount: 0,
  ledger: [],
  statsError: null,
  alertsError: null,
  approvalsError: null,
  healthError: null,
  notifsError: null,
  ledgerError: null,

  fetchStats: async () => {
    try {
      const data = await apiGet('/api/stats');
      set({stats: data, statsError: null});
    } catch (e: any) {
      set({statsError: e.message});
    }
  },

  fetchAlerts: async () => {
    try {
      const data = await apiGet('/api/alert-history?limit=50');
      set({alerts: Array.isArray(data) ? data : [], alertsError: null});
    } catch (e: any) {
      set({alertsError: e.message});
    }
  },

  fetchApprovals: async () => {
    try {
      const data = await apiGet('/api/approvals');
      set({approvals: Array.isArray(data) ? data : [], approvalsError: null});
    } catch (e: any) {
      set({approvalsError: e.message});
    }
  },

  fetchHealth: async () => {
    try {
      const data = await apiGet('/api/health');
      set({health: data, healthError: null});
    } catch (e: any) {
      set({healthError: e.message});
    }
  },

  fetchNotifs: async () => {
    try {
      const data: any = await apiGet('/api/notifications?limit=30');
      set({
        notifs: Array.isArray(data?.notifications) ? data.notifications : [],
        unreadCount: data?.unread_count ?? 0,
        notifsError: null,
      });
    } catch (e: any) {
      set({notifsError: e.message});
    }
  },

  fetchLedger: async () => {
    try {
      const data = await apiGet('/api/healing/ledger?limit=20');
      set({ledger: Array.isArray(data) ? data : [], ledgerError: null});
    } catch (e: any) {
      set({ledgerError: e.message});
    }
  },

  decideApproval: async (id, decision) => {
    await apiPost(`/api/approvals/${id}/decide`, {decision});
    await getState().fetchApprovals();
  },

  markNotifRead: async (id) => {
    await apiPost(`/api/notifications/${id}/read`, {});
    await getState().fetchNotifs();
  },

  markAllNotifsRead: async () => {
    await apiPost('/api/notifications/read-all', {});
    await getState().fetchNotifs();
  },
}));
