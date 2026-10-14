import { ROUTES } from '../data/roads.js';

const at = (iso) => Date.parse(iso);

// Road data loaded on the tablet at start-up.
export const BASE_ROAD_VERSION = '2 Oct 2026';

export const USERS = [
  { id: 'NamPol-30418', name: 'Sgt. N. Amupolo', role: 'officer', station: 'Windhoek City', pin: '2468', status: 'active', lastSignIn: at('2026-10-13T07:42:00+02:00') },
  { id: 'NamPol-27751', name: 'Cst. L. Iipinge', role: 'officer', station: 'Okahandja', pin: '1111', status: 'active', lastSignIn: at('2026-10-12T14:05:00+02:00') },
  { id: 'NamPol-31902', name: 'Insp. R. van Wyk', role: 'officer', station: 'Walvis Bay', pin: '2222', status: 'suspended', lastSignIn: at('2026-09-28T09:18:00+02:00') },
  { id: 'NamPol-29044', name: 'Cst. P. Nangolo', role: 'officer', station: 'Walvis Bay', pin: '3333', status: 'active', lastSignIn: at('2026-10-13T16:30:00+02:00') },
  { id: 'ADM-0007', name: 'M. Shilongo', role: 'admin', station: 'Head office', pin: '1357', status: 'active', lastSignIn: at('2026-10-10T08:12:00+02:00') },
];

function baseLimits() {
  const limits = {};
  for (const route of ROUTES) for (const s of route.segments) limits[s.id] = s.limit;
  return limits;
}

export function createInitialState() {
  return {
    users: USERS,
    currentUserId: null,
    online: true,
    bufferedCount: 0,
    currentDisc: null,
    liveFeeds: {}, // { disc: { raw, samples, ended } } revealed ECU samples per vehicle
    offlineScans: [], // discs opened while offline, cleared when back online
    auditLog: [], // newest first: { id, time, user, action }
    issuedNotices: [],
    roads: {
      version: BASE_ROAD_VERSION,
      limits: baseLimits(), // current limit per segment
      changed: {}, // { segmentId: note }
      pending: null, // update fetched from the Road Authority, not yet applied
      limitHistory: {}, // { segmentId: [{ from, limit }] } changes since start-up
      versionHistory: [{ from: -Infinity, version: BASE_ROAD_VERSION }],
    },
  };
}
