import { useEffect, useState } from 'react';
import { fetchVehicleData } from '../data/api.js';

// Loads vehicle data for a disc; returns null while loading or when no disc is set.
export function useVehicleData(disc) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    if (!disc) return undefined;
    fetchVehicleData(disc).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [disc]);
  return data;
}
