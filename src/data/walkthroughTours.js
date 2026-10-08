/* ─────────────────────────────────────────────────────────────
   Guided-tour definitions for the flat walkthrough.

   Each stop is a place to stand inside the GLB model:
     x, z   – floor position in model metres
     yaw    – direction to face, radians
              (0 = towards -z, +π/2 = towards -x, -π/2 = towards +x, π = towards +z)
     label  – text on the room buttons and the VR heads-up panel

   Per unit:
     eyeHeight – camera height on screen (VR uses the headset's real height)
     reach     – how far (m) the visitor may slide forward / back from a stop

   The walking routes between stops (through doorways, not walls) live in
   tourRoutes.json and are generated from these stops and the models:
       npm run tours:routes
   Re-run that after moving or adding a stop.

   Positions were picked by rendering each model from the spot.
   ───────────────────────────────────────────────────────────── */

const TOURS = {
  /* public/assets/models/flat.glb — Sketchfab dollhouse bake with low
     interior walls. Bathrooms and balconies left out: knee-high walls and
     no balcony floor in this model, so they look broken at eye level. */
  '4bhk': {
    eyeHeight:   1.6,
    reach:       3.0,
    stops: [
      { id: 'entrance',  label: 'Entrance',       x:  4.5, z: -1.2, yaw:  2.356 },
      { id: 'dining',    label: 'Dining',         x:  4.0, z: -1.5, yaw:  1.571 },
      { id: 'living',    label: 'Living Room',    x:  3.4, z:  2.6, yaw:  1.571 },
      { id: 'bedroom3',  label: 'Bedroom 3',      x: -4.6, z:  1.4, yaw:  2.356 },
      { id: 'bedroom4',  label: 'Bedroom 4',      x: -8.9, z:  3.4, yaw:  0.9   },
      { id: 'kitchen',   label: 'Kitchen',        x:  6.85, z: 0.85, yaw:  3.142 },
      { id: 'bedroom2',  label: 'Bedroom 2',      x:  9.3, z:  2.2, yaw: -2.03  },
      { id: 'mlounge',   label: 'Master Lounge',  x: 15.0, z:  1.3, yaw:  2.5   },
      { id: 'master',    label: 'Master Bedroom', x: 16.6, z:  1.2, yaw: -1.571 },
    ],
  },

  /* public/assets/models/flat_2bhk.glb — full-height walls and doors. */
  '2bhk': {
    eyeHeight:   1.6,
    reach:       3.0,
    stops: [
      { id: 'hallway', label: 'Hallway',        x: -4.35, z: -4.4, yaw:  3.142 },
      { id: 'living',  label: 'Living Room',    x: -3.0,  z:  1.2, yaw:  2.3 },
      { id: 'dining',  label: 'Dining',         x: -0.6,  z:  3.6, yaw:  0.9 },
      { id: 'kitchen', label: 'Kitchen',        x: -2.6,  z:  1.0, yaw: -1.4 },
      { id: 'master',  label: 'Master Bedroom', x: -2.0,  z: -3.2, yaw:  3.142 },
      { id: 'second',  label: 'Second Bedroom', x: -3.3,  z: -4.4, yaw: -1.09 },
      { id: 'bath',    label: 'Bathroom',       x: -5.6,  z: -2.4, yaw:  0.0 },
    ],
  },

  /* public/assets/models/flat_3bhk.glb — dollhouse cut (interior walls a
     little under eye height), so the eye sits slightly lower. */
  '3bhk': {
    eyeHeight:   1.5,
    reach:       3.0,
    stops: [
      { id: 'foyer',    label: 'Foyer',            x: -3.9, z:  2.6,  yaw: -1.571 },
      { id: 'living',   label: 'Living Room',      x:  0.0, z:  3.0,  yaw:  1.4 },
      { id: 'dining',   label: 'Dining',           x:  3.81, z: 3.71, yaw:  0.75 },
      { id: 'kitchen',  label: 'Kitchen',          x:  0.2, z:  0.45, yaw: -1.4 },
      { id: 'balcony',  label: 'Balcony',          x:  4.4, z:  2.2,  yaw:  3.142 },
      { id: 'guest',    label: 'Guest Bedroom',    x: -1.89, z: -0.79, yaw: 1.571 },
      { id: 'children', label: 'Children Bedroom', x: -0.9, z: -3.3,  yaw:  0.94 },
      { id: 'master',   label: 'Master Bedroom',   x:  2.8, z: -3.25, yaw:  0.0 },
    ],
  },
};

export default TOURS;
