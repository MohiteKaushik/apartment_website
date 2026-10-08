import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import IntroVideo from './pages/IntroVideo';
import TowerSelection from './pages/TowerSelection';
import FloorSelection from './pages/FloorSelection';
import FlatSelection from './pages/FlatSelection';
import FloorPlanView from './pages/FloorPlanView';
import WalkthroughView from './pages/WalkthroughView';
import ContactPage from './pages/ContactPage';
import AmenitiesPage from './pages/AmenitiesPage';
import RoomCustomizerPage from './pages/RoomCustomizerPage';

const PAGES = {
  INTRO:      'INTRO',
  TOWER:      'TOWER',
  FLOOR:      'FLOOR',
  FLAT:       'FLAT',
  FLOOR_PLAN: 'FLOOR_PLAN',
  WALKTHROUGH:'WALKTHROUGH',
  CONTACT:    'CONTACT',
  AMENITIES:  'AMENITIES',
  CUSTOMIZER: 'CUSTOMIZER',
};

export default function App() {
  const [page, setPage] = useState(PAGES.INTRO);
  const [selection, setSelection] = useState({ tower: null, floor: null, flat: null });
  const [contactReturnPage, setContactReturnPage] = useState(PAGES.WALKTHROUGH);

  const navigate = (nextPage, updates = {}) => {
    setSelection(prev => ({ ...prev, ...updates }));
    setPage(nextPage);
  };

  const goToContact = (returnTo) => {
    setContactReturnPage(returnTo);
    navigate(PAGES.CONTACT);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a]">
      {/* The intro sits on its own layer above the tower page, which is
          already mounted underneath while the video plays. So the 3D tower,
          its textures and the page layout are ready, and the video's last
          frame cross-fades straight into the live scene — no black gap. */}
      <AnimatePresence>
        {page === PAGES.INTRO && (
          <IntroVideo key="intro" onComplete={() => navigate(PAGES.TOWER)} />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {(page === PAGES.TOWER || page === PAGES.INTRO) && (
          <TowerSelection key="tower" selection={selection} behindIntro={page === PAGES.INTRO}
            onSelectTower={tower => navigate(PAGES.FLOOR, { tower })}
            onViewAmenities={() => navigate(PAGES.AMENITIES)}
            onCustomize={() => navigate(PAGES.CUSTOMIZER)} />
        )}
        {page === PAGES.AMENITIES && (
          <AmenitiesPage key="amenities"
            onBack={() => navigate(PAGES.TOWER)}
            onEnquire={() => goToContact(PAGES.AMENITIES)} />
        )}
        {page === PAGES.CUSTOMIZER && (
          <RoomCustomizerPage key="customizer"
            onBack={() => navigate(PAGES.TOWER)} />
        )}
        {page === PAGES.FLOOR && (
          <FloorSelection key="floor" selection={selection}
            onSelectFloor={floor => navigate(PAGES.FLAT, { floor })}
            onBack={() => navigate(PAGES.TOWER)} />
        )}
        {page === PAGES.FLAT && (
          <FlatSelection key="flat" selection={selection}
            onSelectFlat={flat => navigate(PAGES.FLOOR_PLAN, { flat })}
            onBack={() => navigate(PAGES.FLOOR)} />
        )}
        {page === PAGES.FLOOR_PLAN && (
          <FloorPlanView key="floorplan" selection={selection}
            onWalkthrough={() => navigate(PAGES.WALKTHROUGH)}
            onBack={() => navigate(PAGES.FLAT)} />
        )}
        {page === PAGES.WALKTHROUGH && (
          <WalkthroughView key="walkthrough" selection={selection}
            onEnquire={() => goToContact(PAGES.WALKTHROUGH)}
            onBack={() => navigate(PAGES.FLOOR_PLAN)} />
        )}
        {page === PAGES.CONTACT && (
          <ContactPage key="contact" selection={selection}
            onBack={() => navigate(contactReturnPage)} />
        )}
      </AnimatePresence>
    </div>
  );
}
