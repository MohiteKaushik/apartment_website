/* ── The plan of one home ────────────────────────────────
   One layout, in unit coordinates, used both to draw the plan (planCanvas)
   and to raise the little walls on the 3D floor plate (FloorPlate):

     u  0 … 1 across the home's width (left → right)
     v  0 … 1 across its depth: 0 is the outer wall, 1 the corridor

   Bedrooms sit along the outer wall, each with its own bath; a balcony
   runs off the last two bedrooms; kitchen, dining and living share the
   open band along the corridor, with the front door in the middle. */

export const BED_BAND = 0.54;      // bedrooms take the outer 54 % of the depth
const BALC = 0.09;                 // balcony depth
const BATH_W = 0.34, BATH_D = 0.2; // bath pocket, as a share of the room / depth

export function planLayout(type) {
  const n = type.startsWith('2') ? 2 : type.startsWith('3') ? 3 : 4;
  const rw = 1 / n;
  const rooms = [], walls = [], doors = [], windows = [];
  const balcFrom = Math.max(0, n - 2);          // balcony across the last two rooms

  for (let i = 0; i < n; i++) {
    const u0 = i * rw, u1 = (i + 1) * rw;
    const hasBalc = i >= balcFrom;
    const v0 = hasBalc ? BALC : 0;
    const master = i === n - 1;
    rooms.push({ id: `bed${i}`, type: 'bed', u0, v0, u1: u1, v1: BED_BAND,
      label: master ? 'Master Bedroom' : n === 2 && i === 0 ? 'Bedroom' : `Bedroom ${i + 1}`,
      bath: { u0: u1 - BATH_W * rw, v0: BED_BAND - BATH_D, u1, v1: BED_BAND } });
    rooms.push({ id: `bath${i}`, type: 'bath', u0: u1 - BATH_W * rw, v0: BED_BAND - BATH_D, u1, v1: BED_BAND, label: 'Bath' });
    // walls of the bath pocket
    walls.push({ u0: u1 - BATH_W * rw, v0: BED_BAND - BATH_D, u1: u1 - BATH_W * rw, v1: BED_BAND, kind: 'inner' });
    walls.push({ u0: u1 - BATH_W * rw, v0: BED_BAND - BATH_D, u1, v1: BED_BAND - BATH_D, kind: 'inner' });
    doors.push({ u: u1 - BATH_W * rw, v: BED_BAND - BATH_D * 0.5, axis: 'v', size: BATH_D * 0.55, into: 'right' });
    // wall between rooms
    if (i > 0) walls.push({ u0, v0: 0, u1: u0, v1: BED_BAND, kind: 'inner' });
    // door from the living band, swinging into the room
    doors.push({ u: u0 + rw * 0.3, v: BED_BAND, axis: 'u', size: Math.min(0.11, rw * 0.3), into: 'up' });
    // window on the outer wall (or balcony door)
    windows.push({ u0: u0 + rw * 0.2, u1: u1 - rw * 0.2, v: v0, glass: hasBalc });
    if (hasBalc) {
      rooms.push({ id: `balc${i}`, type: 'balcony', u0, v0: 0, u1, v1: BALC, label: i === balcFrom ? 'Balcony' : '' });
      walls.push({ u0, v0: BALC, u1, v1: BALC, kind: 'inner' });
    }
  }
  // the long wall between bedrooms and the living band
  walls.push({ u0: 0, v0: BED_BAND, u1: 1, v1: BED_BAND, kind: 'inner' });

  // living band
  rooms.push({ id: 'kitchen', type: 'kitchen', u0: 0, v0: BED_BAND, u1: 0.25, v1: 0.84, label: 'Kitchen' });
  rooms.push({ id: 'dining',  type: 'dining',  u0: 0.25, v0: BED_BAND, u1: 0.52, v1: 1, label: 'Dining' });
  rooms.push({ id: 'living',  type: 'living',  u0: 0.52, v0: BED_BAND, u1: 1, v1: 1, label: 'Living' });
  rooms.push({ id: 'foyer',   type: 'foyer',   u0: 0.0, v0: 0.84, u1: 0.25, v1: 1, label: 'Foyer' });
  walls.push({ u0: 0.25, v0: BED_BAND, u1: 0.25, v1: 0.74, kind: 'inner' });   // kitchen half-wall
  doors.push({ u: 0.125, v: 1, axis: 'u', size: 0.065, into: 'up', front: true });

  // perimeter
  walls.push({ u0: 0, v0: 0, u1: 1, v1: 0, kind: 'outer' });
  walls.push({ u0: 0, v0: 1, u1: 1, v1: 1, kind: 'outer' });
  walls.push({ u0: 0, v0: 0, u1: 0, v1: 1, kind: 'outer' });
  walls.push({ u0: 1, v0: 0, u1: 1, v1: 1, kind: 'outer' });

  return { n, rooms, walls, doors, windows };
}

/* Wall segments with the door openings cut out (for the 3D walls). */
export function wallSegments(layout) {
  const out = [];
  layout.walls.forEach((w) => {
    const horizontal = w.v0 === w.v1;
    let segs = [[horizontal ? w.u0 : w.v0, horizontal ? w.u1 : w.v1]];
    layout.doors.forEach((d) => {
      const onWall = horizontal ? (d.axis === 'u' && Math.abs(d.v - w.v0) < 1e-6 && d.u > w.u0 && d.u < w.u1)
                                : (d.axis === 'v' && Math.abs(d.u - w.u0) < 1e-6 && d.v > w.v0 && d.v < w.v1);
      if (!onWall) return;
      const c = horizontal ? d.u : d.v, h = d.size / 2;
      segs = segs.flatMap(([a, b]) => (c - h > a && c + h < b ? [[a, c - h], [c + h, b]] : [[a, b]]));
    });
    segs.forEach(([a, b]) => out.push(horizontal
      ? { u0: a, v0: w.v0, u1: b, v1: w.v0, kind: w.kind }
      : { u0: w.u0, v0: a, u1: w.u0, v1: b, kind: w.kind }));
  });
  return out;
}
