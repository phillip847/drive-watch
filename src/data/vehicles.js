// Demo fleet. Each vehicle is linked to a scannable licence disc and an ECU unit.
export const VEHICLES = [
  {
    disc: 'NAM-D-40217',
    reg: 'N 4521 W',
    make: 'Toyota Hilux 2.8 GD-6',
    year: 2021,
    colour: 'White',
    owner: 'K. Shikongo',
    profile: 'steady',
    seed: 11,
    ecu: 'ECU-IU-00471',
  },
  {
    disc: 'NAM-D-88310',
    reg: 'N 9087 SH',
    make: 'VW Polo Vivo 1.4',
    year: 2019,
    colour: 'Silver',
    owner: 'T. Amukoto',
    profile: 'speeder',
    seed: 23,
    ecu: 'ECU-IU-01893',
  },
  {
    disc: 'NAM-D-15592',
    reg: 'N 230 OK',
    make: 'Ford Ranger 2.0 XLT',
    year: 2022,
    colour: 'Blue',
    owner: 'Oshana Logistics cc',
    profile: 'harsh',
    seed: 37,
    ecu: 'ECU-IU-00932',
  },
  {
    disc: 'NAM-D-67004',
    reg: 'N 77 RU',
    make: 'Nissan NP200',
    year: 2017,
    colour: 'Red',
    owner: 'J. Haufiku',
    profile: 'erratic',
    seed: 51,
    ecu: 'ECU-IU-02206',
  },
];

// Ignores case, spaces and dashes, so "nam d 40217" finds NAM-D-40217.
const normalise = (disc) => String(disc).toUpperCase().replace(/[^A-Z0-9]/g, '');

export function findVehicle(disc) {
  const key = normalise(disc);
  if (!key) return null;
  return VEHICLES.find((v) => normalise(v.disc) === key) ?? null;
}
