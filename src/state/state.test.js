import { describe, it, expect } from 'vitest';
import { reducer, nextNoticeId } from './reducer.js';
import { createInitialState } from './initialState.js';
import { checkSignIn, homeFor } from './auth.js';
import { findRoadUpdate } from '../data/roadAuthority.js';

const T = 1_760_000_000_000;

describe('checkSignIn', () => {
  const { users } = createInitialState();

  it('signs in an active officer', () => {
    const r = checkSignIn(users, 'NamPol-30418', '2468');
    expect(r.error).toBeUndefined();
    expect(homeFor(r.user)).toBe('/scan');
  });

  it('sends admins to the users page', () => {
    expect(homeFor(checkSignIn(users, 'ADM-0007', '1357').user)).toBe('/admin/users');
  });

  it('reports each failure', () => {
    expect(checkSignIn(users, 'NamPol-1', '1234').error).toBe('No account has force number NamPol-1.');
    expect(checkSignIn(users, 'NamPol-31902', '2222').error).toBe(
      'This account is suspended. Ask a system administrator to reactivate it.'
    );
    expect(checkSignIn(users, 'NamPol-30418', '0000').error).toBe('Incorrect PIN. Try again.');
    expect(checkSignIn(users, 'NamPol-30418', '12').error).toBe('PIN must be 4 to 6 digits.');
    expect(checkSignIn(users, 'NamPol-30418', '1234567').error).toBe('PIN must be 4 to 6 digits.');
  });
});

describe('reducer', () => {
  const signedIn = () => reducer(createInitialState(), { type: 'SIGN_IN', userId: 'NamPol-30418', time: T });

  it('records sign-in in the audit log and updates lastSignIn', () => {
    const s = signedIn();
    expect(s.currentUserId).toBe('NamPol-30418');
    expect(s.users.find((u) => u.id === 'NamPol-30418').lastSignIn).toBe(T);
    expect(s.auditLog[0]).toMatchObject({ time: T, user: 'Sgt. N. Amupolo', action: 'Signed in' });
  });

  it('resets the buffer and logs the sync when back online', () => {
    let s = reducer(signedIn(), { type: 'SET_ONLINE', online: false, time: T + 1 });
    s = { ...s, bufferedCount: 5 };
    s = reducer(s, { type: 'SET_ONLINE', online: true, time: T + 2 });
    expect(s.online).toBe(true);
    expect(s.bufferedCount).toBe(0);
    expect(s.auditLog[0].action).toBe('Back online, synced 5 buffered ECU records');
  });

  it('keeps the audit log newest first', () => {
    let s = signedIn();
    s = reducer(s, { type: 'AUDIT', action: 'Scanned disc', time: T + 5 });
    expect(s.auditLog.map((e) => e.action)).toEqual(['Scanned disc', 'Signed in']);
  });

  it('clears the user and disc on sign-out', () => {
    let s = reducer(signedIn(), { type: 'SET_DISC', disc: 'NAM-D-40217' });
    s = reducer(s, { type: 'SIGN_OUT', time: T + 9 });
    expect(s.currentUserId).toBeNull();
    expect(s.currentDisc).toBeNull();
    expect(s.auditLog[0]).toMatchObject({ user: 'Sgt. N. Amupolo', action: 'Signed out' });
  });

});

describe('offline scans', () => {
  it('remembers discs opened offline until back online', () => {
    let s = reducer(createInitialState(), { type: 'SIGN_IN', userId: 'NamPol-30418', time: T });
    s = reducer(s, { type: 'SET_DISC', disc: 'NAM-D-40217' });
    expect(s.offlineScans).toEqual([]);
    s = reducer(s, { type: 'SET_ONLINE', online: false, time: T });
    s = reducer(s, { type: 'SET_DISC', disc: 'NAM-D-88310' });
    s = reducer(s, { type: 'SET_DISC', disc: 'NAM-D-88310' });
    expect(s.offlineScans).toEqual(['NAM-D-88310']);
    s = reducer(s, { type: 'SET_ONLINE', online: true, time: T });
    expect(s.offlineScans).toEqual([]);
  });
});

describe('live feed', () => {
  // samples 5 s apart starting at T
  const raw = ['A', 'B', 'C', 'D', 'E'].map((x, i) => ({ t: T + i * 5000, speed: 50, limit: 40, seg: 'WVB-S-0007', road: x }));
  const started = () => {
    const s = reducer(createInitialState(), { type: 'SIGN_IN', userId: 'NamPol-30418', time: T });
    return reducer(s, { type: 'LIVE_INIT', disc: 'D1', raw, idx: 1 });
  };

  it('reveals samples up to the live index, stamped with road data', () => {
    const feed = started().liveFeeds.D1;
    expect(feed.samples.map((x) => x.road)).toEqual(['A', 'B']);
    expect(feed.samples[0]).toMatchObject({ limit: 40, roadVersion: '2 Oct 2026' });
    expect(feed.ended).toBe(false);
  });

  it('applies a limit change only to samples captured after it', () => {
    let s = started();
    s = reducer(s, { type: 'SET_LIMIT', seg: 'WVB-S-0007', road: 'School zone', limit: 30, time: T + 12_000 });
    s = reducer(s, { type: 'LIVE_TICK', disc: 'D1', step: 3 });
    expect(s.liveFeeds.D1.samples.map((x) => x.limit)).toEqual([40, 40, 40, 30, 30]);
  });

  it('stamps samples with the road data version in force at capture', () => {
    let s = reducer(started(), { type: 'LOAD_ROAD_UPDATE', update: findRoadUpdate([]) });
    s = reducer(s, { type: 'APPLY_ROAD_UPDATE', time: T + 7_000 });
    s = reducer(s, { type: 'LIVE_TICK', disc: 'D1', step: 2 });
    const { samples } = s.liveFeeds.D1;
    expect(samples.map((x) => x.roadVersion)).toEqual(['2 Oct 2026', '2 Oct 2026', '9 Oct 2026', '9 Oct 2026']);
    expect(samples.map((x) => x.limit)).toEqual([40, 40, 30, 30]);
  });

  it('buffers 2 records per tick while offline', () => {
    let s = reducer(started(), { type: 'LIVE_TICK', disc: 'D1', step: 2 });
    expect(s.bufferedCount).toBe(0);
    s = reducer(s, { type: 'SET_ONLINE', online: false, time: T });
    s = reducer(s, { type: 'LIVE_TICK', disc: 'D1', step: 2 });
    expect(s.bufferedCount).toBe(1); // only one sample was left
    expect(s.liveFeeds.D1.ended).toBe(true);
    expect(reducer(s, { type: 'LIVE_TICK', disc: 'D1', step: 2 })).toBe(s);
  });
});

