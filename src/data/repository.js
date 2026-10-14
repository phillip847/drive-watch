// DriveWatch data repository: every read and write of stored data goes through here.
//
// This is the in-memory implementation, backed by the trip simulator. A REST
// implementation can replace it by exporting the same async functions and
// returning the same row shapes. Rows use the column names of the database
// tables: vehicle, disc, ecu_unit, trip, driving_record, road_segment,
// speed_limit, violation, evidence_record, notice, officer and audit_log.
//
// Like a server, the repository knows who is signed in (set by authenticate)
// and writes the audit log itself.
import { VEHICLES } from './vehicles.js';
import { ROUTES, segmentType } from './roads.js';
import { getVehicleData, clearVehicleCache } from './simulator.js';
import { ROAD_AUTHORITY_UPDATES } from './roadAuthority.js';

export const BASE_DATA_VERSION = '2 Oct 2026';

let clock = () => Date.now();
const iso = (s) => Date.parse(s);

const SEED_OFFICERS = [
  ['NamPol-30418', 'Sgt. N. Amupolo', 'officer', 'Windhoek City', '2468', 'active', '2026-10-13T07:42:00+02:00'],
  ['NamPol-27751', 'Cst. L. Iipinge', 'officer', 'Okahandja', '1111', 'active', '2026-10-12T14:05:00+02:00'],
  ['NamPol-31902', 'Insp. R. van Wyk', 'officer', 'Walvis Bay', '2222', 'suspended', '2026-09-28T09:18:00+02:00'],
  ['NamPol-29044', 'Cst. P. Nangolo', 'officer', 'Walvis Bay', '3333', 'active', '2026-10-13T16:30:00+02:00'],
  ['ADM-0007', 'M. Shilongo', 'system_admin', 'Head office', '1357', 'active', '2026-10-10T08:12:00+02:00'],
];

let db;
let pins; // force_number -> PIN. PINs never leave the repository.
let session; // officer row of the signed-in user
let seq;

function seed() {
  pins = new Map();
  session = null;
  seq = { audit: 0, limit: 0, notice: 0, violation: 0 };
  db = {
    officer: SEED_OFFICERS.map(([force_number, full_name, role, station, pin, status, last]) => {
      pins.set(force_number, pin);
      return { force_number, full_name, role, station, status, last_sign_in_at: iso(last) };
    }),
    road_segment: ROUTES.flatMap((r) =>
      r.segments.map((s) => ({ segment_id: s.id, road_name: s.road, segment_type: segmentType(s.id), length_km: s.km }))
    ),
    // One row per limit change; effective_from null means "since records began".
    speed_limit: ROUTES.flatMap((r) =>
      r.segments.map((s) => ({
        speed_limit_id: ++seq.limit,
        segment_id: s.id,
        limit_kmh: s.limit,
        effective_from: null,
        data_version: BASE_DATA_VERSION,
        source: 'road_authority',
        note: null,
      }))
    ),
    data_version: [{ data_version: BASE_DATA_VERSION, applied_at: null }],
    violation: [],
    evidence_record: [],
    notice: [],
    audit_log: [],
  };
}
seed();

// Test helpers.
export function resetRepository({ now } = {}) {
  clock = now ?? (() => Date.now());
  clearVehicleCache();
  seed();
}

const copy = (row) => (row ? structuredClone(row) : row);
const findOfficer = (force_number) =>
  db.officer.find((o) => o.force_number.toLowerCase() === String(force_number).trim().toLowerCase());

function audit(action, actor_name = session?.full_name ?? 'System') {
  db.audit_log.push({ audit_id: ++seq.audit, occurred_at: clock(), actor_name, action });
}

// ---------- road data in force at a moment ----------

function limitRowAt(segment_id, t) {
  let best = null;
  for (const row of db.speed_limit) {
    if (row.segment_id !== segment_id) continue;
    if (row.effective_from === null || row.effective_from <= t) best = row;
  }
  return best;
}

function dataVersionAt(t) {
  let best = db.data_version[0];
  for (const v of db.data_version) if (v.applied_at === null || v.applied_at <= t) best = v;
  return best.data_version;
}

const currentLimitRow = (segment_id) => limitRowAt(segment_id, Infinity);

// ---------- vehicles, trips and driving records ----------

const vehicleId = (v) => `VEH-${v.disc.replace(/\D/g, '')}`;
const normaliseDisc = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

function vehicleBundle(v) {
  const vehicle_id = vehicleId(v);
  return {
    vehicle: {
      vehicle_id,
      registration_number: v.reg,
      make_model: v.make,
      model_year: v.year,
      colour: v.colour,
      owner_name: v.owner,
    },
    disc: { disc_number: v.disc, vehicle_id },
    ecu_unit: { ecu_serial: v.ecu, vehicle_id },
  };
}

