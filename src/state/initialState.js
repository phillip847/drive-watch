export function createInitialState() {
  return {
    // Session and device
    currentUser: null,
    online: true,
    bufferedCount: 0, // ECU records waiting on the vehicle unit while offline
    currentDisc: null,
    liveFeeds: {}, // { disc: { tripId, samples, total, ended } } live ECU records received so far
    offlineScans: [], // discs opened while offline, cleared when back online
    outbox: [], // writes made offline, sent in order on reconnect

    // Copies of repository data, refreshed after every write
    users: [],
    roads: { version: '', appliedVersions: [], segments: [] },
    roadUpdate: null, // Road Authority update found but not yet applied
    notices: [],
    auditLog: [],
  };
}