describe('road data', () => {
  const admin = () => reducer(createInitialState(), { type: 'SIGN_IN', userId: 'ADM-0007', time: T });

  it('applies a Road Authority update with notes and an audit entry', () => {
    let s = reducer(admin(), { type: 'LOAD_ROAD_UPDATE', update: findRoadUpdate(['2 Oct 2026']) });
    s = reducer(s, { type: 'APPLY_ROAD_UPDATE', time: T });
    expect(s.roads.version).toBe('9 Oct 2026');
    expect(s.roads.limits).toMatchObject({ 'B1-0847': 100, 'WVB-S-0007': 30, 'WHK-A-0031': 70 });
    expect(s.roads.changed['B1-0847']).toBe('Road Authority 9 Oct 2026: Roadworks near Brakwater');
    expect(s.roads.pending).toBeNull();
    expect(s.auditLog[0]).toMatchObject({ user: 'M. Shilongo', action: 'Applied Road Authority update 9 Oct 2026 (3 limit changes)' });
    expect(findRoadUpdate(s.roads.versionHistory.map((v) => v.version))).toBeNull();
  });

  it('records an admin override', () => {
    const s = reducer(admin(), { type: 'SET_LIMIT', seg: 'B1-0847', road: 'B1 Windhoek to Okahandja', limit: 100, time: T });
    expect(s.roads.limits['B1-0847']).toBe(100);
    expect(s.roads.changed['B1-0847']).toBe('Admin override: was 120 km/h');
    expect(s.auditLog[0].action).toBe('Changed limit on B1 Windhoek to Okahandja (B1-0847) from 120 to 100 km/h');
  });
});

describe('users', () => {
  const admin = () => reducer(createInitialState(), { type: 'SIGN_IN', userId: 'ADM-0007', time: T });

  it('adds a user and resets a PIN without logging the PIN', () => {
    let s = reducer(admin(), {
      type: 'ADD_USER', time: T,
      user: { id: 'NamPol-40001', name: 'Cst. A. Test', role: 'officer', station: 'Rundu', pin: '0420', status: 'active', lastSignIn: null },
    });
    expect(s.users.at(-1).id).toBe('NamPol-40001');
    expect(s.auditLog[0].action).toBe('Added user Cst. A. Test (NamPol-40001) as officer, Rundu');
    s = reducer(s, { type: 'RESET_PIN', userId: 'NamPol-40001', pin: '9876', time: T });
    expect(s.users.at(-1).pin).toBe('9876');
    expect(s.auditLog[0].action).toBe('Reset PIN for Cst. A. Test (NamPol-40001)');
    expect(s.auditLog.some((e) => e.action.includes('9876') || e.action.includes('0420'))).toBe(false);
  });
});

describe('notices', () => {
  const notice = (state) => ({
    id: nextNoticeId(state, T), evidenceNo: 'EV-88310-001-ABCD', disc: 'NAM-D-88310', reg: 'N 9087 SH', owner: 'T. Amukoto',
  });
  const signedIn = () => reducer(createInitialState(), { type: 'SIGN_IN', userId: 'NamPol-30418', time: T });

  it('issues straight away when online, once per evidence record', () => {
    let s = signedIn();
    const n = notice(s);
    expect(n.id).toBe(`NTC-${new Date(T).getFullYear()}-00001`);
    s = reducer(s, { type: 'ISSUE_NOTICE', notice: n, time: T });
    expect(s.issuedNotices[0]).toMatchObject({ status: 'issued', issuedAt: T });
    expect(s.auditLog[0].action).toMatch(/^Issued notice NTC-\d{4}-00001/);
    expect(reducer(s, { type: 'ISSUE_NOTICE', notice: n, time: T })).toBe(s);
  });

  it('keeps notices pending offline and issues them on reconnect', () => {
    let s = reducer(signedIn(), { type: 'SET_ONLINE', online: false, time: T });
    s = reducer(s, { type: 'ISSUE_NOTICE', notice: notice(s), time: T });
    expect(s.issuedNotices[0]).toMatchObject({ status: 'pending', issuedAt: null });
    expect(s.auditLog[0].action).toMatch(/pending$/);
    s = reducer(s, { type: 'SET_ONLINE', online: true, time: T + 9 });
    expect(s.issuedNotices[0]).toMatchObject({ status: 'issued', issuedAt: T + 9 });
    expect(s.auditLog[0].action).toMatch(/saved offline/);
  });
});
