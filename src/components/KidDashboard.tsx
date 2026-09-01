import React from 'react';
import { HeroProfile, TaskItem, PetNeedState } from '../types';
import { ASSET_IMAGES } from '../data/initialData';
import { sounds } from '../utils/audio';
import { Sparkles, Check, Play, Flame, Swords, Shield, Heart } from 'lucide-react';

interface KidDashboardProps {
  hero: HeroProfile;
  tasks: TaskItem[];
  pet: PetNeedState;
  onCompleteTask: (taskId: string) => void;
  onOpenARBrush: () => void;
  onOpenPetMatrix: () => void;
  onOpenShop: () => void;
  onOpenAdventureMap: () => void;
  onOpenTheming: () => void;
  onOpenPetCompendium?: () => void;
}

export const KidDashboard: React.FC<KidDashboardProps> = ({
  hero,
  tasks,
  pet,
  onCompleteTask,
  onOpenARBrush,
  onOpenPetMatrix,
  onOpenShop,
  onOpenAdventureMap,
  onOpenTheming,
  onOpenPetCompendium,
}) => {
  const choreTasks = tasks.filter((t) => t.category === 'task');
  const habitTasks = tasks.filter((t) => t.category === 'habit');
  const completedCount = tasks.filter((t) => t.completedToday).length;

  const equippedStickers = hero.equippedStickers || ['💧', '📚', '🦷'];
  const skin = hero.cardSkin || {
    id: 'skin-blue',
    name: 'Classic Blue',
    bgColor: '#1E293B',
    borderColor: '#3498DB',
    shadowColor: '#2980B9',
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-20 flex flex-col gap-6 sm:gap-8 selection:bg-[#F39C12] selection:text-white">
      {/* Hero Card Banner: 3D Shield & Adventure Status */}
      <section
        className="hero-card rounded-[36px] sm:rounded-[48px] p-6 sm:p-8 border-[#334155] border-b-[10px] sm:border-b-[12px] flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden transition-all duration-300"
        style={{
          backgroundColor: skin.bgColor,
          borderColor: skin.borderColor,
          borderBottomColor: skin.shadowColor,
        }}
      >
        {/* Background ambient geometric accents */}
        <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-48 h-48 text-[#3498DB]" fill="currentColor">
            <path d="M50 10 L90 90 L10 90 Z" />
          </svg>
        </div>

        <div className="flex flex-col items-center lg:items-start text-center lg:text-left z-10 max-w-xl">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
            <div className="inline-flex items-center gap-2 bg-[#0F172A] px-4 py-1.5 rounded-full border border-[#334155] shadow-inner">
              <Flame className="w-4 h-4 text-[#F39C12] fill-current" />
              <span className="text-xs font-black uppercase tracking-wider text-[#F39C12]">
                {hero.streakDays} Day Hero Streak!
              </span>
            </div>

            <button
              onClick={() => {
                sounds.playTap();
                onOpenTheming();
              }}
              className="inline-flex items-center gap-1.5 bg-[#0F172A] hover:bg-[#334155] px-3 py-1.5 rounded-full border border-[#3498DB] text-xs font-black uppercase tracking-wider text-[#3498DB] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <span>🎨</span> Customize
            </button>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-md">
            Ready for Action, {hero.name}!
          </h1>
          <p className="text-[#94A3B8] font-bold text-sm sm:text-base mt-2">
            You completed <span className="text-[#2ECC71] font-black">{completedCount}/{tasks.length}</span> quests today. Keep rocking!
          </p>

          {/* Equipped Stickers Ribbon */}
          <div className="mt-4 flex items-center gap-2.5 bg-[#0F172A]/80 border-2 border-white/10 px-4 py-2 rounded-2xl">
            <span className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Badges:
            </span>
            <div className="flex items-center gap-2">
              {equippedStickers.map((sticker, idx) => (
                <span
                  key={idx}
                  onClick={() => {
                    sounds.playTap();
                    onOpenTheming();
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-[#F1C40F]/60 flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110 shadow-sm"
                  title="Equipped badge - Tap to customize"
                >
                  {sticker || '✨'}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Pet Companion Mini-Widget */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              onClick={() => {
                sounds.playTap();
                onOpenPetMatrix();
              }}
              className="flex items-center gap-3.5 bg-[#0F172A]/90 border-2 border-[#334155] hover:border-[#2ECC71] px-4 py-2.5 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md group"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1E293B] border-2 border-[#3498DB] shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center text-xl">
                <span>{pet.element === 'Earth' ? '🦖' : pet.element === 'Fire' ? '🔥' : '🐉'}</span>
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{pet.name}</span>
                  <span className="text-[11px] text-[#F39C12] font-black uppercase">Lvl 14</span>
                </div>
                <div className="w-28 sm:w-40 h-2.5 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155] mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-[#2ECC71] to-[#54E98A] rounded-full"
                    style={{ width: `${(pet.joy + pet.hunger + pet.hygiene) / 3}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[#2ECC71] font-black uppercase tracking-wider ml-1 group-hover:translate-x-0.5 transition-transform">
                Pet Pen &rarr;
              </span>
            </div>

            {onOpenPetCompendium && (
              <button
                onClick={() => {
                  sounds.playTap();
                  onOpenPetCompendium();
                }}
                className="inline-flex items-center gap-1.5 bg-[#0F172A] hover:bg-[#334155] px-3.5 py-2.5 rounded-2xl border-2 border-[#3498DB] text-xs font-black uppercase tracking-wider text-[#3498DB] hover:text-white transition-all cursor-pointer shadow-md active:scale-95"
                title="View all 24 pets in the Hero Armory & Roster"
              >
                <span>🐾</span> 24 Pets
              </button>
            )}
          </div>
        </div>

        {/* 3D Shield Hero Trophy Asset & Clickable Avatar to open Theming */}
        <div
          onClick={() => {
            sounds.playTap();
            onOpenTheming();
          }}
          className="relative w-40 h-40 sm:w-52 sm:h-52 shrink-0 flex items-center justify-center cursor-pointer group"
          title="Tap to customize your Hero!"
        >
          <div className="absolute inset-0 bg-[#3498DB]/20 rounded-full blur-2xl animate-pulse group-hover:bg-[#F39C12]/30 transition-colors" />
          <img
            src={ASSET_IMAGES.heroShield}
            alt="Hero Shield"
            className="w-full h-full object-contain animate-float drop-shadow-[0_16px_32px_rgba(0,0,0,0.7)] group-hover:scale-105 transition-transform"
          />
          <div className="absolute -bottom-2 bg-[#F39C12] text-[#0F172A] font-black text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full border-2 border-black/40 shadow-lg group-hover:scale-110 transition-transform">
            🎨 Customize
          </div>
        </div>
      </section>

      {/* Main Dual-Column Grid Layout: Task Forest & Habit Islands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* THE TASK FOREST */}
        <section className="hero-card p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border-[#334155] border-b-[10px] sm:border-b-[12px] border-b-[#2ECC71] relative overflow-hidden flex flex-col">
          <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-40 h-40 text-[#2ECC71]" fill="currentColor">
              <path d="M50 10 L90 90 L10 90 Z" />
            </svg>
          </div>

          <div className="flex items-center justify-between mb-6 z-10">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 uppercase tracking-tight text-white">
              <span className="bg-[#2ECC71] p-2.5 rounded-2xl text-2xl shadow-md">🌲</span>
              THE TASK FOREST
            </h2>
            <span className="bg-[#0F172A] text-[#2ECC71] px-3.5 py-1 rounded-full text-xs font-black border border-[#334155]">
              {choreTasks.filter((t) => t.completedToday).length}/{choreTasks.length} DONE
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {choreTasks.map((task) => {
              const isAR = task.actionType === 'ar_brush';
              return (
                <div
                  key={task.id}
                  className={`w-full rounded-[24px] p-4 sm:p-5 flex items-center justify-between gap-3 transition-all ${
                    task.completedToday
                      ? 'bg-[#0F172A]/80 border-2 border-[#2ECC71]/40 opacity-75'
                      : isAR
                      ? 'chunky-btn chunky-btn-white p-4 sm:p-5 !text-[#0F172A] border-b-[8px] border-slate-300 w-full'
                      : 'chunky-btn chunky-btn-green p-4 sm:p-5 w-full'
                  }`}
                  style={
                    !task.completedToday
                      ? { '--shadow-color': isAR ? '#94A3B8' : '#27AE60' } as React.CSSProperties
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3.5 sm:gap-4 text-left">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/15 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                      <img src={task.icon3dUrl} alt={task.title} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base sm:text-xl font-black uppercase tracking-tight">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-black/25 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                          🪙 +{task.coinsReward}
                        </span>
                        <span className="bg-black/25 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                          ⭐ +{task.pointsReward} XP
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task CTA */}
                  {isAR && !task.completedToday ? (
                    <button
                      onClick={() => {
                        sounds.playTap();
                        onOpenARBrush();
                      }}
                      className="bg-[#3498DB] hover:bg-[#2980B9] text-white px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-md active:scale-95 transition-transform"
                    >
                      READY! ⚔️
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!task.completedToday) {
                          sounds.playCoin();
                          onCompleteTask(task.id);
                        }
                      }}
                      disabled={task.completedToday}
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${
                        task.completedToday
                          ? 'bg-[#2ECC71] text-white border-2 border-[#27AE60] cursor-default'
                          : 'bg-black/25 hover:bg-white hover:text-[#0F172A] text-white border-2 border-white/40 active:scale-90 cursor-pointer'
                      }`}
                      title={task.completedToday ? 'Completed' : 'Mark completed'}
                    >
                      <Check className={`w-6 h-6 stroke-[3.5] ${task.completedToday ? 'text-white' : ''}`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* HABIT ISLANDS */}
        <section className="hero-card p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border-[#334155] border-b-[10px] sm:border-b-[12px] border-b-[#3498DB] relative overflow-hidden flex flex-col">
          <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-40 h-40 text-[#3498DB]" fill="currentColor">
              <circle cx="50" cy="50" r="40" />
            </svg>
          </div>

          <div className="flex items-center justify-between mb-6 z-10">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 uppercase tracking-tight text-white">
              <span className="bg-[#3498DB] p-2.5 rounded-2xl text-2xl shadow-md">🏝️</span>
              HABIT ISLANDS
            </h2>
            <span className="bg-[#0F172A] text-[#3498DB] px-3.5 py-1 rounded-full text-xs font-black border border-[#334155]">
              {habitTasks.filter((t) => t.completedToday).length}/{habitTasks.length} DONE
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {habitTasks.map((habit) => (
              <div
                key={habit.id}
                className={`w-full rounded-[24px] p-4 sm:p-5 flex items-center justify-between gap-3 transition-all ${
                  habit.completedToday
                    ? 'bg-[#0F172A]/80 border-2 border-[#3498DB]/40 opacity-75'
                    : 'chunky-btn chunky-btn-blue p-4 sm:p-5 w-full'
                }`}
                style={
                  !habit.completedToday
                    ? { '--shadow-color': '#2980B9' } as React.CSSProperties
                    : undefined
                }
              >
                <div className="flex items-center gap-3.5 sm:gap-4 text-left">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/15 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                    <img src={habit.icon3dUrl} alt={habit.title} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base sm:text-xl font-black uppercase tracking-tight">
                      {habit.title}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="bg-black/25 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                        🪙 +{habit.coinsReward}
                      </span>
                      <span className="bg-black/25 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                        ⭐ +{habit.pointsReward} XP
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!habit.completedToday) {
                      sounds.playCoin();
                      onCompleteTask(habit.id);
                    }
                  }}
                  disabled={habit.completedToday}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${
                    habit.completedToday
                      ? 'bg-[#3498DB] text-white border-2 border-[#2980B9] cursor-default'
                      : 'bg-black/25 hover:bg-white hover:text-[#0F172A] text-white border-2 border-white/40 active:scale-90 cursor-pointer'
                  }`}
                  title={habit.completedToday ? 'Completed' : 'Mark completed'}
                >
                  <Check className={`w-6 h-6 stroke-[3.5] ${habit.completedToday ? 'text-white' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Sub-System Action Cards (Pet Pen, Pet Roster, Hero Shop, Adventure Map) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Pet Pen Button */}
        <button
          onClick={() => {
            sounds.playTap();
            onOpenPetMatrix();
          }}
          className="chunky-btn bg-[#F39C12] p-4 sm:p-5 text-lg sm:text-xl font-black flex items-center justify-center gap-3 group cursor-pointer"
          style={{ '--shadow-color': '#D68910' } as React.CSSProperties}
        >
          <span className="text-3xl group-hover:scale-125 transition-transform duration-200">
            🐉
          </span>
          <span className="uppercase tracking-tighter">PET PEN</span>
        </button>

        {/* Pet Roster & Compendium Button */}
        <button
          onClick={() => {
            sounds.playTap();
            if (onOpenPetCompendium) onOpenPetCompendium();
          }}
          className="chunky-btn bg-[#2ECC71] p-4 sm:p-5 text-lg sm:text-xl font-black flex items-center justify-center gap-3 text-white group cursor-pointer"
          style={{ '--shadow-color': '#27AE60' } as React.CSSProperties}
        >
          <span className="text-3xl group-hover:scale-125 transition-transform duration-200">
            🐾
          </span>
          <span className="uppercase tracking-tighter">PET ROSTER</span>
        </button>

        {/* Hero Shop Button */}
        <button
          onClick={() => {
            sounds.playTap();
            onOpenShop();
          }}
          className="chunky-btn bg-[#F1C40F] p-4 sm:p-5 text-lg sm:text-xl font-black flex items-center justify-center gap-3 text-[#0F172A] group cursor-pointer"
          style={{ '--shadow-color': '#B7950B' } as React.CSSProperties}
        >
          <span className="text-3xl group-hover:scale-125 transition-transform duration-200">
            🛒
          </span>
          <span className="uppercase tracking-tighter">HERO SHOP</span>
        </button>

        {/* Adventure Quest Map Button */}
        <button
          onClick={() => {
            sounds.playTap();
            onOpenAdventureMap();
          }}
          className="chunky-btn bg-[#3498DB] p-4 sm:p-5 text-lg sm:text-xl font-black flex items-center justify-center gap-3 group cursor-pointer"
          style={{ '--shadow-color': '#2980B9' } as React.CSSProperties}
        >
          <span className="text-3xl group-hover:scale-125 transition-transform duration-200">
            🗺️
          </span>
          <span className="uppercase tracking-tighter">QUEST MAP</span>
        </button>
      </section>

      {/* Footer Parent Portal Lock Indicator Badge */}
      <footer className="mt-2 flex justify-center">
        <div className="bg-[#1E293B] border-2 border-[#334155] rounded-full px-6 py-2.5 text-[#64748B] text-xs uppercase font-bold tracking-[0.2em] shadow-md flex items-center gap-2">
          <span>🔒</span> Secure Parent Portal Lock Active
        </div>
      </footer>
    </div>
  );
};

