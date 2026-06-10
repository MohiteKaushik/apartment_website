import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IntroVideo({ onComplete }) {
  const videoRef   = useRef(null);
  const [started,  setStarted]  = useState(false);
  const [fadingOut, setFadingOut] = useState(false);  // triggers black overlay

  const handleStart = () => {
    setStarted(true);
    videoRef.current?.play();
  };

  /* When the video ends, fade to black first, THEN switch pages.
     This lets the 3D model load behind the black so the reveal
     feels like the still frame "comes to life". */
  const handleEnded = () => {
    setFadingOut(true);
    setTimeout(onComplete, 900); // match animation duration below
  };

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(onComplete, 500);
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Video — stays visible (paused on last frame) during fade */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/assets/videos/intro.mp4"
        onEnded={handleEnded}
        playsInline
      />

      {/* Subtle dark tint while playing */}
      <div className="absolute inset-0 bg-black/25" />

      {/* ── Fade-to-black overlay ──
          Animates in when video ends so 3D can load behind it */}
      <AnimatePresence>
        {fadingOut && (
          <motion.div
            className="absolute inset-0 bg-black z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Brand / start screen */}
      {!started && (
        <motion.div
          className="relative z-10 flex flex-col items-center gap-8 text-center px-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <p className="text-[#c49a3c] text-sm tracking-[0.3em] uppercase font-light">
            Welcome to
          </p>
          <h1 className="text-white text-6xl md:text-8xl font-light tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Vayam
          </h1>
          <p className="text-white/60 text-lg font-light max-w-md">
            Experience luxury living redefined. Where architecture meets artistry.
          </p>
          <button onClick={handleStart}
            className="mt-4 px-10 py-4 border border-[#c49a3c] text-[#c49a3c] text-sm tracking-[0.2em] uppercase font-medium hover:bg-[#c49a3c] hover:text-black transition-all duration-500 rounded-sm">
            Begin Experience
          </button>
          <button onClick={handleSkip}
            className="text-white/30 text-xs tracking-widest uppercase hover:text-white/60 transition-colors duration-300">
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
