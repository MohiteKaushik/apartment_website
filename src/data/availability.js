/* ── Availability of every home ──────────────────────────
   Until this is wired to real sales data, each home's status comes from
   a fixed hash of (tower, floor, home), so it is the same on every visit
   and in every view: roughly 55 % available, 20 % reserved, 25 % sold,
   with the lower floors a little more sold out than the penthouses. */

export const STATUS = {
  available: { label: 'Available', colour: '#3fd39b', dim: 'rgba(63,211,155,0.16)' },
  reserved:  { label: 'Reserved',  colour: '#ff9f43', dim: 'rgba(255,159,67,0.16)' },
  sold:      { label: 'Sold',      colour: '#f0556a', dim: 'rgba(240,85,106,0.16)' },
};

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
};

export function statusOf(towerId, floor, flatId) {
  const r = hash(`${towerId}:${floor}:${flatId}`);
  const soldShare = 0.34 - (floor / 40) * 0.2;        // 34 % on floor 1 … 14 % on floor 40
  if (r < soldShare) return 'sold';
  if (r < soldShare + 0.2) return 'reserved';
  return 'available';
}

/* { available, reserved, sold } counts for one floor's four homes */
export function floorSummary(towerId, floor, flatIds) {
  const out = { available: 0, reserved: 0, sold: 0 };
  flatIds.forEach((id) => { out[statusOf(towerId, floor, id)] += 1; });
  return out;
}

/* the status that colours a whole floor: sold out → sold, nothing free → reserved, else available */
export function floorStatus(towerId, floor, flatIds) {
  const s = floorSummary(towerId, floor, flatIds);
  if (s.available === 0 && s.reserved === 0) return 'sold';
  if (s.available === 0) return 'reserved';
  return 'available';
}
