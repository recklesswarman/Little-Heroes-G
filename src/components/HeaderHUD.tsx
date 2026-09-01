import React from 'react';
import { HeroProfile } from '../types';
import { sounds } from '../utils/audio';
import { Lock, Volume2, VolumeX } from 'lucide-react';

interface HeaderHUDProps {
  hero: HeroProfile;
  soundEnabled: boolean;
  cloudSynced?: boolean;
  onToggleSound: () => void;
  onOpenParentLock: () => void;
  onSwitchProfile: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  hero,
  soundEnabled,
  cloudSynced = true,
  onToggleSound,
  onOpenParentLock,
  onSwitchProfile,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-1">
      <nav className="flex flex-wrap sm:flex-nowrap justify-between items-center bg-[#1E293B] border-2 border-[#334155] border-b-8 border-b-[#2980B9] rounded-[32px] sm:rounded-[40px] p-3 sm:p-5 shadow-2xl gap-3">
        {/* Left: Hero Profile Chip */}
        <button
          onClick={() => {
            sounds.playTap();
            onSwitchProfile();
          }}
          className="flex items-center gap-3 sm:gap-4 text-left group cursor-pointer active:scale-95 transition-transform"
          title="Switch Hero Profile"
        >
          <div className="w-14 h-14 sm:w-18 sm:h-18 avatar-3d rounded-full border-3 sm:border-4 border-white overflow-hidden flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <img
              src={hero.avatarUrl}
              alt={hero.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tighter text-white group-hover:text-[#F39C12] transition-colors leading-none mb-1">
              Captain {hero.name}
            </h1>
            <div className="flex gap-2 items-center">
              <span className="bg-[#F39C12] text-[#0F172A] px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide">
                LVL {hero.level}
              </span>
              <div className="w-24 sm:w-32 h-2.5 sm:h-3 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]/60">
                <div
                  className="h-full bg-gradient-to-r from-[#F1C40F] to-[#F39C12] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (hero.xp / hero.maxXp) * 100)}%` }}
                />
              </div>
              {cloudSynced && (
                <span
                  title="Synced with Cloud Firestore"
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-black uppercase text-[#2ECC71] bg-[#145A32]/60 px-2 py-0.5 rounded-full border border-[#2ECC71]/40 shadow-sm"
                >
                  ⚡ Cloud Sync
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Center: Stat Cluster with Artistic Flair Dividers */}
        <div className="flex items-center gap-3 sm:gap-5 order-3 sm:order-2 w-full sm:w-auto justify-around sm:justify-center pt-2 sm:pt-0 border-t border-[#334155]/40 sm:border-t-0">
          {/* XP / Star Points (⭐) */}
          <div className="flex flex-col items-center">
            <span className="text-[#F1C40F] text-xl sm:text-2xl font-black flex items-center gap-1 sm:gap-1.5">
              ⭐ <span className="text-white">{hero.points}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#94A3B8] font-black">
              XP Points
            </span>
          </div>

          <div className="w-1 h-8 sm:h-11 bg-[#334155] rounded-full" />

          {/* G-Coins (🪙) */}
          <div className="flex flex-col items-center">
            <span className="text-[#2ECC71] text-xl sm:text-2xl font-black flex items-center gap-1 sm:gap-1.5">
              🪙 <span className="text-white">{hero.coins.toLocaleString()}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#94A3B8] font-black">
              G-Coins
            </span>
          </div>

          <div className="w-1 h-8 sm:h-11 bg-[#334155] rounded-full" />

          {/* T-Tickets / Energy (🎟️) */}
          <div className="flex flex-col items-center">
            <span className="text-[#F39C12] text-xl sm:text-2xl font-black flex items-center gap-1 sm:gap-1.5">
              🎟️ <span className="text-white">{hero.tokens ?? 15}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#94A3B8] font-black">
              T-Tickets
            </span>
          </div>
        </div>

        {/* Right: Sound & Parent Lock Controls */}
        <div className="flex items-center gap-2 order-2 sm:order-3">
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#0F172A] hover:bg-[#334155] text-white flex items-center justify-center border-2 border-[#334155] active:translate-y-1 transition-all cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-[#2ECC71]" />
            ) : (
              <VolumeX className="w-5 h-5 text-[#94A3B8]" />
            )}
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              onOpenParentLock();
            }}
            className="bg-[#0F172A] hover:bg-[#334155] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border-2 border-[#334155] active:translate-y-1 transition-all flex items-center gap-1.5 font-bold text-xs sm:text-sm cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F39C12]" />
            <span className="hidden xs:inline uppercase tracking-wider text-[11px] font-black">Lock</span>
          </button>
        </div>
      </nav>
    </header>
  );
};

