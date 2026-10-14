// Data access layer used by the UI. Everything is async so these functions
// can later be replaced with REST calls without changing callers.
import { VEHICLES, findVehicle } from './vehicles.js';
import { getVehicleData } from './simulator.js';
import { findRoadUpdate } from './roadAuthority.js';

export async function listVehicles() {
  return VEHICLES;
}

export async function lookupDisc(disc) {
  return findVehicle(disc);
}

export async function fetchVehicleData(disc) {
  return getVehicleData(disc);
}

export async function checkRoadUpdates(appliedVersions) {
  return findRoadUpdate(appliedVersions);
}
