import React, { useState } from 'react';
import { PetCompendiumItem, PetNeedState } from '../types';
import { petDatabase, ELEMENT_CONFIG } from '../data/petDatabase';
import { sounds } from '../utils/audio';
import { Shield, Sparkles, Zap, Heart, Check, ArrowLeft, Award, Flame } from 'lucide-react';

interface PetCompendiumProps {
  activePet: PetNeedState;
  onSelectActivePet: (pet: PetCompendiumItem) => void;
  onClose: () => void;
}

export const PetCompendium: React.FC<PetCompendiumProps> = ({
  activePet,
  onSelectActivePet,
  onClose,
}) => {
  const [selectedPet, setSelectedPet] = useState<PetCompendiumItem | null>(null);
  const [filterElement, setFilterElement] = useState<string>('All');
  const [equippedNotice, setEquippedNotice] = useState<string | null>(null);

  const elements = ['All', 'Earth', 'Water', 'Air', 'Fire', 'Tech', 'Magic'];

  const filteredPets =
    filterElement === 'All'
      ? petDatabase
      : petDatabase.filter((p) => p.element === filterElement);

  const handleOpenDetail = (pet: PetCompendiumItem) => {
    sounds.playTap();
    setSelectedPet(pet);
  };

  const handleCloseDetail = () => {
    sounds.playTap();
    setSelectedPet(null);
  };

  const handleEquipPet = (pet: PetCompendiumItem) => {
    sounds.playFanfare();
    onSelectActivePet(pet);
    setEquippedNotice(`🎉 ${pet.name} is now your Active Companion!`);
    setTimeout(() => {
      setEquippedNotice(null);
      setSelectedPet(null);
    }, 1200);
  };

  return (
    <div
      id="pet-compendium-screen"
      className="max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-24 flex flex-col items-center min-h-screen text-white select-none"
    >
      {/* Roster Header */}
      <div className="roster-header w-full bg-[#1E293B]/95 border-4 border-[#3498DB] border-b-8 border-b-[#2980B9] rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 mb-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => {
            sounds.playTap();
            onClose();
          }}
          className="chunky-btn bg-[#3498DB] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black text-sm sm:text-base uppercase tracking-tight flex items-center gap-2 cursor-pointer"
          style={{ '--shadow-color': '#2980B9' } as React.CSSProperties}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="text-center flex-1 min-w-[200px]">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Hero Armory & Roster
          </h1>
          <p className="text-xs sm:text-sm text-[#F1C40F] font-black uppercase tracking-wider mt-0.5">
            24 Legendary Companions • Discover & Evolve!
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0F172A] px-4 py-2 rounded-2xl border-2 border-[#334155]">
          <span className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">Active:</span>
          <span className="text-sm font-black text-[#2ECC71]">{activePet.name}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="w-full flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {elements.map((el) => {
          const isActive = filterElement === el;
          return (
            <button
              key={el}
              onClick={() => {
                sounds.playTap();
                setFilterElement(el);
              }}
              className={`px-4 py-2 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer border-2 ${
                isActive
                  ? 'bg-[#F39C12] text-[#0F172A] border-[#D68910] shadow-[0_4px_0_#B7950B] scale-105'
                  : 'bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white border-[#334155]'
              }`}
            >
              {el === 'All' ? '🌟 All (24)' : `${ELEMENT_CONFIG[el]?.icon || '✨'} ${el}`}
            </button>
          );
        })}
      </div>

      {/* 24-Pet Roster Grid */}
      <div className="roster-grid w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {filteredPets.map((pet) => {
          const isCurrentActive = activePet.name === pet.name;
          const elementInfo = ELEMENT_CONFIG[pet.element] || ELEMENT_CONFIG.Earth;

          return (
            <div
              key={pet.id}
              onClick={() => handleOpenDetail(pet)}
              className={`pet-roster-card group relative bg-[#1E293B] border-4 rounded-3xl p-3 sm:p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-150 active:translate-y-2 ${
                isCurrentActive
                  ? 'border-[#2ECC71] shadow-[0_8px_0_#27AE60] bg-gradient-to-b from-[#1E293B] to-[#145A32]/40'
                  : 'border-[#334155] hover:border-[#3498DB] shadow-[0_8px_0_#0F172A]'
              }`}
            >
              {/* Equipped Ribbon */}
              {isCurrentActive && (
                <div className="absolute -top-3 bg-[#2ECC71] text-[#0F172A] font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border-2 border-black/30 shadow-md">
                  Active Companion
                </div>
              )}

              {/* Roster Avatar Stage */}
              <div
                className="roster-avatar w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl mb-2 sm:mb-3 border-4 border-dashed relative shadow-inner group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: '#0F172A',
                  borderColor: elementInfo.border,
                }}
              >
                <span>{pet.iconEmoji || '🐾'}</span>
                <span
                  className="absolute -bottom-1 -right-1 text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-sm"
                  style={{ backgroundColor: elementInfo.bg }}
                >
                  {elementInfo.icon}
                </span>
              </div>

              {/* Pet Info */}
              <h3 className="text-white font-black text-sm sm:text-base leading-tight tracking-tight mb-1 group-hover:text-[#F1C40F] transition-colors">
                {pet.name}
              </h3>

              {/* Element Tag */}
              <span
                className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                style={{
                  backgroundColor: '#0F172A',
                  color: elementInfo.text,
                  borderColor: elementInfo.border,
                }}
              >
                {pet.element}
              </span>

              {/* Habit perk hint */}
              <p className="text-[10px] text-[#94A3B8] font-bold mt-2 line-clamp-2 leading-tight">
                {pet.habitBonus.split(':')[0]}
              </p>

              {/* Inspect hint */}
              <div className="mt-2.5 w-full pt-1.5 border-t border-[#334155]/60 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#3498DB] group-hover:text-[#F1C40F]">
                <span>Inspect</span> &rarr;
              </div>
            </div>
          );
        })}
      </div>

      {/* PET DETAIL & EVOLUTION MODAL */}
      {selectedPet && (
        <div
          id="pet-detail-modal"
          className="fixed inset-0 z-50 bg-[#0F172A]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="detail-card relative bg-gradient-to-b from-[#1E293B] to-[#0F172A] border-8 border-[#3498DB] rounded-[36px] sm:rounded-[44px] p-5 sm:p-8 max-w-xl w-full flex flex-col items-center text-center shadow-2xl animate-popIn max-h-[92vh] overflow-y-auto scrollbar-none">
            {/* Close Cross Button */}
            <button
              onClick={handleCloseDetail}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#0F172A] border-2 border-[#334155] text-[#94A3B8] hover:text-white flex items-center justify-center font-black text-lg cursor-pointer active:scale-95"
            >
              ✕
            </button>

            {/* Notification Toast */}
            {equippedNotice && (
              <div className="absolute top-3 left-6 right-6 z-20 bg-[#2ECC71] text-[#0F172A] font-black text-sm py-2 px-4 rounded-2xl shadow-xl animate-bounce">
                {equippedNotice}
              </div>
            )}

            {/* Pet Name & Element */}
            <h2
              id="detail-name"
              className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            >
              {selectedPet.name}
            </h2>

            <div
              id="detail-element"
              className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-sm font-black uppercase tracking-wider border-2 mt-1 mb-4"
              style={{
                backgroundColor: '#0F172A',
                color: ELEMENT_CONFIG[selectedPet.element]?.text || '#F1C40F',
                borderColor: ELEMENT_CONFIG[selectedPet.element]?.border || '#3498DB',
              }}
            >
              <span>{ELEMENT_CONFIG[selectedPet.element]?.icon}</span>
              <span>{selectedPet.element} Element Guardian</span>
            </div>

            {/* 3D Avatar Stage */}
            <div
              id="detail-image"
              className="detail-avatar-stage w-36 h-36 sm:w-44 sm:h-44 rounded-3xl border-4 sm:border-6 border-dashed border-[#F1C40F] bg-[#0F172A] flex items-center justify-center text-6xl sm:text-7xl shadow-[0_0_30px_rgba(241,196,15,0.3)] animate-float mb-4 relative"
            >
              <span>{selectedPet.iconEmoji || '🐾'}</span>
              <div className="absolute -bottom-2 bg-[#F39C12] text-[#0F172A] text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-black/30">
                Stage 2 Evolution
              </div>
            </div>

            {/* Story Scroll */}
            <div
              id="detail-story"
              className="story-scroll w-full bg-black/40 border-2 border-[#334155] rounded-2xl p-4 text-white text-sm sm:text-base font-bold leading-relaxed mb-3 text-left"
            >
              <div className="flex items-center gap-2 mb-1 text-xs font-black uppercase tracking-wider text-[#F1C40F]">
                <span>📜 Companion Lore:</span>
              </div>
              {selectedPet.backstory}
            </div>

            {/* Habit Badge */}
            <div
              id="detail-bonus"
              className="habit-badge w-full bg-[#2ECC71] text-[#0F172A] border-2 border-[#27AE60] p-3.5 rounded-2xl font-black text-sm sm:text-base shadow-[0_6px_0_#27AE60] mb-4 text-left flex items-start gap-2.5"
            >
              <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="uppercase tracking-wider text-xs block text-black/70">Habit Superpower:</span>
                <span>{selectedPet.habitBonus}</span>
              </div>
            </div>

            {/* Base Stats Grid */}
            <div className="w-full bg-[#0F172A] border-2 border-[#334155] rounded-2xl p-3.5 mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#94A3B8] mb-2 text-left">
                Companion Base Stats:
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs font-black">
                {/* Hunger */}
                <div>
                  <div className="flex justify-between text-[#F39C12] mb-1">
                    <span>🍗 Hunger Cap</span>
                    <span>{selectedPet.baseStats.hunger}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      className="h-full bg-[#F39C12] rounded-full"
                      style={{ width: `${selectedPet.baseStats.hunger}%` }}
                    />
                  </div>
                </div>

                {/* Hygiene */}
                <div>
                  <div className="flex justify-between text-[#3498DB] mb-1">
                    <span>🛁 Hygiene Cap</span>
                    <span>{selectedPet.baseStats.hygiene}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      className="h-full bg-[#3498DB] rounded-full"
                      style={{ width: `${selectedPet.baseStats.hygiene}%` }}
                    />
                  </div>
                </div>

                {/* Energy */}
                <div>
                  <div className="flex justify-between text-[#F1C40F] mb-1">
                    <span>⚡ Energy</span>
                    <span>{selectedPet.baseStats.energy}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      className="h-full bg-[#F1C40F] rounded-full"
                      style={{ width: `${selectedPet.baseStats.energy}%` }}
                    />
                  </div>
                </div>

                {/* Joy */}
                <div>
                  <div className="flex justify-between text-[#2ECC71] mb-1">
                    <span>💖 Joy</span>
                    <span>{selectedPet.baseStats.joy}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155]">
                    <div
                      className="h-full bg-[#2ECC71] rounded-full"
                      style={{ width: `${selectedPet.baseStats.joy}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Evolution Matrix Stages */}
            <div className="w-full bg-[#0F172A]/70 border-2 border-[#334155] rounded-2xl p-3.5 mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#94A3B8] mb-2 text-left">
                Evolution Stages:
              </h4>
              <div className="evolution-track flex items-center justify-between gap-2 px-2">
                {/* Stage 1 */}
                <div className="evo-node w-12 h-12 rounded-full bg-[#2ECC71] border-3 border-[#A9DFBF] flex items-center justify-center text-lg shadow-md font-bold">
                  🥚
                </div>
                <div className="evo-line h-1.5 flex-1 bg-[#F1C40F] rounded-full" />
                {/* Stage 2 */}
                <div className="evo-node w-14 h-14 rounded-full bg-[#3498DB] border-3 border-[#F1C40F] shadow-[0_0_15px_#3498DB] flex items-center justify-center text-2xl font-bold">
                  {selectedPet.iconEmoji || '🐾'}
                </div>
                <div className="evo-line h-1.5 flex-1 bg-[#334155] rounded-full" />
                {/* Stage 3 */}
                <div className="evo-node w-12 h-12 rounded-full bg-[#334155] border-3 border-[#475569] flex items-center justify-center text-lg text-white/50 font-bold">
                  🛡️
                </div>
                <div className="evo-line h-1.5 flex-1 bg-[#334155] rounded-full" />
                {/* Stage 4 */}
                <div className="evo-node w-12 h-12 rounded-full bg-[#334155] border-3 border-[#475569] flex items-center justify-center text-lg text-white/50 font-bold">
                  👑
                </div>
              </div>
            </div>

            {/* Exclusive Gear Sets */}
            <div className="w-full mb-6">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#94A3B8] mb-2.5 text-left">
                Exclusive Gear Sets:
              </h4>
              <div className="gear-showcase flex gap-3 justify-center">
                {selectedPet.exclusiveGear.map((gearName, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      sounds.playTap();
                      alert(`🛡️ ${gearName}: Unlocks at Stage ${idx + 2}!`);
                    }}
                    className="gear-slot flex-1 bg-[#0F172A] hover:bg-[#334155] border-3 border-[#475569] hover:border-[#F1C40F] rounded-2xl p-2.5 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 group shadow-sm"
                    title={`Tap to view ${gearName}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {idx === 0 ? '🛡️' : idx === 1 ? '⚡' : '🥽'}
                    </span>
                    <span className="text-[10px] font-black text-white mt-1 text-center line-clamp-1">
                      {gearName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions: Equip or Close */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleEquipPet(selectedPet)}
                className="chunky-btn bg-[#2ECC71] flex-1 py-4 text-lg font-black uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer"
                style={{ '--shadow-color': '#27AE60' } as React.CSSProperties}
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>Equip Companion! 🐾</span>
              </button>

              <button
                onClick={handleCloseDetail}
                className="chunky-btn bg-[#F39C12] sm:w-36 py-4 text-lg font-black uppercase tracking-tight text-[#0F172A] flex items-center justify-center cursor-pointer"
                style={{ '--shadow-color': '#D68910' } as React.CSSProperties}
              >
                COOL! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
