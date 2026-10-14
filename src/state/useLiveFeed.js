import { useEffect } from 'react';
import { fetchVehicleData } from '../data/api.js';

export const LIVE_TICK_MS = 650;
const SAMPLES_PER_TICK = 2;

// Streams the current vehicle's live trip: starts at the simulator's liveIdx,
// then reveals 2 more ECU samples every tick until the trip ends.
export function useLiveFeed(state, dispatch) {
  const disc = state.currentDisc;
  const feed = disc ? state.liveFeeds[disc] : null;
  const hasFeed = Boolean(feed);
  const ended = feed?.ended ?? false;

  useEffect(() => {
    if (!disc || hasFeed) return undefined;
    let cancelled = false;
    fetchVehicleData(disc).then((d) => {
      if (!cancelled && d) dispatch({ type: 'LIVE_INIT', disc, raw: d.trips[0].samples, idx: d.liveIdx });
    });
    return () => {
      cancelled = true;
    };
  }, [disc, hasFeed, dispatch]);

  useEffect(() => {
    if (!disc || !hasFeed || ended) return undefined;
    const id = setInterval(() => dispatch({ type: 'LIVE_TICK', disc, step: SAMPLES_PER_TICK }), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [disc, hasFeed, ended, dispatch]);
}
