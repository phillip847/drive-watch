import { useMemo } from 'react';
import { useApp } from './AppContext.jsx';
import { useVehicleData } from './useVehicleData.js';
import { withLiveFeed } from '../data/analysis.js';

// Vehicle data for the scanned disc, with the live trip as revealed by the feed so far.
export function useLiveVehicle() {
  const { state } = useApp();
  const disc = state.currentDisc;
  const data = useVehicleData(disc);
  const feed = disc ? state.liveFeeds[disc] : null;
  return useMemo(() => (data && feed ? withLiveFeed(data, feed) : null), [data, feed]);
}
