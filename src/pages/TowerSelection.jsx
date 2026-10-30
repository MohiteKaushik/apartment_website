import React, { Suspense, useState, useRef, useEffect, useMemo, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import NavBar from '../components/NavBar';
import LoadingSpinner from '../components/LoadingSpinner';
import TowerModel from '../components/building/TowerModel';
import CameraRig from '../components/building/CameraRig';
import FloorPlate from '../components/building/FloorPlate';
import AvailabilityOverlay from '../components/building/AvailabilityOverlay';
import DayCycle, { TimeOfDayControl, BACKDROP_FILTER, BACKDROP_TINT, todKey } from '../components/building/DayCycle';
import FloorSelection from './FloorSelection';
import FlatSelection from './FlatSelection';

/* ── The building explorer ───────────────────────────────
   One live 3D scene carries the visitor through the first three steps:

     hero   the towers over the lake, straight out of the intro film
     floor  the chosen tower close up; hovering a floor number lights
            that storey on the building
     unit   the tower cut open at the chosen floor, with a 3D plan of the
            four homes on it

   The camera flies between the three (CameraRig); the model, the
   highlight and the cut-away live in TowerModel; the panels on the
   right are FloorSelection / FlatSelection. */

/* The last frame of the intro video: the hero is built on top of it so
   the cut from film to page is a match cut. */
const HERO_STILL = '/assets/images/hero_still.jpg';
if (typeof Image !== 'undefined') { const i = new Image(); i.src = HERO_STILL; }

const TOWERS = [
  { id: 'A', name: 'Tower Aureum',  tagline: 'Lake facing · 40 floors', units: 160 },
  { id: 'B', name: 'Tower Regalis', tagline: 'Park facing · 40 floors', units: 160 },
];

class ModelErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}

function PlaceholderTower() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[2.2, 0.3, 2.2]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      <mesh position={[0, 2.7, 0]}><boxGeometry args={[1.4, 4.8, 1.4]} /><meshStandardMaterial color="#14142b" /></mesh>
    </group>
  );
}

/* While the page is hidden under the intro: ask for a frame every so often
   so the model and textures get uploaded to the GPU before the reveal. */
function WarmUp() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { const t = setInterval(invalidate, 500); return () => clearInterval(t); }, [invalidate]);
  return null;
}

const ease = [0.22, 1, 0.36, 1];
const rise = (delay, dist = 18) => ({
  initial: { opacity: 0, y: dist }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8, transition: { duration: 0.45 } },
  transition: { delay, duration: 0.9, ease },
});

