// Converts repository rows (database column names) into the shapes the UI and
// analysis code use, and back. If the schema changes, this is the file to update.

const ROLE_FROM_ROW = { officer: 'officer', system_admin: 'admin' };
const ROLE_TO_ROW = { officer: 'officer', admin: 'system_admin' };
const EVENT_FROM_ROW = { harsh_braking: 'brake', harsh_acceleration: 'accel' };

export const toVehicle = ({ vehicle, disc, ecu_unit }) => ({
  id: vehicle.vehicle_id,
  disc: disc.disc_number,
  reg: vehicle.registration_number,
  make: vehicle.make_model,
  year: vehicle.model_year,
  colour: vehicle.colour,
  owner: vehicle.owner_name,
  ecu: ecu_unit.ecu_serial,
});

export const toSample = (r) => ({
  t: r.recorded_at,
  speed: r.speed_kmh,
  limit: r.speed_limit_kmh,
  road: r.road_name,
  seg: r.segment_id,
  lat: r.latitude,
  lng: r.longitude,
  rpm: r.engine_rpm,
  ev: r.event_type ? { type: EVENT_FROM_ROW[r.event_type], g: r.event_g } : null,
  roadVersion: r.road_data_version,
});

export const toTrip = (row) => ({
  id: row.trip_id,
  routeName: row.route_name,
  startRoad: row.start_road_name,
  endRoad: row.end_road_name,
  start: row.started_at,
  end: row.ended_at,
  live: row.is_live,
  totalSamples: row.record_count,
  liveCount: row.live_record_count ?? null,
  samples: (row.driving_records ?? []).map(toSample),
});

export const toUser = (o) => ({
  id: o.force_number,
  name: o.full_name,
  role: ROLE_FROM_ROW[o.role] ?? o.role,
  station: o.station,
  status: o.status,
  lastSignIn: o.last_sign_in_at,
});

export const toOfficerRow = (u) => ({
  force_number: u.id,
  full_name: u.name,
  role: ROLE_TO_ROW[u.role] ?? u.role,
  station: u.station,
  status: u.status,
});

export const toRoadData = (r) => ({
  version: r.data_version,
  appliedVersions: r.applied_versions,
  segments: r.road_segments.map((s) => ({
    id: s.segment_id,
    road: s.road_name,
    type: s.segment_type,
    limit: s.limit_kmh,
    note: s.limit_note,
  })),
});

export const toRoadUpdate = (u) =>
  u && {
    version: u.data_version,
    changes: u.changes.map((c) => ({ seg: c.segment_id, limit: c.limit_kmh, was: c.previous_limit_kmh, reason: c.reason })),
  };

export const toNotice = (n) => ({
  id: n.notice_id,
  evidenceNo: n.evidence_number,
  disc: n.disc_number,
  reg: n.registration_number,
  owner: n.owner_name,
  status: n.status,
  issuedAt: n.issued_at,
});

export const toAuditEntry = (a) => ({ id: a.audit_id, time: a.occurred_at, user: a.actor_name, action: a.action });

export const toViolationRow = (v, tripId) => ({
  trip_id: tripId,
  segment_id: v.seg,
  started_at: v.start,
  ended_at: v.end,
  duration_s: v.duration,
  peak_speed_kmh: v.peak,
  speed_limit_kmh: v.limit,
  excess_kmh: v.excess,
  severity: v.severity,
});
