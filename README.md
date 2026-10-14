# DriveWatch

Tablet app for Namibian traffic officers, part of a Vehicle Driver-Behaviour
Monitoring System that replaces fixed speed cameras. Each vehicle's ECU reports
speed, engine data and GPS position. The vehicle is linked to a scannable licence
disc. Speed is checked against Road Authority limits for the road segment, and
driver behaviour is scored and predicted from recorded trips.

All data is simulated in the browser for now (see [Simulation](#simulation)).

## Running it

Requires Node 18 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest unit tests
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The dev server listens on your network too (`host: true`), so you can open it on
a tablet. Evidence fingerprints use the browser's Web Crypto API, which only works
over https or on localhost. Over plain http on the network the fingerprint shows
as unavailable and notices can't be issued. Serve over https for tablet testing.

## Demo accounts

The sign-in screen has buttons that fill these in.

| Account | Force number | PIN | Role |
|---|---|---|---|
| Sgt. N. Amupolo | NamPol-30418 | 2468 | Traffic officer, Windhoek City |
| Cst. L. Iipinge | NamPol-27751 | 1111 | Traffic officer, Okahandja |
| Insp. R. van Wyk | NamPol-31902 | 2222 | Traffic officer, **suspended** |
| Cst. P. Nangolo | NamPol-29044 | 3333 | Traffic officer, Walvis Bay |
| M. Shilongo | ADM-0007 | 1357 | System admin, Head office |

Officers get Scan, Vehicle, Warnings, History and Evidence. Admins get Users, Road
data and Activity. Each role is kept out of the other's pages.

Demo discs: `NAM-D-40217` (steady driver), `NAM-D-88310` (speeder),
`NAM-D-15592` (harsh braking and acceleration), `NAM-D-67004` (erratic).

Everything is held in memory, so reloading the page resets the data and signs you out.

## Simulation

**Trips** (`src/data/simulator.js`). Each vehicle has a driver profile and a seed.
A seeded random generator (mulberry32) produces the same data on every load.
Every vehicle has 6 trips over three real routes: Windhoek to Okahandja,
Windhoek to Hosea Kutako Airport, and Swakopmund to Walvis Bay. Each trip has one
ECU reading every 5 seconds: speed, posted limit, road segment, GPS, rpm and
harsh braking or acceleration events. The driver aims for the limit times the
profile's factor, plus noise and, for the erratic profile, a slow oscillation.

**Live trip.** The newest trip is in progress. It opens 32% of the way through,
with the latest reading at "now". The live feed (`src/state/useLiveFeed.js`)
fetches 2 more readings every 650 ms until the trip ends, and keeps running when
the officer changes page. While the tablet is offline, those readings count as
buffered on the vehicle unit. They sync when it goes back online.

**Speed checks** (`src/data/analysis.js`). A violation is 2 or more consecutive
readings over the limit by more than 5 km/h. It is serious at 30 km/h or 40% over,
major at 15 km/h over, and minor otherwise. Each trip gets a 0 to 100 score from
time over the limit, harsh events per 100 km, peak excess and speed variability.
The cumulative score is weighted by distance. The predictions are sigmoid curves
over the same measures. They are a prototype, not a trained model.

**Road data.** Limit changes are timestamped, whether they come from the Road
Authority update or an admin override. Each driving record is checked against the
limit and data version in force when it was captured. A change reaches live
checks straight away, and earlier records keep the limit that applied then.
Try it: as admin, lower B1-0847 under Road data. Then sign in as an officer and
scan NAM-D-67004. The dashed limit line on the live chart steps down from 120 to
the new limit.

**Evidence.** For a violation, the app builds an evidence record and shows a
SHA-256 fingerprint of it. A notice issued offline is saved on the tablet and
issued on reconnect, along with any audit entries made offline.

## Data layer

```
pages and state ──> src/data/api.js ──> src/data/repository.js
                    (UI shapes, via      (async functions, rows named after
                     mappers.js)          the database tables)
```

- `repository.js` is the only place stored data is read or written:
  `getVehicleByDisc`, `getTrips`, `getLiveSamples`, `getUsers`, `saveUser`,
  `getRoadData`, `applyRoadUpdate`, `setSpeedLimit`, `issueNotice` and
  `getAuditLog`. It also has `getVehicles`, `authenticate`, `endSession`,
  `checkForRoadUpdate`, `getNotices` and `recordAudit`. The current version
  keeps everything in memory, backed by the simulator. Like a server, it checks
  PINs (which never leave it) and writes the audit log.
- Rows use the column names of the tables `vehicle`, `disc`, `ecu_unit`, `trip`,
  `driving_record`, `road_segment`, `speed_limit`, `violation`,
  `evidence_record`, `notice`, `officer` and `audit_log`.
- `mappers.js` turns rows into the shapes the pages use. To move to a REST back
  end, write a `repository.js` with the same exports that calls the API. The
  pages, `api.js` and the mappers stay as they are.

## Project layout

```
src/
  data/        simulator, demo vehicles and roads, analysis, evidence,
               repository, mappers, api
  state/       app context, reducer, live feed, auth messages
  components/  layout, charts, speed sign, plate, toast and other shared UI
  pages/       SignIn, officer/*, admin/*
  styles/      tokens.css (colours, fonts, sizes), global and per-page CSS
```

Design tokens follow the system light/dark setting. Touch targets are at least
48 px, the layout works from 360 px to 1280 px wide, and wide tables scroll
inside their own box.
