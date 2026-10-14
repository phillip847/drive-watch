import { describe, it, expect } from 'vitest';
import { reducer } from './reducer.js';
import { createInitialState } from './initialState.js';
import { homeFor, signInMessage, validateSignIn } from './auth.js';

describe('sign-in messages', () => {
  it('checks the format before asking the repository', () => {
    expect(validateSignIn('NamPol-30418', '2468')).toBeNull();
    expect(validateSignIn('  ', '2468')).toBe('Enter your force number.');
    expect(validateSignIn('NamPol-30418', '12')).toBe('PIN must be 4 to 6 digits.');
    expect(validateSignIn('NamPol-30418', '1234567')).toBe('PIN must be 4 to 6 digits.');
  });

  it('maps repository errors to messages', () => {
    expect(signInMessage('not_found', ' NamPol-1 ')).toBe('No account has force number NamPol-1.');
    expect(signInMessage('suspended')).toBe('This account is suspended. Ask a system administrator to reactivate it.');
    expect(signInMessage('wrong_pin')).toBe('Incorrect PIN. Try again.');
  });

  it('sends each role to its home page', () => {
    expect(homeFor({ role: 'officer' })).toBe('/scan');
    expect(homeFor({ role: 'admin' })).toBe('/admin/users');
  });
});

describe('reducer', () => {
  const user = { id: 'NamPol-30418', name: 'Sgt. N. Amupolo', role: 'officer' };
  const signedIn = () => reducer(createInitialState(), { type: 'SIGNED_IN', user });

  it('clears the session on sign-out', () => {
    let s = reducer(signedIn(), { type: 'SET_DISC', disc: 'NAM-D-40217' });
    s = reducer(s, { type: 'SIGNED_OUT' });
    expect(s.currentUser).toBeNull();
    expect(s.currentDisc).toBeNull();
  });

  it('remembers discs opened offline until back online', () => {
    let s = reducer(signedIn(), { type: 'SET_DISC', disc: 'NAM-D-40217' });
    expect(s.offlineScans).toEqual([]);
    s = reducer(s, { type: 'SET_ONLINE', online: false });
    s = reducer(s, { type: 'SET_DISC', disc: 'NAM-D-88310' });
    s = reducer(s, { type: 'SET_DISC', disc: 'NAM-D-88310' });
    expect(s.offlineScans).toEqual(['NAM-D-88310']);
    s = reducer(s, { type: 'SET_ONLINE', online: true });
    expect(s.offlineScans).toEqual([]);
  });

  it('keeps writes made offline in order until sent', () => {
    let s = reducer(signedIn(), { type: 'QUEUE', item: { kind: 'audit', action: 'a' } });
    s = reducer(s, { type: 'QUEUE', item: { kind: 'notice', evidenceNo: 'EV-1' } });
    expect(s.outbox.map((i) => i.kind)).toEqual(['audit', 'notice']);
    s = reducer(s, { type: 'OUTBOX_SENT', count: 2 });
    expect(s.outbox).toEqual([]);
  });
});

describe('live feed', () => {
  const rec = (i) => ({ t: i * 5000, speed: 50, limit: 60 });
  const started = () =>
    reducer(createInitialState(), { type: 'LIVE_INIT', disc: 'D1', tripId: 'T0', samples: [rec(0), rec(1)], total: 5 });

  it('appends new records and ends with the trip', () => {
    let s = reducer(started(), { type: 'LIVE_APPEND', disc: 'D1', from: 2, samples: [rec(2), rec(3)], total: 5 });
    expect(s.liveFeeds.D1.samples).toHaveLength(4);
    expect(s.liveFeeds.D1.ended).toBe(false);
    s = reducer(s, { type: 'LIVE_APPEND', disc: 'D1', from: 4, samples: [rec(4)], total: 5 });
    expect(s.liveFeeds.D1.ended).toBe(true);
  });

  it('ignores a late response for records it already has', () => {
    const s = started();
    expect(reducer(s, { type: 'LIVE_APPEND', disc: 'D1', from: 1, samples: [rec(1)], total: 5 })).toBe(s);
  });

  it('counts buffered records while offline and resets them online', () => {
    let s = reducer(started(), { type: 'SET_ONLINE', online: false });
    s = reducer(s, { type: 'LIVE_APPEND', disc: 'D1', from: 2, samples: [rec(2), rec(3)], total: 5 });
    expect(s.bufferedCount).toBe(2);
    s = reducer(s, { type: 'SET_ONLINE', online: true });
    expect(s.bufferedCount).toBe(0);
  });
});
