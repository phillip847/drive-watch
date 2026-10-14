// Display formatting shared by pages.
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatClock = (ms) => timeFmt.format(ms);
export const formatDateTime = (ms) => dateTimeFmt.format(ms);

export function formatTime(ms, now = Date.now()) {
  const sameDay = new Date(ms).toDateString() === new Date(now).toDateString();
  return sameDay ? timeFmt.format(ms) : dateTimeFmt.format(ms);
}

export function formatLatLng(lat, lng) {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lng < 0 ? 'W' : 'E';
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lng).toFixed(5)}° ${ew}`;
}

export const formatKm = (km) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));
export const pct = (p) => `${Math.round(p * 100)}%`;

export function formatDuration(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${String(rest).padStart(2, '0')} s` : `${m} min`;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const formatDate = (ms) => dateFmt.format(ms);

const fullFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
export const formatDateTimeFull = (ms) => fullFmt.format(ms);