// Driving records are stamped with the limit and data version in force when captured.
function toDrivingRecord(trip_id, sample, index) {
  const limit = limitRowAt(sample.seg, sample.t);
  return {
    trip_id,
    record_index: index,
    recorded_at: sample.t,
    speed_kmh: sample.speed,
    speed_limit_kmh: limit?.limit_kmh ?? sample.limit,
    road_data_version: dataVersionAt(sample.t),
    segment_id: sample.seg,
    road_name: sample.road,
    latitude: sample.lat,
    longitude: sample.lng,
    engine_rpm: sample.rpm,
    event_type: sample.ev ? (sample.ev.type === 'brake' ? 'harsh_braking' : 'harsh_acceleration') : null,
    event_g: sample.ev?.g ?? null,
  };
}

function simulated(vehicle_id) {
  const v = VEHICLES.find((x) => vehicleId(x) === vehicle_id);
  return v ? getVehicleData(v.disc, clock()) : null;
}

function findTrip(trip_id) {
  for (const v of VEHICLES) {
    const data = getVehicleData(v.disc, clock());
    const trip = data.trips.find((t) => t.id === trip_id);
    if (trip) return { data, trip };
  }
  return null;
}

export async function getVehicles() {
  return VEHICLES.map(vehicleBundle);
}

// Returns { vehicle, disc, ecu_unit } or null.
export async function getVehicleByDisc(disc_number) {
  const key = normaliseDisc(disc_number);
  const v = key ? VEHICLES.find((x) => normaliseDisc(x.disc) === key) : null;
  return v ? vehicleBundle(v) : null;
}

// Trips newest first. Completed trips include their driving_records; the live trip
// only reports how many records exist so far (live_record_count). Fetch those with getLiveSamples.
export async function getTrips(vehicle_id) {
  const data = simulated(vehicle_id);
  if (!data) return [];
  return data.trips.map((t) => {
    const segs = ROUTES[t.routeIndex].segments;
    const row = {
      trip_id: t.id,
      vehicle_id,
      route_name: t.routeName,
      start_road_name: segs[0].road,
      end_road_name: segs[segs.length - 1].road,
      started_at: t.start,
      ended_at: t.live ? null : t.end,
      is_live: t.live,
      record_count: t.samples.length,
    };
    if (t.live) row.live_record_count = data.liveIdx + 1;
    else row.driving_records = t.samples.map((s, i) => toDrivingRecord(t.id, s, i));
    return row;
  });
}

// Driving records of a trip from record_index `from`, at most `max` of them.
// For the live trip this is how new ECU data arrives.
export async function getLiveSamples(trip_id, from = 0, max = Infinity) {
  const found = findTrip(trip_id);
  if (!found) return { driving_records: [], record_count: 0 };
  const { trip } = found;
  const slice = trip.samples.slice(from, from + max);
  return {
    driving_records: slice.map((s, i) => toDrivingRecord(trip_id, s, from + i)),
    record_count: trip.samples.length,
  };
}

// ---------- officers and sessions ----------

// Returns { officer } or { error: 'not_found' | 'suspended' | 'wrong_pin' }.
export async function authenticate(force_number, pin) {
  const officer = findOfficer(force_number);
  if (!officer) return { error: 'not_found' };
  if (officer.status === 'suspended') {
    audit('Failed sign-in: account suspended', officer.full_name);
    return { error: 'suspended' };
  }
  if (pins.get(officer.force_number) !== pin) {
    audit('Failed sign-in: incorrect PIN', officer.full_name);
    return { error: 'wrong_pin' };
  }
  officer.last_sign_in_at = clock();
  session = officer;
  audit('Signed in');
  return { officer: copy(officer) };
}

export async function endSession() {
  if (session) audit('Signed out');
  session = null;
}

export async function getUsers() {
  return db.officer.map(copy);
}

function temporaryPin() {
  const n = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 10000
    : Math.floor(Math.random() * 10000);
  return String(n).padStart(4, '0');
}

// Inserts a new officer (with a temporary PIN) or updates an existing one.
// Pass { reset_pin: true } to issue a new temporary PIN.
// Returns { officer, temporary_pin? } or { error: 'duplicate_force_number' | 'missing_fields' }.
export async function saveUser(row, { reset_pin = false } = {}) {
  const existing = findOfficer(row.force_number);
  const roleLabel = (r) => (r === 'system_admin' ? 'system admin' : 'officer');

  if (!existing || row.is_new) {
    if (existing) return { error: 'duplicate_force_number' };
    if (!row.full_name?.trim() || !row.force_number?.trim() || !row.station?.trim() || !row.role) {
      return { error: 'missing_fields' };
    }
    const officer = {
      force_number: row.force_number.trim(),
      full_name: row.full_name.trim(),
      role: row.role,
      station: row.station.trim(),
      status: 'active',
      last_sign_in_at: null,
    };
    const temporary_pin = temporaryPin();
    db.officer.push(officer);
    pins.set(officer.force_number, temporary_pin);
    audit(`Added user ${officer.full_name} (${officer.force_number}) as ${roleLabel(officer.role)}, ${officer.station}`);
    return { officer: copy(officer), temporary_pin };
  }

  if (row.status && row.status !== existing.status) {
    existing.status = row.status;
    const verb = row.status === 'suspended' ? 'Suspended' : 'Reactivated';
    audit(`${verb} ${existing.full_name} (${existing.force_number})`);
  }
  let temporary_pin;
  if (reset_pin) {
    temporary_pin = temporaryPin();
    pins.set(existing.force_number, temporary_pin);
    audit(`Reset PIN for ${existing.full_name} (${existing.force_number})`);
  }
  return { officer: copy(existing), temporary_pin };
}

