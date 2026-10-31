import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import BRAND from '../data/brand';

export default function IntroVideo({ onComplete }) {
  const videoRef   = useRef(null);
  const [started,  setStarted]  = useState(false);
  const [fadingOut, setFadingOut] = useState(false);  // triggers black overlay

  const handleStart = () => {
    setStarted(true);
    videoRef.current?.play();
  };

  /* The tower page is already rendered underneath this layer (see App.js),
     so when the video ends we simply hand over: this layer fades out over
     the live 3D scene, with the last frame of the video held on screen. */
  const handleEnded = () => { setFadingOut(true); onComplete(); };
  const handleSkip  = () => { setFadingOut(true); onComplete(); };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      style={{ zIndex: 50 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }}
      transition={{ duration: 0.2 }}
    >
      {/* Video — stays visible (paused on last frame) during fade */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/assets/videos/intro.mp4"
        onEnded={handleEnded}
        playsInline
        preload="auto"
      />

      {/* Soft darkening only while the start screen is up — the film itself
          plays untinted so its last frame matches the page behind it. */}
      {!started && (
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 55%, rgba(0,0,0,0.72), rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.6))' }} />
      )}

      {/* Brand / start screen */}
      {!started && (
        <motion.div
          className="relative z-10 flex flex-col items-center gap-8 text-center px-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <p className="text-[#e6cf93] text-base sm:text-xl tracking-[0.34em] uppercase"
            style={{ fontWeight: 500, textShadow: '0 2px 18px rgba(0,0,0,0.8)' }}>
            Welcome to
          </p>
          <motion.h1 className="text-white text-6xl md:text-8xl tracking-[0.18em] uppercase leading-none"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, textShadow: '0 4px 40px rgba(0,0,0,0.85)' }}
            initial={{ opacity: 0, letterSpacing: '0.5em' }} animate={{ opacity: 1, letterSpacing: '0.18em' }}
            transition={{ delay: 0.5, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}>
            {BRAND.name}
          </motion.h1>
          <div className="flex items-center gap-4 -mt-3">
            <span className="h-px w-10 sm:w-16" style={{ background: 'linear-gradient(90deg, transparent, #c49a3c)' }} />
            <p className="text-[#e6cf93] text-xs sm:text-sm tracking-[0.3em] uppercase" style={{ fontWeight: 500 }}>{BRAND.tagline}</p>
            <span className="h-px w-10 sm:w-16" style={{ background: 'linear-gradient(90deg, #c49a3c, transparent)' }} />
          </div>
          <p className="text-white/90 text-lg sm:text-2xl font-light max-w-lg leading-relaxed" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
            Experience luxury living redefined. Where architecture meets artistry.
          </p>
          <motion.button onClick={handleStart}
            className="btn-gold mt-2 px-12 py-4 text-sm sm:text-base tracking-[0.22em] uppercase font-medium rounded-full"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8 }}
            whileTap={{ scale: 0.97 }}>
            Begin Experience
          </motion.button>
          <button onClick={handleSkip}
            className="text-white/55 text-xs tracking-widest uppercase hover:text-white transition-colors duration-300">
            Skip
          </button>
        </motion.div>
      )}

      {/* Skip during playback */}
      {started && !fadingOut && (
        <motion.button
          className="absolute bottom-10 right-10 z-10 text-white/40 text-xs tracking-widest uppercase hover:text-white/70 transition-colors"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          onClick={handleSkip}
        >
          Skip Intro
        </motion.button>
      )}
    </motion.div>
  );
}