export default function TowerSelection({
  view = 'hero', selection = {}, behindIntro = false,
  onSelectTower, onSelectFloor, onSelectFlat, onBack, onViewAmenities, onCustomize,
}) {
  const [hoverTower, setHoverTower] = useState(null);
  const [hoverFloor, setHoverFloor] = useState(null);
  const [hoverFlat,  setHoverFlat]  = useState(null);
  const [hoverAmenities, setHoverAmenities] = useState(false);
  const [diving, setDiving] = useState(false);     // flying down to the amenities
  const [zoomFlat, setZoomFlat] = useState(null);  // diving onto a chosen home
  const [ready, setReady]   = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const [tod, setTod] = useState(0);               // time of day: 0 day · 0.5 sunset · 1 night
  const [showAvail, setShowAvail] = useState(true); // availability blocks on the tower
  const backdropRef = useRef(null), blurRef = useRef(null), vignetteRef = useRef(null), fxRef = useRef(null), growRef = useRef(null);
  useEffect(() => { fxRef.current = { blur: blurRef.current, vignette: vignetteRef.current }; }, []);
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches, []);

  // Cinematic opening only when we arrive from the intro film.
  const cinematic = useRef(behindIntro).current;
  const D = cinematic ? { nav: 2.0, eyebrow: 2.4, title: 2.55, sub: 2.85, links: 3.1, card: 3.2, hint: 4.2 }
                      : { nav: 0.1, eyebrow: 0.2, title: 0.25, sub: 0.35, links: 0.45, card: 0.3, hint: 1.2 };

  /* what the scene should show — read by the rig and the model every frame */
  const towerId = selection.tower?.id || null;
  const stateRef = useRef({});
  stateRef.current = {
    view: diving ? 'amenities' : zoomFlat ? 'unitZoom' : view, towerId, floor: selection.floor || null,
    flatId: zoomFlat?.id || selection.flat?.id || null,
    hoverTower, hoverFloor, hoverFlat: zoomFlat ? zoomFlat.id : hoverFlat, hoverAmenities, tod,
  };

  useEffect(() => { setHoverFloor(null); setHoverFlat(null); setHoverTower(null); setZoomFlat(null); }, [view]);

  /* a home was chosen: dive onto it, then open its floor plan */
  const pickFlat = (flat) => {
    if (zoomFlat) return;
    setZoomFlat(flat);
    setTimeout(() => onSelectFlat?.(flat), 1350 * ((typeof window !== 'undefined' && window.__slowFlights) || 1));
  };
  useEffect(() => {
    if (behindIntro || hintGone || view !== 'hero') return undefined;
    const t = setTimeout(() => setHintGone(true), 9000);
    return () => clearTimeout(t);
  }, [behindIntro, hintGone, view]);

  const goAmenities = () => {
    if (diving) return;
    setDiving(true);
    setTimeout(() => { onViewAmenities?.(); }, 1050 * ((typeof window !== 'undefined' && window.__slowFlights) || 1));
  };

  const hero = view === 'hero' && !diving;
  const step = view === 'unit' ? 4 : view === 'floor' ? 3 : 2;

  return (
    <motion.div className="absolute inset-0 overflow-hidden bg-black"
      initial={{ opacity: cinematic ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}>

      {/* Backdrop: the film's last frame, cover-cropped like the video. The
          soft copy underneath fills the edges when the hero zooms out, and
          is all that remains once the camera leaves the film's viewpoint. */}
      {/* The photograph is graded with the time of day (see DayCycle) */}
      <div className="absolute inset-0 pointer-events-none" style={{ filter: BACKDROP_FILTER[todKey(tod)], transition: 'filter 1.6s ease' }}>
      <img src={HERO_STILL} alt="" aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        style={{ filter: 'blur(22px) brightness(0.85)', transform: 'scale(1.12)' }} draggable={false} />
      <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity: hero ? 1 : 0 }} transition={{ duration: 1.4, ease }}>
        <div ref={backdropRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', willChange: 'transform' }}>
          <img src={HERO_STILL} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover select-none" draggable={false} />
          <img ref={blurRef} src={HERO_STILL} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover select-none"
            style={{ filter: 'blur(9px) saturate(0.9)', transform: 'scale(1.03)', opacity: 0,
                     maskImage: 'radial-gradient(ellipse 30% 46% at 50% 52%, #000 40%, transparent 100%)',
                     WebkitMaskImage: 'radial-gradient(ellipse 30% 46% at 50% 52%, #000 40%, transparent 100%)' }}
            draggable={false} />
        </div>
      </motion.div>
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: BACKDROP_TINT[todKey(tod)], transition: 'background 1.6s ease' }} />
      {/* Vignette: a soft pool of light on the building, darker towards the edges */}
      <div ref={vignetteRef} className="absolute pointer-events-none" style={{ inset: '-25%', opacity: 0,
        background: 'radial-gradient(ellipse 27% 34% at 50% 52%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.2) 68%, rgba(0,0,0,0.38) 100%)' }} />
      {/* Away from the hero the picture steps back: darker and quieter behind the live tower */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ background: '#05060a' }}
        animate={{ opacity: hero ? 0 : 0.5 }} transition={{ duration: 1.4, ease }} />

      {/* Live 3D */}
      <Canvas className="absolute inset-0"
        style={{ position: 'absolute', inset: 0, filter: 'blur(0.35px) saturate(0.96)' }}
        camera={{ fov: 45, near: 0.3, far: 400 }}
        gl={{ alpha: true, antialias: true }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        frameloop={behindIntro ? 'demand' : 'always'}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); gl.localClippingEnabled = true; setReady(true); }}>
        {behindIntro && <WarmUp />}
        <CameraRig stateRef={stateRef} backdropRef={backdropRef} fxRef={fxRef} growRef={growRef} cinematic={cinematic} />
        <DayCycle stateRef={stateRef} />
        <ModelErrorBoundary fallback={<PlaceholderTower />}>
          <Suspense fallback={<PlaceholderTower />}>
            <TowerModel stateRef={stateRef} growRef={growRef} />
            <ContactShadows position={[0, 0.02, 0]} scale={34} blur={2.6} opacity={0.5} far={14} frames={1} />
          </Suspense>
        </ModelErrorBoundary>
        {towerId && (view === 'floor' || view === 'unit') && (
          <AvailabilityOverlay towerId={towerId} stateRef={stateRef} enabled={showAvail} touch={touch}
            onHover={setHoverFloor} onSelect={(f) => onSelectFloor?.(f)} />
        )}
        {towerId && selection.floor && (view === 'unit' || view === 'floor') && (
          <FloorPlate towerId={towerId} floor={selection.floor} visible={view === 'unit'}
            hoverFlat={zoomFlat ? zoomFlat.id : hoverFlat} onHover={(id) => !zoomFlat && setHoverFlat(id)} onSelect={pickFlat} />
        )}
      </Canvas>

      {/* Legibility gradients (never block the drag) */}
      <div className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))' }} />
      <motion.div className="absolute inset-x-0 top-0 h-[46%] pointer-events-none sm:hidden"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72) 30%, rgba(0,0,0,0))' }} animate={{ opacity: hero ? 1 : 0.4 }} />
      <motion.div className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{ background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.66))' }} animate={{ opacity: hero ? 1 : 0.6 }} />
      <motion.div className="absolute inset-y-0 left-0 w-[48%] pointer-events-none hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0))' }} animate={{ opacity: hero ? 1 : 0 }} />

      {/* Loading veil — only when the page is opened directly (not under the film) */}
      <AnimatePresence>
        {!ready && !behindIntro && (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center bg-black"
            exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <LoadingSpinner label="Preparing view…" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <motion.div className="absolute inset-x-0 top-0 z-30"
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: diving || zoomFlat ? 0 : 1, y: 0 }}
        transition={{ delay: D.nav, duration: 0.8, ease }}>
        <NavBar step={step} transparent onBack={view === 'hero' ? undefined : onBack} />
      </motion.div>

      {/* ── Hero overlays ── */}
      <AnimatePresence>
        {hero && (
          <React.Fragment key="hero-ui">
            <div className="absolute z-20 left-5 right-5 sm:left-10 sm:right-auto sm:max-w-[520px]
                            top-[72px] sm:top-auto sm:bottom-12 pointer-events-none">
              <motion.p {...rise(D.eyebrow, 10)}
                className="text-[#c49a3c] text-[10px] sm:text-[11px] tracking-[0.38em] uppercase">
                Lakefront residences · Two towers
              </motion.p>
              <motion.h1 {...rise(D.title, 24)}
                className="mt-2 sm:mt-3 text-white font-light leading-[1.02] text-[34px] sm:text-[56px] lg:text-[64px]"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em', textShadow: '0 2px 30px rgba(0,0,0,0.45)' }}>
                Choose your<br />
                <span className="accent">residence</span>
              </motion.h1>
              <motion.p {...rise(D.sub, 14)}
                className="mt-3 sm:mt-5 text-white/60 text-[12.5px] sm:text-[15px] font-light leading-relaxed max-w-[380px]">
                Two towers over the water. Pick one to explore its floors, plans
                and a walk-through of every home.
              </motion.p>
              <motion.div {...rise(D.links, 10)} className="mt-4 sm:mt-6 flex gap-5 sm:gap-7 pointer-events-auto">
                {onViewAmenities && (
                  <button onClick={goAmenities}
                    onMouseEnter={() => setHoverAmenities(true)} onMouseLeave={() => setHoverAmenities(false)}
                    onFocus={() => setHoverAmenities(true)} onBlur={() => setHoverAmenities(false)}
                    className="group flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-[#c49a3c] transition-colors duration-300">
                    <span className="w-5 h-px bg-current opacity-60 group-hover:w-8 transition-all duration-300" />Amenities
                  </button>
                )}
                {onCustomize && (
                  <button onClick={onCustomize} className="group flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-[#c49a3c] transition-colors duration-300">
                    <span className="w-5 h-px bg-current opacity-60 group-hover:w-8 transition-all duration-300" />Customize a room
                  </button>
                )}
              </motion.div>
            </div>

            {/* Tower cards — right rail on desktop, bottom stack on phones */}
            <motion.div className="absolute z-20 inset-x-4 bottom-4 flex flex-col gap-2
                            sm:inset-x-auto sm:right-8 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-[300px] sm:gap-3"
              exit={{ opacity: 0, x: 40, transition: { duration: 0.5 } }}>
              {TOWERS.map((tower, i) => {
                const hot = hoverTower === tower.id;
                return (
                  <motion.button key={tower.id}
                    initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: D.card + i * 0.14, duration: 0.9, ease }}
                    onHoverStart={() => setHoverTower(tower.id)} onHoverEnd={() => setHoverTower(null)}
                    onFocus={() => setHoverTower(tower.id)} onBlur={() => setHoverTower(null)}
                    onClick={() => onSelectTower(tower)}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                    className="relative text-left rounded-2xl overflow-hidden transition-colors duration-300"
                    style={{
                      background: hot ? 'rgba(20,16,8,0.72)' : 'rgba(8,8,10,0.55)',
                      border: `1px solid ${hot ? 'rgba(196,154,60,0.7)' : 'rgba(255,255,255,0.12)'}`,
                      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                      boxShadow: hot ? '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(196,154,60,0.15) inset' : '0 12px 40px rgba(0,0,0,0.35)',
                    }}>
                    <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(196,154,60,0.14) 50%, transparent 70%)' }}
                      initial={{ x: '-120%' }} animate={{ x: hot ? '120%' : '-120%' }} transition={{ duration: 0.8, ease }} />
                    <div className="relative px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[#c49a3c] text-[9.5px] tracking-[0.3em] uppercase">
                          Tower {tower.id} <span className="text-white/25 ml-1 tracking-normal normal-case">{tower.id === 'A' ? '· left' : '· right'}</span>
                        </p>
                        <h3 className="text-white text-[17px] sm:text-[20px] font-light mt-0.5 leading-tight"
                            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em' }}>{tower.name}</h3>
                        <p className="text-white/45 text-[11px] sm:text-xs mt-0.5">{tower.tagline} · {tower.units} residences</p>
                      </div>
                      <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-300
                        ${hot ? 'btn-gold' : 'border border-white/20 text-white/70'}`}>→</span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {!hintGone && (
              <motion.div key="hint" className="absolute z-20 left-1/2 -translate-x-1/2 bottom-[204px] sm:bottom-6 pointer-events-none
                                     flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: D.hint, duration: 0.8 }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c49a3c] animate-pulse" />
                <span className="text-white/55 text-[10px] tracking-[0.2em] uppercase">Live 3D · drag to look around</span>
              </motion.div>
            )}
          </React.Fragment>
        )}

        {/* ── Floor picker ── */}
        {view === 'floor' && (
          <FloorSelection key="floor-ui" tower={selection.tower} hovered={hoverFloor} onHover={setHoverFloor}
            onSelect={(f) => onSelectFloor?.(f)} touch={touch} showAvail={showAvail} onToggleAvail={() => setShowAvail((v) => !v)} />
        )}

        {/* ── Home picker ── */}
        {view === 'unit' && !zoomFlat && (
          <FlatSelection key="unit-ui" tower={selection.tower} floor={selection.floor} hovered={hoverFlat} onHover={setHoverFlat}
            onSelect={pickFlat} touch={touch} />
        )}
      </AnimatePresence>

      {/* Time of day */}
      <AnimatePresence>
        {!diving && !zoomFlat && (
          <motion.div key="tod" className={`absolute z-20 right-3 top-[60px] sm:top-auto sm:bottom-6 ${hero ? 'sm:right-8' : 'sm:right-auto sm:left-8'}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: cinematic && view === 'hero' ? 4.6 : 1.2, duration: 0.8 }}>
            <TimeOfDayControl tod={tod} onChange={setTod} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* A small caption on the 3D side while choosing */}
      <AnimatePresence>
        {(view === 'floor' || view === 'unit') && !diving && !zoomFlat && (
          <motion.div key="caption" className="absolute z-20 left-5 sm:left-10 bottom-[58%] sm:bottom-[76px] pointer-events-none"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 1.2, duration: 0.8 }}>
            <p className="text-white/35 text-[10px] tracking-[0.3em] uppercase">
              {view === 'floor' ? 'Live model · drag to look around' : `Floor ${selection.floor} · plate view`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