// ---------- road data ----------

// Current road data: version plus every segment with its limit in force now.
export async function getRoadData() {
  return {
    data_version: db.data_version[db.data_version.length - 1].data_version,
    applied_versions: db.data_version.map((v) => v.data_version),
    road_segments: db.road_segment.map((s) => {
      const limit = currentLimitRow(s.segment_id);
      return { ...s, limit_kmh: limit.limit_kmh, limit_source: limit.source, limit_note: limit.note };
    }),
  };
}

// The newest Road Authority update not yet applied, or null.
export async function checkForRoadUpdate() {
  const applied = db.data_version.map((v) => v.data_version);
  const latest = ROAD_AUTHORITY_UPDATES[ROAD_AUTHORITY_UPDATES.length - 1];
  if (!latest || applied.includes(latest.version)) return null;
  return {
    data_version: latest.version,
    changes: latest.changes.map((c) => ({
      segment_id: c.seg,
      limit_kmh: c.limit,
      previous_limit_kmh: currentLimitRow(c.seg).limit_kmh,
      reason: c.reason,
    })),
  };
}

export async function applyRoadUpdate(data_version) {
  const update = ROAD_AUTHORITY_UPDATES.find((u) => u.version === data_version);
  if (!update) return { error: 'unknown_version' };
  if (db.data_version.some((v) => v.data_version === data_version)) return { error: 'already_applied' };
  const now = clock();
  for (const c of update.changes) {
    db.speed_limit.push({
      speed_limit_id: ++seq.limit,
      segment_id: c.seg,
      limit_kmh: c.limit,
      effective_from: now,
      data_version,
      source: 'road_authority',
      note: `Road Authority ${data_version}: ${c.reason}`,
    });
  }
  db.data_version.push({ data_version, applied_at: now });
  const n = update.changes.length;
  audit(`Applied Road Authority update ${data_version} (${n} limit change${n === 1 ? '' : 's'})`);
  return { data_version };
}

export async function setSpeedLimit(segment_id, limit_kmh) {
  const segment = db.road_segment.find((s) => s.segment_id === segment_id);
  if (!segment) return { error: 'unknown_segment' };
  const was = currentLimitRow(segment_id).limit_kmh;
  if (was === limit_kmh) return { unchanged: true };
  const now = clock();
  db.speed_limit.push({
    speed_limit_id: ++seq.limit,
    segment_id,
    limit_kmh,
    effective_from: now,
    data_version: dataVersionAt(now),
    source: 'admin_override',
    note: `Admin override: was ${was} km/h`,
  });
  audit(`Changed limit on ${segment.road_name} (${segment_id}) from ${was} to ${limit_kmh} km/h`);
  return { limit_kmh };
}

// ---------- violations, evidence and notices ----------

// Stores the violation, its evidence record and a notice to the registered owner.
// saved_offline_at marks a notice that was prepared offline and synced later.
// Returns the notice row; issuing the same evidence twice returns the first notice.
export async function issueNotice({ violation, evidence_record, notice }) {
  const existing = db.notice.find((n) => n.evidence_number === evidence_record.evidence_number);
  if (existing) return copy(existing);

  const now = clock();
  const violation_id = ++seq.violation;
  db.violation.push({ ...violation, violation_id });
  db.evidence_record.push({ ...evidence_record, violation_id });
  const row = {
    ...notice,
    notice_id: `NTC-${new Date(now).getFullYear()}-${String(++seq.notice).padStart(5, '0')}`,
    evidence_number: evidence_record.evidence_number,
    status: 'issued',
    issued_at: now,
    issued_by: session?.force_number ?? null,
  };
  db.notice.push(row);
  const offline = notice.saved_offline_at ? ' (saved offline)' : '';
  audit(`Issued notice ${row.notice_id}${offline} for ${row.evidence_number} to ${row.owner_name} (${row.registration_number})`);
  return copy(row);
}

export async function getNotices() {
  return db.notice.map(copy);
}

// ---------- audit log ----------

export async function recordAudit(action) {
  audit(action);
}

// Newest first.
export async function getAuditLog() {
  return db.audit_log.map(copy).reverse();
}
