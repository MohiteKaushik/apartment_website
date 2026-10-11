/* ─────────────────────────────────────────────────────────────
   Where things are inside public/assets/models/tower.glb, in scene
   units (the model drawn at MODEL_SCALE, grounded at y = 0).

   Measured from the geometry (scripts in the session notes): the
   storeys repeat every 0.375 units from the podium roof at y ≈ 2.82,
   and both towers stand 40 storeys above the podium before the
   mechanical crown. The two towers sit on opposite corners of the
   square podium:

       A  "Aureum"  — the wide tower at the back-left  (x < 0, z < 0)
       B  "Regalis" — the wide tower at the front-right (x > 0, z > 0)

   Each tower has a slightly wider lower section (floors 1–29) and a
   narrower shaft above it.
   ───────────────────────────────────────────────────────────── */

export const FLOORS = 40;
export const FLOOR0 = 2.82;      // y of floor 1's slab (podium roof)
export const PITCH  = 0.375;     // storey height
export const PODIUM_TOP = 2.95;  // below this the mesh is the shared podium

export const floorBase = (f) => FLOOR0 + (f - 1) * PITCH;
export const floorMid  = (f) => floorBase(f) + PITCH / 2;
export const floorTop  = (f) => floorBase(f) + PITCH;

/* Triangles above the podium belong to A when x < SPLIT_X, else B. */
export const SPLIT_X = 1.2;

export const TOWERS = {
  A: {
    centre: [-2.52, -3.92],
    lower:  [5.4, 2.95],      // x by z, floors 1–29
    upper:  [5.1, 2.55],      // floors 30–40
    long:   'x',              // the long side of the floor plate
  },
  B: {
    centre: [3.92, 2.52],
    lower:  [2.95, 5.4],
    upper:  [2.55, 5.1],
    long:   'z',
  },
};

export const footprint = (id, floor) => {
  const t = TOWERS[id];
  return floor >= 30 ? t.upper : t.lower;
};

/* Floor bands shown on the page. */
export const zoneFor = (f) => (f >= 31 ? 'penthouse' : f >= 16 ? 'premium' : 'signature');
export const ZONES = {
  penthouse: { label: 'Penthouse',  floors: '31–40', bhk: '4 BHK',       colour: '#c49a3c' },
  premium:   { label: 'Premium',    floors: '16–30', bhk: '3 & 4 BHK',   colour: 'rgba(255,255,255,0.5)' },
  signature: { label: 'Signature',  floors: '1–15',  bhk: '2, 3 & 4 BHK', colour: 'rgba(255,255,255,0.22)' },
};
