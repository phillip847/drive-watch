// Road data changes are timestamped, so each ECU sample is checked against the
// limit and data version that were in force at the moment it was captured.

function latestBefore(entries, t) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].from <= t) return entries[i];
  }
  return null;
}

// Returns null when the segment's limit has not changed since start-up.
export function limitAt(roads, seg, t) {
  return latestBefore(roads.limitHistory[seg] ?? [], t)?.limit ?? null;
}

export function versionAt(roads, t) {
  return latestBefore(roads.versionHistory, t)?.version ?? roads.versionHistory[0].version;
}

export function stampSample(sample, roads) {
  return {
    ...sample,
    limit: limitAt(roads, sample.seg, sample.t) ?? sample.limit,
    roadVersion: versionAt(roads, sample.t),
  };
}

// Applies new limits from `time` onwards; `notes` maps segment to a change note.
export function withLimits(roads, changes, time) {
  const limits = { ...roads.limits };
  const changed = { ...roads.changed };
  const limitHistory = { ...roads.limitHistory };
  for (const { seg, limit, note } of changes) {
    limits[seg] = limit;
    changed[seg] = note;
    limitHistory[seg] = [...(limitHistory[seg] ?? []), { from: time, limit }];
  }
  return { ...roads, limits, changed, limitHistory };
}
