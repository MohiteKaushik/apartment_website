import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PODIUM_TOP, SPLIT_X, PITCH, floorMid, floorTop } from '../../data/towerGeometry';

export const TOWER_GLB = '/assets/models/tower.glb';
/* The GLB is a little shorter than the towers in the film; drawn 22% larger
   (about its base) it covers them completely at the hero camera. */
export const MODEL_SCALE = 0.0122;

useGLTF.preload(TOWER_GLB);

const GOLD = [0.77, 0.60, 0.24];

/* The tower material with three extra controls:
     uGlow   whole piece lit gold (tower cards / amenities hover)
     uBand   one storey lit gold: centre y, height, strength
     uDim    darkens everything outside the band so the lit floor reads
   plus a clipping plane that cuts the tower off above a chosen height
   (the floor-plate view). */
function makeTowerMaterial(base) {
  const mat = base.clone();
  mat.emissive = new THREE.Color(0, 0, 0);
  mat.emissiveIntensity = 1;
  const u = {
    uGlow:  { value: 0 },
    uBandY: { value: 0 },
    uBandH: { value: PITCH },
    uBandK: { value: 0 },
    uDim:   { value: 0 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying float vWorldY;\nuniform float uGlow, uBandY, uBandH, uBandK, uDim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float band = (1.0 - smoothstep(uBandH * 0.5, uBandH * 0.5 + 0.05, abs(vWorldY - uBandY))) * uBandK;
        diffuseColor.rgb *= mix(1.0, 0.58, uDim * (1.0 - band));
        totalEmissiveRadiance += vec3(${GOLD.join(',')}) * (band * 1.1 + uGlow);`);
  };
  mat.customProgramCacheKey = () => 'vayam-tower';
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
  mat.clippingPlanes = [plane];
  mat.userData.clip = plane;
  return mat;
}

const damp = (v, t, k) => v + (t - v) * k;

/*
  The GLB is one merged mesh. We split its triangles into three pieces so
  each can be lit or cut on its own:
    A        tower A  (above the podium, x < SPLIT_X)
    B        tower B  (above the podium, x >= SPLIT_X)
    podium   everything below PODIUM_TOP (deck, pools, roof garden)

  `stateRef.current` is what the page wants to show, read every frame:
    { view, towerId, floor, hoverTower, hoverFloor, hoverAmenities }
*/
export default function TowerModel({ stateRef, growRef }) {
  const { scene } = useGLTF(TOWER_GLB);
  const gl = useThree((s) => s.gl);
  const parts = useRef({ A: null, B: null, podium: null });
  const clipY = useRef({ A: 100, B: 100 });

  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  useEffect(() => {
    parts.current = { A: null, B: null, podium: null };

    scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (isFinite(box.min.y)) scene.position.y = -box.min.y;
    // world matrices from the root down, so the 180° turn of the parent
    // group is included when we sort triangles by world position
    let top = scene; while (top.parent) top = top.parent;
    top.updateMatrixWorld(true);

    // the building is the tallest mesh with the most triangles
    let mainMesh = null, best = -1;
    scene.traverse((c) => {
      if (!c.isMesh) return;
      const b = new THREE.Box3().setFromObject(c);
      const h = b.max.y - b.min.y, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      const score = (s > 0 ? h / s : 0) * Math.log(c.geometry.attributes.position.count + 1);
      if (score > best) { best = score; mainMesh = c; }
    });
    if (!mainMesh) return undefined;

    const geo = mainMesh.geometry, pos = geo.attributes.position, idx = geo.index;
    const world = mainMesh.matrixWorld;
    const n = idx ? idx.count / 3 : pos.count / 3;
    const tris = { A: [], B: [], podium: [] };
    const tmp = new THREE.Vector3();
    for (let t = 0; t < n; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      tmp.set((pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3,
              (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3,
              (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3).applyMatrix4(world);
      const key = tmp.y < PODIUM_TOP ? 'podium' : tmp.x < SPLIT_X ? 'A' : 'B';
      tris[key].push(i0, i1, i2);
    }

    const base = Array.isArray(mainMesh.material) ? mainMesh.material[0] : mainMesh.material;
    const made = [];
    const make = (list) => {
      if (!list.length) return null;
      const g = geo.clone();
      g.setIndex(new THREE.BufferAttribute(new (pos.count > 65535 ? Uint32Array : Uint16Array)(list), 1));
      const m = new THREE.Mesh(g, makeTowerMaterial(base));
      m.matrix.copy(mainMesh.matrix);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      mainMesh.parent.add(m);
      made.push(m);
      return m;
    };
    parts.current = { A: make(tris.A), B: make(tris.B), podium: make(tris.podium) };
    mainMesh.visible = false;

    return () => {
      made.forEach((m) => { m.geometry.dispose(); m.material.dispose(); m.parent?.remove(m); });
      mainMesh.visible = true;
    };
  }, [scene]);

  useFrame((_, dt) => {
    const s = stateRef.current || {};
    const k = 1 - Math.exp(-dt * 7);      // frame-rate independent smoothing
    const kc = 1 - Math.exp(-dt * 3.2);   // the cut-away sweeps a little slower
    const { A, B, podium } = parts.current;

    [['A', A], ['B', B]].forEach(([id, mesh]) => {
      if (!mesh) return;
      const u = mesh.material.userData.u;
      const active = s.towerId === id;
      const glowOn = s.view === 'hero' && s.hoverTower === id;
      u.uGlow.value = damp(u.uGlow.value, glowOn ? 0.5 : 0, k);

      // floor highlight while choosing a floor
      const bandOn = s.view === 'floor' && active && s.hoverFloor;
      if (bandOn) u.uBandY.value = damp(u.uBandY.value, floorMid(s.hoverFloor), 1 - Math.exp(-dt * 9));
      u.uBandK.value = damp(u.uBandK.value, bandOn ? 1 : 0, k);
      u.uDim.value   = damp(u.uDim.value, bandOn ? 1 : 0, k);

      // cut the tower off above the chosen floor in the floor-plate view
      const cutTo = (s.view === 'unit' || s.view === 'unitZoom') && active && s.floor ? floorTop(s.floor) + 0.005 : 22;
      clipY.current[id] = damp(clipY.current[id], cutTo, kc);
      mesh.material.userData.clip.constant = clipY.current[id] >= 21.9 ? 100 : clipY.current[id];
    });

    if (podium) {
      const u = podium.material.userData.u;
      u.uGlow.value = damp(u.uGlow.value, s.hoverAmenities ? 0.28 : 0, k);
    }
  });

  // Turned 180° so the pool deck faces the viewer like in the film. The
  // group's scale is animated by the camera rig (the model "grows out" of the still).
  return (
    <group ref={growRef} rotation={[0, Math.PI, 0]}>
      <primitive object={scene} scale={MODEL_SCALE} />
    </group>
  );
}
