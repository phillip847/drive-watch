// What the pages and app state use to read and write data. Calls the repository
// (in-memory now, REST later) and maps rows into UI shapes, so swapping the
// repository implementation does not touch the pages.
import * as repo from './repository.js';
import {
  toVehicle, toTrip, toSample, toUser, toOfficerRow, toRoadData, toRoadUpdate, toNotice, toAuditEntry, toViolationRow,
} from './mappers.js';

export async function listVehicles() {
  return (await repo.getVehicles()).map(toVehicle);
}

export async function lookupDisc(disc) {
  const row = await repo.getVehicleByDisc(disc);
  return row ? toVehicle(row) : null;
}

// { vehicle, trips } with trips newest first. The live trip (trips[0]) has no
// samples here: stream them with fetchLiveSamples, starting with its liveCount.
export async function fetchVehicleData(disc) {
  const row = await repo.getVehicleByDisc(disc);
  if (!row) return null;
  const trips = (await repo.getTrips(row.vehicle.vehicle_id)).map(toTrip);
  return { vehicle: toVehicle(row), trips, liveIdx: (trips[0]?.liveCount ?? 1) - 1 };
}

export async function fetchLiveSamples(tripId, from, max) {
  const { driving_records, record_count } = await repo.getLiveSamples(tripId, from, max);
  return { samples: driving_records.map(toSample), total: record_count };
}

// { user } or { error: 'not_found' | 'suspended' | 'wrong_pin' }
export async function signIn(forceNumber, pin) {
  const result = await repo.authenticate(forceNumber, pin);
  return result.officer ? { user: toUser(result.officer) } : result;
}

export const signOut = () => repo.endSession();
export const recordAudit = (action) => repo.recordAudit(action);

export async function fetchUsers() {
  return (await repo.getUsers()).map(toUser);
}

// Returns { user, temporaryPin } or { error }.
export async function addUser(user) {
  const result = await repo.saveUser({ ...toOfficerRow({ ...user, status: 'active' }), is_new: true });
  return result.error ? result : { user: toUser(result.officer), temporaryPin: result.temporary_pin };
}

export async function setUserStatus(user, status) {
  const result = await repo.saveUser({ ...toOfficerRow(user), status });
  return { user: toUser(result.officer) };
}

export async function resetUserPin(user) {
  const result = await repo.saveUser(toOfficerRow(user), { reset_pin: true });
  return { user: toUser(result.officer), temporaryPin: result.temporary_pin };
}

export async function fetchRoadData() {
  return toRoadData(await repo.getRoadData());
}

export async function checkRoadUpdate() {
  return toRoadUpdate(await repo.checkForRoadUpdate());
}

export const applyRoadUpdate = (version) => repo.applyRoadUpdate(version);
export const setSpeedLimit = (segmentId, limit) => repo.setSpeedLimit(segmentId, limit);

// evidence: result of buildEvidence(); fingerprintHex: its SHA-256.
export async function issueNotice({ evidence, fingerprintHex, vehicle, savedOfflineAt = null }) {
  const row = await repo.issueNotice({
    violation: toViolationRow(evidence.violation, evidence.trip.id),
    evidence_record: { ...evidence.record, fingerprint_sha256: fingerprintHex },
    notice: {
      vehicle_id: vehicle.id,
      disc_number: vehicle.disc,
      registration_number: vehicle.reg,
      owner_name: vehicle.owner,
      saved_offline_at: savedOfflineAt,
    },
  });
  return toNotice(row);
}

export async function fetchNotices() {
  return (await repo.getNotices()).map(toNotice);
}

export async function fetchAuditLog() {
  return (await repo.getAuditLog()).map(toAuditEntry);
}
