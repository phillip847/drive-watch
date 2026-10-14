import { describe, it, expect, beforeEach } from 'vitest';
import * as repo from './repository.js';
import * as api from './api.js';
import { buildEvidence } from './evidence.js';
import { withLiveFeed } from './analysis.js';

const T = Date.UTC(2026, 9, 14, 8, 0, 0);
let now;
beforeEach(() => {
  now = T;
  repo.resetRepository({ now: () => now });
});

const lastAudit = async () => (await repo.getAuditLog())[0];

describe('authenticate', () => {
  it('signs in and records it', async () => {
    const r = await repo.authenticate('nampol-30418', '2468');
    expect(r.officer).toMatchObject({ force_number: 'NamPol-30418', last_sign_in_at: T });
    expect(r.officer.pin).toBeUndefined();
    expect(await lastAudit()).toMatchObject({ actor_name: 'Sgt. N. Amupolo', action: 'Signed in', occurred_at: T });
  });

  it('returns an error code for each failure', async () => {
    expect(await repo.authenticate('NamPol-1', '1234')).toEqual({ error: 'not_found' });
    expect(await repo.authenticate('NamPol-31902', '2222')).toEqual({ error: 'suspended' });
    expect(await repo.authenticate('NamPol-30418', '0000')).toEqual({ error: 'wrong_pin' });
    expect((await lastAudit()).action).toBe('Failed sign-in: incorrect PIN');
  });
});

describe('officers', () => {
  beforeEach(() => repo.authenticate('ADM-0007', '1357'));

  it('adds a user with a temporary PIN that works, without logging the PIN', async () => {
    const r = await repo.saveUser({ force_number: 'NamPol-40001', full_name: 'Cst. A. Test', role: 'officer', station: 'Rundu', is_new: true });
    expect(r.temporary_pin).toMatch(/^\d{4}$/);
    expect((await lastAudit()).action).toBe('Added user Cst. A. Test (NamPol-40001) as officer, Rundu');
    expect((await repo.authenticate('NamPol-40001', r.temporary_pin)).officer).toBeTruthy();
    const log = await repo.getAuditLog();
    expect(log.some((e) => e.action.includes(r.temporary_pin))).toBe(false);
  });

  it('rejects a force number already in use', async () => {
    const r = await repo.saveUser({ force_number: 'nampol-30418', full_name: 'X', role: 'officer', station: 'Y', is_new: true });
    expect(r).toEqual({ error: 'duplicate_force_number' });
  });

  it('suspends, reactivates and resets PINs', async () => {
    await repo.saveUser({ force_number: 'NamPol-27751', status: 'suspended' });
    expect((await lastAudit()).action).toBe('Suspended Cst. L. Iipinge (NamPol-27751)');
    expect(await repo.authenticate('NamPol-27751', '1111')).toEqual({ error: 'suspended' });
    await repo.saveUser({ force_number: 'NamPol-27751', status: 'active' });
    const { temporary_pin } = await repo.saveUser({ force_number: 'NamPol-27751' }, { reset_pin: true });
    expect((await lastAudit()).action).toBe('Reset PIN for Cst. L. Iipinge (NamPol-27751)');
    expect(await repo.authenticate('NamPol-27751', '1111')).toEqual({ error: 'wrong_pin' });
    expect((await repo.authenticate('NamPol-27751', temporary_pin)).officer).toBeTruthy();
  });
});

describe('road data', () => {
  beforeEach(() => repo.authenticate('ADM-0007', '1357'));
  const segment = async (id) => (await repo.getRoadData()).road_segments.find((s) => s.segment_id === id);

  it('applies the Road Authority update once', async () => {
    const update = await repo.checkForRoadUpdate();
    expect(update.data_version).toBe('9 Oct 2026');
    expect(update.changes.map((c) => [c.segment_id, c.previous_limit_kmh, c.limit_kmh])).toEqual([
      ['B1-0847', 120, 100], ['WVB-S-0007', 40, 30], ['WHK-A-0031', 80, 70],
    ]);
    await repo.applyRoadUpdate('9 Oct 2026');
    const data = await repo.getRoadData();
    expect(data.data_version).toBe('9 Oct 2026');
    expect(await segment('B1-0847')).toMatchObject({ limit_kmh: 100, limit_note: 'Road Authority 9 Oct 2026: Roadworks near Brakwater' });
    expect((await lastAudit()).action).toBe('Applied Road Authority update 9 Oct 2026 (3 limit changes)');
    expect(await repo.checkForRoadUpdate()).toBeNull();
  });

  it('records an admin override', async () => {
    await repo.setSpeedLimit('B1-0847', 100);
    expect(await segment('B1-0847')).toMatchObject({ limit_kmh: 100, limit_source: 'admin_override', limit_note: 'Admin override: was 120 km/h' });
    expect((await lastAudit()).action).toBe('Changed limit on B1 Windhoek to Okahandja (B1-0847) from 120 to 100 km/h');
  });

  it('stamps driving records with the limit and version in force when captured', async () => {
    // NAM-D-67004's live trip runs on route A; its "now" record is at T.
    const vehicle = await repo.getVehicleByDisc('NAM-D-67004');
    const [live] = await repo.getTrips(vehicle.vehicle.vehicle_id);
    now = T + 60_000;
    await repo.applyRoadUpdate('9 Oct 2026'); // WHK-A-0031 80 -> 70, B1-0847 120 -> 100
    const { driving_records } = await repo.getLiveSamples(live.trip_id, 0, live.record_count);
    const before = driving_records.filter((r) => r.recorded_at < now);
    const after = driving_records.filter((r) => r.recorded_at >= now);
    expect(before.every((r) => r.road_data_version === '2 Oct 2026')).toBe(true);
    expect(after.every((r) => r.road_data_version === '9 Oct 2026')).toBe(true);
    expect(new Set(before.filter((r) => r.segment_id === 'B1-0847').map((r) => r.speed_limit_kmh))).toEqual(new Set([120]));
    expect(new Set(after.filter((r) => r.segment_id === 'B1-0847').map((r) => r.speed_limit_kmh))).toEqual(new Set([100]));
  });
});

describe('notices', () => {
  it('stores the violation, evidence and notice once, through the api', async () => {
    await repo.authenticate('NamPol-30418', '2468');
    const data = await api.fetchVehicleData('NAM-D-88310');
    const { samples, total } = await api.fetchLiveSamples(data.trips[0].id, 0, data.trips[0].liveCount);
    const view = withLiveFeed(data, { samples, total, ended: false });
    const evidence = buildEvidence(view, 1, 0);
    const payload = { evidence, fingerprintHex: 'ab'.repeat(32), vehicle: data.vehicle };
    const notice = await api.issueNotice(payload);
    expect(notice).toMatchObject({ id: 'NTC-2026-00001', status: 'issued', evidenceNo: evidence.evidenceNo, owner: 'T. Amukoto' });
    expect((await api.issueNotice(payload)).id).toBe('NTC-2026-00001');
    expect(await api.fetchNotices()).toHaveLength(1);
    expect((await lastAudit()).action).toMatch(/^Issued notice NTC-2026-00001 for EV-88310-/);
  });
});
