// Demo routes with Road Authority speed limits (km/h) per segment.
// heading is a [dLat, dLng] direction; it is normalised by the simulator.
export const ROUTES = [
  {
    id: 'A',
    name: 'Windhoek to Okahandja',
    origin: [-22.5609, 17.0658],
    heading: [-0.4, 0.9],
    segments: [
      { road: 'Independence Ave, Windhoek', id: 'WHK-U-0112', limit: 60, km: 2.5 },
      { road: 'Western Bypass, Windhoek', id: 'WHK-A-0031', limit: 80, km: 6 },
      { road: 'B1 Windhoek to Okahandja', id: 'B1-0847', limit: 120, km: 38 },
      { road: 'B1 through Okahandja', id: 'OKA-U-0004', limit: 60, km: 2.5 },
    ],
  },
  {
    id: 'B',
    name: 'Windhoek to Hosea Kutako Airport',
    origin: [-22.57, 17.09],
    heading: [0.1, 1],
    segments: [
      { road: 'Sam Nujoma Dr, Windhoek', id: 'WHK-U-0207', limit: 60, km: 3.5 },
      { road: 'Hosea Kutako Dr', id: 'WHK-A-0058', limit: 70, km: 3 },
      { road: 'B6 to Hosea Kutako Airport', id: 'B6-0122', limit: 120, km: 34 },
    ],
  },
  {
    id: 'C',
    name: 'Swakopmund to Walvis Bay and C14',
    origin: [-22.678, 14.527],
    heading: [-1, -0.1],
    segments: [
      { road: 'B2 Swakopmund to Walvis Bay', id: 'B2-0310', limit: 100, km: 28 },
      { road: 'Sam Nujoma Ave, Walvis Bay', id: 'WVB-U-0019', limit: 60, km: 3 },
      { road: 'School zone, Kuisebmond', id: 'WVB-S-0007', limit: 40, km: 1 },
      { road: 'C14 towards Solitaire', id: 'C14-0011', limit: 100, km: 18 },
    ],
  },
];

export function segmentType(id) {
  if (id.includes('-U-')) return 'Urban';
  if (id.includes('-A-')) return 'Arterial';
  if (id.includes('-S-')) return 'School zone';
  return 'National road';
}

export function routeLength(route) {
  return route.segments.reduce((sum, s) => sum + s.km, 0);
}
