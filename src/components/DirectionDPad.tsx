import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { DriveDirection } from '../utils/boatControl';

interface DirectionDPadProps {
  direction: DriveDirection;
  onChange: (nextDir: DriveDirection) => void;
}

export const DirectionDPad: React.FC<DirectionDPadProps> = ({ direction, onChange }) => {
  return (
    <section
      aria-label="D-Pad Mode Maju dan Mundur"
      className="flex flex-col justify-between rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/38 p-2.5 touch-none select-none md:p-3.5 short:p-2"
    >
      <div className="flex items-center justify-between gap-2 short:hidden">
        <h2 className="truncate font-display text-xs font-semibold text-slate-100 md:text-sm">
          Arah Motor
        </h2>
        <span
          className={`shrink-0 font-mono text-[11px] font-semibold ${
            direction === 'F' ? 'text-cyan-300' : 'text-red-400'
          }`}
        >
          {direction === 'F' ? 'FWD' : 'REV'}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 short:mt-0 short:h-full short:grid-cols-2">
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            onChange('F');
          }}
          onClick={(e) => {
            if (e.detail === 0) onChange('F');
          }}
          aria-pressed={direction === 'F'}
          className={`flex min-h-[44px] touch-none select-none items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 md:text-sm short:min-h-[40px] short:text-[11px] ${
            direction === 'F'
              ? 'border-cyan-300 bg-cyan-400/90 text-slate-950'
              : 'border-[#1A3D56]/80 bg-[#071624]/50 text-slate-200 hover:border-cyan-500/50 hover:text-white'
          }`}
        >
          <ArrowUp className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          <span className="short:hidden">Mode Maju</span>
          <span className="hidden short:inline">Maju</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            onChange('R');
          }}
          onClick={(e) => {
            if (e.detail === 0) onChange('R');
          }}
          aria-pressed={direction === 'R'}
          className={`flex min-h-[44px] touch-none select-none items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-red-400 md:text-sm short:min-h-[40px] short:text-[11px] ${
            direction === 'R'
              ? 'border-red-400 bg-red-500/90 text-white'
              : 'border-[#1A3D56]/80 bg-[#071624]/50 text-slate-200 hover:border-red-400/50 hover:text-white'
          }`}
        >
          <ArrowDown className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          <span className="short:hidden">Mode Mundur</span>
          <span className="hidden short:inline">Mundur</span>
        </button>
      </div>
    </section>
  );
};
