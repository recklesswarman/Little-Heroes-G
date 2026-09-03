import React, { useState } from 'react';
import { PetNeedState } from '../types';
import { ASSET_IMAGES } from '../data/initialData';
import { sounds } from '../utils/audio';
import { Sparkles, Utensils, Bath, Compass, Gamepad2, Music, Zap, Heart, ArrowLeft, Wind, CheckCircle2 } from 'lucide-react';

interface PetPenMatrixProps {
  pet: PetNeedState;
  coins: number;
  onUpdatePet: (updater: (prev: PetNeedState) => PetNeedState) => void;
  onSpendCoins: (amount: number) => boolean;
  onAddCoins: (amount: number) => void;
  onBackToDashboard: () => void;
  onLaunchDanceParty: () => void;
  onOpenAdventureMap?: () => void;
  onOpenPetCompendium?: () => void;
}

export const PetPenMatrix: React.FC<PetPenMatrixProps> = ({
  pet,
  coins,
  onUpdatePet,
  onSpendCoins,
  onAddCoins,
  onBackToDashboard,
  onLaunchDanceParty,
  onOpenAdventureMap,
  onOpenPetCompendium,
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'bath' | 'evolution'>('main');
  const [bathHygiene, setBathHygiene] = useState(pet.hygiene);
  const [bathStage, setBathStage] = useState<'scrub' | 'dry'>('scrub');
  const [bathBubbles, setBathBubbles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isPetBouncing, setIsPetBouncing] = useState(false);
  const [evolutionCelebration, setEvolutionCelebration] = useState(false);

  // Pet interactive tap
  const handlePetTouch = () => {
    sounds.playPetHappy();
    setIsPetBouncing(true);
    onUpdatePet((prev) => ({
      ...prev,
      joy: Math.min(100, prev.joy + 5),
    }));
    setTimeout(() => setIsPetBouncing(false), 500);
  };

  // Feed action
  const handleFeed = () => {
    if (pet.freeSnacksRemaining > 0) {
      sounds.playCoin();
      onUpdatePet((prev) => ({
        ...prev,
        hunger: Math.min(100, prev.hunger + 25),
        freeSnacksRemaining: prev.freeSnacksRemaining - 1,
        heroXp: Math.min(prev.maxHeroXp, prev.heroXp + 20),
      }));
    } else {
      if (onSpendCoins(10)) {
        sounds.playCoin();
        onUpdatePet((prev) => ({
          ...prev,
          hunger: Math.min(100, prev.hunger + 35),
          heroXp: Math.min(prev.maxHeroXp, prev.heroXp + 35),
        }));
      }
    }
  };

  // Start Bath Time sub-mode
  const handleStartBath = () => {
    sounds.playTap();
    setBathHygiene(pet.hygiene);
    setBathStage('scrub');
    setBathBubbles([]);
    setActiveTab('bath');
  };

  // Scrub in Bath
  const handleBathScrub = () => {
    sounds.playBubblePop();
    const newBubble = {
      id: Date.now() + Math.random(),
      x: Math.random() * 70 + 15,
      y: Math.random() * 50 + 20,
    };
    setBathBubbles((prev) => [...prev, newBubble]);

    setBathHygiene((prev) => {
      const next = Math.min(100, prev + 15);
      if (next >= 100 && bathStage === 'scrub') {
        setBathStage('dry');
        sounds.playFanfare();
      }
      return next;
    });
  };

  // Blow Dry in Bath
  const handleBathDry = () => {
    sounds.playFanfare();
    setBathBubbles([]);
    onUpdatePet((prev) => ({
      ...prev,
      hygiene: 100,
      joy: Math.min(100, prev.joy + 20),
      heroXp: Math.min(prev.maxHeroXp, prev.heroXp + 40),
    }));
    onAddCoins(15);
    setTimeout(() => {
      setActiveTab('main');
    }, 1200);
  };

  // Master Fuse / Evolution Trigger
  const handleMasterFuse = () => {
    sounds.playEvolution();
    setEvolutionCelebration(true);
    onUpdatePet((prev) => ({
      ...prev,
      stage: 4,
      stageName: 'Golden Armor Dragon Lord',
      heroXp: 1000,
      maxHeroXp: 1000,
      equippedGear: 'Golden Celtic Dragon Plate',
      joy: 100,
      energy: 100,
    }));
    onAddCoins(100);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-24 flex flex-col gap-6">
      {/* Sub-system Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            sounds.playTap();
            if (activeTab !== 'main') {
              setActiveTab('main');
            } else {
              onBackToDashboard();
            }
          }}
          className="bg-[#1E293B] hover:bg-[#334155] text-white px-4 py-2.5 rounded-2xl border-2 border-[#334155] border-b-[6px] border-b-[#0F172A] active:translate-y-1 transition-all flex items-center gap-2 font-black text-sm uppercase cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{activeTab === 'main' ? 'Dashboard' : 'Pet Matrix'}</span>
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab('main');
            }}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black uppercase transition-all cursor-pointer ${
              activeTab === 'main'
                ? 'chunky-btn bg-[#2ECC71] text-white'
                : 'bg-[#1E293B] text-[#94A3B8] border-2 border-[#334155]'
            }`}
            style={activeTab === 'main' ? ({ '--shadow-color': '#27AE60' } as React.CSSProperties) : undefined}
          >
            🐉 Pet Pen
          </button>
          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab('evolution');
            }}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black uppercase transition-all cursor-pointer ${
              activeTab === 'evolution'
                ? 'chunky-btn bg-[#F39C12] text-white'
                : 'bg-[#1E293B] text-[#94A3B8] border-2 border-[#334155]'
            }`}
            style={activeTab === 'evolution' ? ({ '--shadow-color': '#D68910' } as React.CSSProperties) : undefined}
          >
            ⚡ Evolution
          </button>
          {onOpenPetCompendium && (
            <button
              onClick={() => {
                sounds.playTap();
                onOpenPetCompendium();
              }}
              className="px-4 py-2 rounded-2xl text-xs sm:text-sm font-black uppercase transition-all cursor-pointer bg-[#3498DB] hover:bg-[#2980B9] text-white border-2 border-[#2980B9] shadow-[0_4px_0_#1F618D] active:translate-y-1"
            >
              🐾 24 Pet Roster
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: MAIN PET PEN VIEWPORT */}
      {activeTab === 'main' && (
        <div className="flex flex-col gap-6">
          {/* Pet Enclosure Canvas */}
          <section className="hero-card rounded-[36px] sm:rounded-[48px] p-6 sm:p-8 border-[#334155] border-b-[10px] sm:border-b-[12px] border-b-[#3498DB] flex flex-col items-center relative overflow-hidden">
            {/* Top XP & Stage Banner */}
            <div className="w-full max-w-2xl flex items-center justify-between gap-4 z-10 mb-2">
              <button
                onClick={onBackToDashboard}
                className="chunky-btn bg-[#3498DB] px-4 py-2 text-sm font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                style={{ '--shadow-color': '#2980B9' } as React.CSSProperties}
              >
                <span>🔙</span> Back
              </button>

              <div className="w-full max-w-md bg-[#111827] rounded-full border-4 border-[#334155] h-9 relative overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#F1C40F] to-[#F39C12] transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(15, (pet.heroXp / pet.maxHeroXp) * 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-black text-xs sm:text-sm text-white uppercase tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                  Stage {pet.stage}: {pet.stageName} ({pet.heroXp}/{pet.maxHeroXp} XP)
                </div>
              </div>
            </div>

            {/* 3D Pet Character Display */}
            <div className="pet-stage w-full max-w-xl h-72 sm:h-80 flex items-center justify-center relative my-2">
              <div
                id="main-pet-image"
                onClick={handlePetTouch}
                className={`w-60 h-60 sm:w-72 sm:h-72 rounded-3xl border-4 sm:border-6 border-dashed border-[#3498DB] bg-[#0F172A]/80 p-4 flex items-center justify-center relative cursor-pointer transition-all duration-300 ${
                  isPetBouncing ? 'scale-110 -translate-y-4 !border-[#2ECC71]' : 'animate-float hover:scale-105'
                }`}
                title="Tap to pet!"
              >
                {/* Pet Glow */}
                <div className="absolute inset-0 bg-[#3498DB]/20 rounded-3xl blur-xl animate-pulse" />

                {/* Equipped Gear Badge */}
                <div className="absolute -top-3 -left-2 bg-[#F39C12] text-[#0F172A] font-black text-[11px] px-3 py-1 rounded-xl shadow-lg border-2 border-[#0F172A] transform -rotate-6 uppercase z-10">
                  🛡️ {pet.equippedGear}
                </div>

                {/* 3D Dragon Image */}
                <img
                  src={pet.stage === 4 ? ASSET_IMAGES.petEvolutionLord : ASSET_IMAGES.petDragonBaby}
                  alt={pet.name}
                  className="w-full h-full object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.8)]"
                />

                <div className="absolute bottom-2 bg-[#0F172A]/90 border border-[#2ECC71]/60 text-[#2ECC71] text-[11px] font-black uppercase px-3 py-0.5 rounded-full shadow-md">
                  ✨ Tap to Pet!
                </div>
              </div>
            </div>

            {/* Needs Matrix (Hunger, Hygiene, Energy, Joy) */}
            <div className="stats-panel w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3.5 z-10 mt-2">
              {/* Hunger */}
              <div className="bg-[#1E293B]/90 p-3.5 rounded-2xl border-2 sm:border-3 border-[#334155] flex items-center gap-3.5 shadow-md">
                <span className="text-3xl shrink-0">🍖</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-black text-[#F39C12] mb-1 uppercase tracking-wider">
                    <span>Hunger</span>
                    <span className="text-white">{pet.hunger}%</span>
                  </div>
                  <div className="w-full h-4 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      id="bar-hunger"
                      className="h-full bg-[#F39C12] rounded-full transition-all duration-500"
                      style={{ width: `${pet.hunger}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Hygiene */}
              <div className="bg-[#1E293B]/90 p-3.5 rounded-2xl border-2 sm:border-3 border-[#334155] flex items-center gap-3.5 shadow-md">
                <span className="text-3xl shrink-0">🛁</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-black text-[#3498DB] mb-1 uppercase tracking-wider">
                    <span>Hygiene</span>
                    <span className="text-white">{pet.hygiene}%</span>
                  </div>
                  <div className="w-full h-4 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      id="bar-hygiene"
                      className="h-full bg-[#3498DB] rounded-full transition-all duration-500"
                      style={{ width: `${pet.hygiene}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Energy */}
              <div className="bg-[#1E293B]/90 p-3.5 rounded-2xl border-2 sm:border-3 border-[#334155] flex items-center gap-3.5 shadow-md">
                <span className="text-3xl shrink-0">⚡</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-black text-[#F1C40F] mb-1 uppercase tracking-wider">
                    <span>Energy</span>
                    <span className="text-white">{pet.energy}%</span>
                  </div>
                  <div className="w-full h-4 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      id="bar-energy"
                      className="h-full bg-[#F1C40F] rounded-full transition-all duration-500"
                      style={{ width: `${pet.energy}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Joy */}
              <div className="bg-[#1E293B]/90 p-3.5 rounded-2xl border-2 sm:border-3 border-[#334155] flex items-center gap-3.5 shadow-md">
                <span className="text-3xl shrink-0">🎵</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-black text-[#2ECC71] mb-1 uppercase tracking-wider">
                    <span>Joy</span>
                    <span className="text-white">{pet.joy}%</span>
                  </div>
                  <div className="w-full h-4 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      id="bar-joy"
                      className="h-full bg-[#2ECC71] rounded-full transition-all duration-500"
                      style={{ width: `${pet.joy}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Action Grid */}
          <section className="w-full max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Feed */}
            <button
              onClick={handleFeed}
              className="chunky-btn bg-[#F39C12] py-4 px-3 rounded-2xl font-black text-base sm:text-lg uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer"
              style={{ '--shadow-color': '#D68910' } as React.CSSProperties}
            >
              <span>🍖</span> Feed
            </button>

            {/* Bath Time */}
            <button
              onClick={handleStartBath}
              className="chunky-btn bg-[#3498DB] py-4 px-3 rounded-2xl font-black text-base sm:text-lg uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer"
              style={{ '--shadow-color': '#2980B9' } as React.CSSProperties}
            >
              <span>🛁</span> Bath Time
            </button>

            {/* Adventure */}
            <button
              onClick={() => {
                sounds.playCoin();
                setIsPetBouncing(true);
                onUpdatePet((prev) => ({
                  ...prev,
                  energy: 100,
                  heroXp: Math.min(prev.maxHeroXp, prev.heroXp + 25),
                }));
                if (onOpenAdventureMap) {
                  onOpenAdventureMap();
                }
              }}
              className="chunky-btn bg-[#F1C40F] !text-[#0F172A] py-4 px-3 rounded-2xl font-black text-base sm:text-lg uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer"
              style={{ '--shadow-color': '#B7950B' } as React.CSSProperties}
            >
              <span>⚡</span> Adventure
            </button>

            {/* Dance */}
            <button
              onClick={() => {
                sounds.playTap();
                onLaunchDanceParty();
              }}
              className="chunky-btn bg-[#2ECC71] py-4 px-3 rounded-2xl font-black text-base sm:text-lg uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer"
              style={{ '--shadow-color': '#27AE60' } as React.CSSProperties}
            >
              <span>🎵</span> Dance
            </button>
          </section>

          {/* Master Fuse Evolution Trigger */}
          <div className="w-full max-w-2xl mx-auto">
            <button
              onClick={handleMasterFuse}
              className="chunky-btn master-fuse-btn w-full py-5 rounded-3xl font-black text-xl sm:text-2xl uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer"
            >
              <span>🧬</span> MASTER FUSE <span>🧬</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: PET BATH TIME INTERACTIVE SUB-SYSTEM */}
      {activeTab === 'bath' && (
        <div className="hero-card rounded-[36px] sm:rounded-[48px] p-6 sm:p-8 border-[#334155] border-b-[10px] sm:border-b-[12px] border-b-[#3498DB] flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span>🛁</span> Pet Bath Time
            </h2>
            <div className="bg-[#0F172A] px-4 py-1.5 rounded-full border border-[#334155] text-xs font-black text-[#2ECC71] uppercase">
              Hygiene: {bathHygiene}%
            </div>
          </div>

          {/* Interactive Bathtub Scene */}
          <div className="relative w-full aspect-[4/3] max-h-[380px] rounded-3xl overflow-hidden border-4 border-[#334155] shadow-inner bg-[#0F172A]">
            <img
              src={ASSET_IMAGES.petBathtubScene}
              alt="Bathtub Scene"
              className="w-full h-full object-cover"
            />

            {/* Floating Soap Bubbles */}
            {bathBubbles.map((bubble) => (
              <button
                key={bubble.id}
                onClick={() => {
                  sounds.playBubblePop();
                  setBathBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
                }}
                style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
                className="absolute w-12 h-12 rounded-full bg-[#3498DB]/40 border-2 border-white backdrop-blur-xs flex items-center justify-center animate-ping pointer-events-auto cursor-pointer"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white absolute top-1 left-1" />
              </button>
            ))}

            {/* Speech bubble guidance */}
            <div className="absolute bottom-4 left-4 right-4 bg-[#0F172A]/90 backdrop-blur-md border-2 border-[#3498DB] rounded-2xl p-3 text-center">
              <p className="text-sm font-black text-white uppercase tracking-tight">
                {bathStage === 'scrub'
                  ? '✨ Tap "Scrub!" to clean the dragon with warm soothing bubbles!'
                  : '💨 All clean! Tap "Blow Dry" to fluff your dragon companion!'}
              </p>
            </div>
          </div>

          {/* Bath Actions */}
          <div className="flex gap-4">
            {bathStage === 'scrub' ? (
              <button
                onClick={handleBathScrub}
                className="chunky-btn bg-[#2ECC71] w-full py-4 text-xl font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                style={{ '--shadow-color': '#27AE60' } as React.CSSProperties}
              >
                <Bath className="w-6 h-6" />
                <span>Scrub with Soap! 🧼</span>
              </button>
            ) : (
              <button
                onClick={handleBathDry}
                className="chunky-btn bg-[#3498DB] w-full py-4 text-xl font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                style={{ '--shadow-color': '#2980B9' } as React.CSSProperties}
              >
                <Wind className="w-6 h-6" />
                <span>Blow Dry! 💨 (+15 Coins)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: EVOLUTION MATRIX & MASTER FUSE */}
      {activeTab === 'evolution' && (
        <div className="hero-card rounded-[36px] sm:rounded-[48px] p-6 sm:p-8 border-[#334155] border-b-[10px] sm:border-b-[12px] border-b-[#F39C12] flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#F39C12]">
              Dragon Evolution Matrix
            </h2>
            <p className="text-sm text-[#94A3B8] font-bold mt-1">
              Complete daily habits to power up your companion to the ultimate form!
            </p>
          </div>

          {/* Evolution Stages Display */}
          <div className="relative w-full rounded-3xl overflow-hidden border-4 border-[#334155] shadow-lg bg-[#0F172A]">
            <img
              src={ASSET_IMAGES.petEvolutionMatrix}
              alt="Evolution Matrix Stages"
              className="w-full h-auto object-cover"
            />
          </div>

          {/* XP Progress Bar */}
          <div className="bg-[#0F172A] p-5 rounded-3xl border-2 border-[#334155]">
            <div className="flex justify-between items-center text-sm font-black mb-2 uppercase">
              <span className="text-white">Hero XP Threshold</span>
              <span className="text-[#2ECC71]">
                {pet.heroXp} / {pet.maxHeroXp} XP
              </span>
            </div>
            <div className="w-full h-5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155] p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#2ECC71] via-[#3498DB] to-[#F1C40F] rounded-full transition-all duration-500"
                style={{ width: `${(pet.heroXp / pet.maxHeroXp) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[#94A3B8] font-bold text-center mt-2 uppercase tracking-wide">
              Stage 4 Unlocks: Golden Dragon Armor & Cosmic Flame Breath
            </p>
          </div>

          {/* Master Fuse Button */}
          <button
            onClick={handleMasterFuse}
            className="chunky-btn bg-[#2ECC71] w-full py-5 text-xl sm:text-2xl font-black uppercase tracking-wider cursor-pointer"
            style={{ '--shadow-color': '#27AE60' } as React.CSSProperties}
          >
            <Zap className="w-7 h-7 fill-current" />
            <span>Master Fuse! ⚡</span>
          </button>

          {/* Evolution Celebration Modal (Stitch Guidelines) */}
          {evolutionCelebration && (
            <div className="fixed inset-0 z-50 bg-[#09141e]/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
              <div className="bg-[#202b35] rounded-4xl p-6 sm:p-8 max-w-md w-full text-center shadow-[0_12px_0_0_#121d26] border-2 border-[#3d4a3e] flex flex-col items-center relative overflow-hidden animate-scale-up">
                
                {/* Decorative Stars */}
                <div className="absolute top-4 left-4 text-[#ffb961] rotate-12 pointer-events-none">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1', fontSize: '32px' }}>star</span>
                </div>
                <div className="absolute top-10 right-6 text-[#54e98a] rotate-[25deg] pointer-events-none">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1', fontSize: '24px' }}>arrow_back_ios_new</span>
                </div>
                <div className="absolute bottom-20 left-6 text-[#a3d3ff] -rotate-12 pointer-events-none">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1', fontSize: '28px' }}>auto_awesome</span>
                </div>

                <h3 className="font-headline text-2xl sm:text-3xl font-black text-[#54e98a] mb-6 uppercase tracking-wide drop-shadow-lg">
                  BIG EVOLUTION!
                </h3>

                {/* 3D Celebration Portal - Rendering Evolved Dragon Lord */}
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 mb-6 animate-float glow-effect rounded-full bg-[#16212b] flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 rounded-full border-4 border-[#2f3a45] shadow-inner z-0 pointer-events-none"></div>
                  <img
                    src={ASSET_IMAGES.petEvolutionLord}
                    alt="Golden Armor Dragon Lord"
                    className="w-28 h-28 sm:w-32 sm:h-32 object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] z-10 animate-pulse-subtle"
                  />
                </div>

                <p className="font-body text-xs sm:text-sm text-[#bbcbbb] font-bold mb-6 px-3 leading-relaxed">
                  Your dragon has grown up into the <span className="text-[#ffb961] font-black">Golden Armor Dragon Lord</span>! New abilities unlocked!
                </p>

                <button
                  onClick={() => {
                    sounds.playTap();
                    setEvolutionCelebration(false);
                  }}
                  className="w-full bg-[#54e98a] text-[#003919] font-headline text-lg font-black rounded-xl py-3.5 chunky-button-primary uppercase tracking-widest relative overflow-hidden group hover:brightness-110 active:scale-98 transition-all"
                >
                  <span className="relative z-10">AWESOME! 🚀</span>
                  <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-white/20 skew-x-[-20deg] group-hover:left-[200%] transition-all duration-700 ease-in-out"></div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
