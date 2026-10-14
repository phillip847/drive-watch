import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import * as api from '../data/api.js';
import { reducer } from './reducer.js';
import { createInitialState } from './initialState.js';
import { useLiveFeed } from './useLiveFeed.js';
import { formatClock } from '../components/format.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const ref = useRef(state);
  ref.current = state;

  // Runs here rather than in a page so the feed keeps going when the officer navigates.
  useLiveFeed(state, dispatch);

  const actions = useMemo(() => {
    // Reloads cached repository data. Users and the audit log are admin-only.
    async function refresh(user = ref.current.currentUser) {
      const isAdmin = user?.role === 'admin';
      const [roads, notices, users, auditLog] = await Promise.all([
        api.fetchRoadData(),
        api.fetchNotices(),
        isAdmin ? api.fetchUsers() : null,
        isAdmin ? api.fetchAuditLog() : null,
      ]);
      dispatch({ type: 'LOADED', data: { roads, notices, ...(isAdmin ? { users, auditLog } : {}) } });
    }

    // Offline, audit entries wait in the outbox with the time they happened.
    async function addAudit(action) {
      if (ref.current.online) {
        await api.recordAudit(action);
        await refresh();
      } else {
        dispatch({ type: 'QUEUE', item: { kind: 'audit', action, time: Date.now() } });
      }
    }

    async function flushOutbox() {
      const items = ref.current.outbox;
      for (const item of items) {
        if (item.kind === 'audit') await api.recordAudit(`${item.action} (offline, ${formatClock(item.time)})`);
        if (item.kind === 'notice') await api.issueNotice({ ...item.payload, savedOfflineAt: item.time });
      }
      dispatch({ type: 'OUTBOX_SENT', count: items.length });
      return items.filter((i) => i.kind === 'notice').length;
    }

    return {
      dispatch,
      refresh,
      addAudit,

      // Returns { user } or { error } (an error code from the repository).
      async signIn(forceNumber, pin) {
        const result = await api.signIn(forceNumber, pin);
        if (result.user) {
          dispatch({ type: 'SIGNED_IN', user: result.user });
          await refresh(result.user);
        }
        return result;
      },

      async signOut() {
        await api.signOut();
        dispatch({ type: 'SIGNED_OUT' });
      },

      // Going online sends everything saved offline. Returns how many notices were issued.
      async setOnline(online) {
        if (!online) {
          await api.recordAudit('Went offline');
          dispatch({ type: 'SET_ONLINE', online: false });
          return 0;
        }
        const buffered = ref.current.bufferedCount;
        dispatch({ type: 'SET_ONLINE', online: true });
        const notices = await flushOutbox();
        await api.recordAudit(`Back online, synced ${buffered} buffered ECU records`);
        await refresh();
        return notices;
      },

      setDisc: (disc) => dispatch({ type: 'SET_DISC', disc }),

      async addUser(user) {
        const result = await api.addUser(user);
        await refresh();
        return result;
      },

      async setUserStatus(user, status) {
        const result = await api.setUserStatus(user, status);
        await refresh();
        return result;
      },

      async resetPin(user) {
        const result = await api.resetUserPin(user);
        await refresh();
        return result;
      },

      async checkRoadUpdate() {
        const update = await api.checkRoadUpdate();
        dispatch({ type: 'ROAD_UPDATE_FOUND', update });
        return update;
      },

      dismissRoadUpdate: () => dispatch({ type: 'ROAD_UPDATE_FOUND', update: null }),

      async applyRoadUpdate() {
        const { version } = ref.current.roadUpdate;
        await api.applyRoadUpdate(version);
        dispatch({ type: 'ROAD_UPDATE_FOUND', update: null });
        await refresh();
        return version;
      },

      async setLimit(segmentId, limit) {
        await api.setSpeedLimit(segmentId, limit);
        await refresh();
      },

      // Online: issues straight away and returns { notice }. Offline: saves it on the tablet, returns { queued: true }.
      async issueNotice(payload) {
        if (ref.current.online) {
          const notice = await api.issueNotice(payload);
          await refresh();
          return { notice };
        }
        const time = Date.now();
        dispatch({
          type: 'QUEUE',
          item: { kind: 'audit', action: `Saved notice for ${payload.evidence.evidenceNo} on tablet, pending`, time },
        });
        dispatch({ type: 'QUEUE', item: { kind: 'notice', evidenceNo: payload.evidence.evidenceNo, payload, time } });
        return { queued: true };
      },
    };
  }, []);

  // Road data version for the status bar.
  useEffect(() => {
    actions.refresh();
  }, [actions]);

  const value = useMemo(() => ({ state, currentUser: state.currentUser, ...actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
