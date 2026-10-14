import { useEffect, useRef } from 'react';
import { fetchLiveSamples, fetchVehicleData } from '../data/api.js';

export const LIVE_TICK_MS = 650;
const SAMPLES_PER_TICK = 2;

// Streams the scanned vehicle's live trip: first the records captured so far,
// then 2 more ECU records every tick until the trip ends.
export function useLiveFeed(state, dispatch) {
  const disc = state.currentDisc;
  const feed = disc ? state.liveFeeds[disc] : null;
  const hasFeed = Boolean(feed);
  const ended = feed?.ended ?? false;
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    if (!disc || hasFeed) return undefined;
    let cancelled = false;
    (async () => {
      const data = await fetchVehicleData(disc);
      const live = data?.trips.find((t) => t.live);
      if (cancelled || !live) return;
      const { samples, total } = await fetchLiveSamples(live.id, 0, live.liveCount);
      if (!cancelled) dispatch({ type: 'LIVE_INIT', disc, tripId: live.id, samples, total });
    })();
    return () => {
      cancelled = true;
    };
  }, [disc, hasFeed, dispatch]);

  useEffect(() => {
    if (!disc || !hasFeed || ended) return undefined;
    let cancelled = false;
    let busy = false;
    const id = setInterval(async () => {
      if (busy) return;
      busy = true;
      const { tripId, samples: sofar } = feedRef.current;
      const from = sofar.length;
      const { samples, total } = await fetchLiveSamples(tripId, from, SAMPLES_PER_TICK);
      busy = false;
      if (!cancelled) dispatch({ type: 'LIVE_APPEND', disc, from, samples, total });
    }, LIVE_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [disc, hasFeed, ended, dispatch]);
}
