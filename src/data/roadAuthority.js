// Simulated Road Authority Road Network System feed of speed limit updates.
export const ROAD_AUTHORITY_UPDATES = [
  {
    version: '9 Oct 2026',
    changes: [
      { seg: 'B1-0847', limit: 100, reason: 'Roadworks near Brakwater' },
      { seg: 'WVB-S-0007', limit: 30, reason: 'School zone limit lowered' },
      { seg: 'WHK-A-0031', limit: 70, reason: 'New residential access roads' },
    ],
  },
];

// The newest update not yet applied, or null when the tablet is up to date.
export function findRoadUpdate(appliedVersions) {
  const latest = ROAD_AUTHORITY_UPDATES[ROAD_AUTHORITY_UPDATES.length - 1];
  return latest && !appliedVersions.includes(latest.version) ? latest : null;
}
