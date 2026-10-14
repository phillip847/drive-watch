// Session, device and live-feed state, plus cached repository data.
// Stored data itself lives in the repository (src/data/repository.js).
export function reducer(state, a) {
  switch (a.type) {
    case 'SIGNED_IN':
      return { ...state, currentUser: a.user };

    case 'SIGNED_OUT':
      return { ...state, currentUser: null, currentDisc: null, users: [], auditLog: [] };

    case 'SET_ONLINE':
      if (state.online === a.online) return state;
      return a.online
        ? { ...state, online: true, bufferedCount: 0, offlineScans: [] }
        : { ...state, online: false };

    case 'SET_DISC': {
      const offlineScans =
        state.online || state.offlineScans.includes(a.disc) ? state.offlineScans : [...state.offlineScans, a.disc];
      return { ...state, currentDisc: a.disc, offlineScans };
    }

    case 'LIVE_INIT': {
      if (state.liveFeeds[a.disc]) return state;
      const feed = { tripId: a.tripId, samples: a.samples, total: a.total, ended: a.samples.length >= a.total };
      return { ...state, liveFeeds: { ...state.liveFeeds, [a.disc]: feed } };
    }

    case 'LIVE_APPEND': {
      const feed = state.liveFeeds[a.disc];
      // Ignore late or duplicate responses.
      if (!feed || feed.ended || a.from !== feed.samples.length || a.samples.length === 0) return state;
      const samples = [...feed.samples, ...a.samples];
      const next = { ...feed, samples, total: a.total, ended: samples.length >= a.total };
      return {
        ...state,
        liveFeeds: { ...state.liveFeeds, [a.disc]: next },
        bufferedCount: state.online ? state.bufferedCount : state.bufferedCount + a.samples.length,
      };
    }

    case 'LOADED':
      return { ...state, ...a.data };

    case 'ROAD_UPDATE_FOUND':
      return { ...state, roadUpdate: a.update };

    case 'QUEUE':
      return { ...state, outbox: [...state.outbox, a.item] };

    case 'OUTBOX_SENT':
      return { ...state, outbox: state.outbox.slice(a.count) };

    default:
      throw new Error(`Unknown action: ${a.type}`);
  }
}
