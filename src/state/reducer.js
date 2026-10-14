import { stampSample, withLimits } from './roadData.js';

let auditSeq = 0;

function withAudit(state, action, time, user) {
  const entry = {
    id: ++auditSeq,
    time,
    user: user ?? state.users.find((u) => u.id === state.currentUserId)?.name ?? 'System',
    action,
  };
  return { ...state, auditLog: [entry, ...state.auditLog] };
}


export const nextNoticeId = (state, time) =>
  `NTC-${new Date(time).getFullYear()}-${String(state.issuedNotices.length + 1).padStart(5, '0')}`;

const updateUser = (users, id, patch) => users.map((u) => (u.id === id ? { ...u, ...patch } : u));

// Every action that needs a timestamp carries `time`, so the reducer stays pure.
export function reducer(state, a) {
  switch (a.type) {
    case 'AUDIT':
      return withAudit(state, a.action, a.time, a.user);

    case 'SIGN_IN': {
      const next = {
        ...state,
        currentUserId: a.userId,
        users: updateUser(state.users, a.userId, { lastSignIn: a.time }),
      };
      return withAudit(next, 'Signed in', a.time);
    }

    case 'SIGN_OUT': {
      if (!state.currentUserId) return state;
      const next = withAudit(state, 'Signed out', a.time);
      return { ...next, currentUserId: null, currentDisc: null };
    }

    case 'SET_ONLINE': {
      if (state.online === a.online) return state;
      if (a.online) {
        let next = withAudit(state, `Back online, synced ${state.bufferedCount} buffered ECU records`, a.time);
        // Notices saved offline are issued on reconnect.
        for (const n of state.issuedNotices.filter((x) => x.status === 'pending').reverse()) {
          next = withAudit(next, `Issued notice ${n.id} (saved offline) to ${n.owner} (${n.reg})`, a.time);
        }
        const issuedNotices = next.issuedNotices.map((n) =>
          n.status === 'pending' ? { ...n, status: 'issued', issuedAt: a.time } : n
        );
        return { ...next, online: true, bufferedCount: 0, offlineScans: [], issuedNotices };
      }
      return { ...withAudit(state, 'Went offline', a.time), online: false };
    }

    case 'LIVE_INIT': {
      if (state.liveFeeds[a.disc]) return state;
      const samples = a.raw.slice(0, a.idx + 1).map((s) => stampSample(s, state.roads));
      const feed = { raw: a.raw, samples, ended: samples.length >= a.raw.length };
      return { ...state, liveFeeds: { ...state.liveFeeds, [a.disc]: feed } };
    }

    case 'LIVE_TICK': {
      const feed = state.liveFeeds[a.disc];
      if (!feed || feed.ended) return state;
      const from = feed.samples.length;
      const fresh = feed.raw.slice(from, from + a.step).map((s) => stampSample(s, state.roads));
      const samples = [...feed.samples, ...fresh];
      const next = { ...feed, samples, ended: samples.length >= feed.raw.length };
      return {
        ...state,
        liveFeeds: { ...state.liveFeeds, [a.disc]: next },
        bufferedCount: state.online ? state.bufferedCount : state.bufferedCount + fresh.length,
      };
    }

    case 'SET_DISC': {
      const offlineScans =
        state.online || state.offlineScans.includes(a.disc) ? state.offlineScans : [...state.offlineScans, a.disc];
      return { ...state, currentDisc: a.disc, offlineScans };
    }

    case 'SET_USER_STATUS': {
      const user = state.users.find((u) => u.id === a.userId);
      if (!user || user.status === a.status) return state;
      const next = { ...state, users: updateUser(state.users, a.userId, { status: a.status }) };
      const verb = a.status === 'suspended' ? 'Suspended' : 'Reactivated';
      return withAudit(next, `${verb} ${user.name} (${user.id})`, a.time);
    }

    case 'ISSUE_NOTICE': {
      if (state.issuedNotices.some((n) => n.evidenceNo === a.notice.evidenceNo)) return state;
      const notice = {
        ...a.notice,
        created: a.time,
        status: state.online ? 'issued' : 'pending',
        issuedAt: state.online ? a.time : null,
      };
      const next = { ...state, issuedNotices: [notice, ...state.issuedNotices] };
      const what = `notice ${notice.id} for ${notice.evidenceNo} to ${notice.owner} (${notice.reg})`;
      return withAudit(next, state.online ? `Issued ${what}` : `Saved ${what} on tablet, pending`, a.time);
    }

    case 'LOAD_ROAD_UPDATE':
      return { ...state, roads: { ...state.roads, pending: a.update } };

    case 'DISMISS_ROAD_UPDATE':
      return { ...state, roads: { ...state.roads, pending: null } };

    case 'APPLY_ROAD_UPDATE': {
      const { pending } = state.roads;
      if (!pending) return state;
      const changes = pending.changes.map((c) => ({
        seg: c.seg,
        limit: c.limit,
        note: `Road Authority ${pending.version}: ${c.reason}`,
      }));
      const roads = withLimits(state.roads, changes, a.time);
      const next = {
        ...state,
        roads: {
          ...roads,
          version: pending.version,
          pending: null,
          versionHistory: [...roads.versionHistory, { from: a.time, version: pending.version }],
        },
      };
      const n = pending.changes.length;
      return withAudit(next, `Applied Road Authority update ${pending.version} (${n} limit change${n === 1 ? '' : 's'})`, a.time);
    }

    case 'SET_LIMIT': {
      const was = state.roads.limits[a.seg];
      if (was === undefined || was === a.limit) return state;
      const roads = withLimits(state.roads, [{ seg: a.seg, limit: a.limit, note: `Admin override: was ${was} km/h` }], a.time);
      return withAudit({ ...state, roads }, `Changed limit on ${a.road} (${a.seg}) from ${was} to ${a.limit} km/h`, a.time);
    }

    case 'ADD_USER': {
      const u = a.user;
      const next = { ...state, users: [...state.users, u] };
      const role = u.role === 'admin' ? 'system admin' : 'officer';
      return withAudit(next, `Added user ${u.name} (${u.id}) as ${role}, ${u.station}`, a.time);
    }

    case 'RESET_PIN': {
      const user = state.users.find((u) => u.id === a.userId);
      if (!user) return state;
      const next = { ...state, users: updateUser(state.users, a.userId, { pin: a.pin }) };
      return withAudit(next, `Reset PIN for ${user.name} (${user.id})`, a.time);
    }

    default:
      throw new Error(`Unknown action: ${a.type}`);
  }
}
