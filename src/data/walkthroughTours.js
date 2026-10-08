/* ─────────────────────────────────────────────────────────────
   Guided-tour definitions for the flat walkthrough.

   Each stop is a place to stand inside the GLB model:
     x, z   – floor position in model metres
     yaw    – direction to face, radians (0 = towards -z, +π/2 = towards -x)
     label  – text on the room buttons and the VR heads-up panel

   The camera glides between stops along `corridorZ`, the open hallway that
   runs the length of the flat, so it never cuts through a room diagonally.
   Stops closer than `directBelow` metres glide straight to each other.

   Units with no entry here keep the free-walk controls.

   Positions were picked by rendering the model from each spot; to add or
   move one, change the numbers and reload — nothing else to update.
   ───────────────────────────────────────────────────────────── */

const TOURS = {
  /* public/assets/models/flat.glb — 4 BHK (Sketchfab dollhouse bake).
     Bathrooms and balconies are left out on purpose: in this model they have
     knee-high walls and no balcony floor, so they look broken at eye level. */
  '4bhk': {
    eyeHeight:   1.6,
    corridorZ:   0.5,
    directBelow: 2.5,
    stops: [
      { id: 'entrance',  label: 'Entrance',       x:  4.5, z: -1.2, yaw:  2.356 },
      { id: 'dining',    label: 'Dining',         x:  4.0, z: -1.5, yaw:  1.571 },
      { id: 'living',    label: 'Living Room',    x:  3.4, z:  2.6, yaw:  1.571 },
      { id: 'bedroom3',  label: 'Bedroom 3',      x: -4.6, z:  1.4, yaw:  2.356 },
      { id: 'bedroom4',  label: 'Bedroom 4',      x: -8.9, z:  3.4, yaw:  0.9   },
      { id: 'kitchen',   label: 'Kitchen',        x:  7.0, z:  0.8, yaw:  3.142 },
      { id: 'bedroom2',  label: 'Bedroom 2',      x: 10.0, z:  1.3, yaw: -2.356 },
      { id: 'mlounge',   label: 'Master Lounge',  x: 15.0, z:  1.3, yaw:  2.5   },
      { id: 'master',    label: 'Master Bedroom', x: 16.6, z:  1.2, yaw: -1.571 },
    ],
  },
};

export default TOURS;
