import React from 'react';
import { Anchor, Droplets, Lightbulb, Radio, Sun, Volume2 } from 'lucide-react';
import type { AccessoryState } from '../utils/boatControl';

interface AccessoryPanelProps {
  accessories: AccessoryState;
  onToggle: (key: keyof AccessoryState) => void;
}

const ACCESSORY_BUTTONS: {
  key: keyof AccessoryState;
  label: string;
  pin: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'navLights', label: 'Navigasi', pin: 'GPIO 16', icon: Lightbulb },
  { key: 'spotlight', label: 'Sorot', pin: 'GPIO 17', icon: Sun },
  { key: 'siren', label: 'Sirine', pin: 'GPIO 18', icon: Volume2 },
  { key: 'beacon', label: 'Beacon', pin: 'GPIO 19', icon: Radio },
  { key: 'bilgePump', label: 'Pompa', pin: 'GPIO 21', icon: Droplets },
  { key: 'anchor', label: 'Jangkar', pin: 'GPIO 22', icon: Anchor },
];

export const AccessoryPanel: React.FC<AccessoryPanelProps> = ({ accessories, onToggle }) => {
  const activeCount = Object.values(accessories).filter(Boolean).length;

  return (
    <section
      aria-label="6 Tombol Tambahan Aksesori Kapal"
      className="flex flex-col justify-between rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/38 p-2.5 touch-none select-none md:p-3.5 short:p-2"
    >
      <div className="flex items-center justify-between gap-2 short:hidden">
        <h2 className="truncate font-display text-xs font-semibold text-slate-100 md:text-sm">
          Aksesori (6)
        </h2>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-300/80">
          {activeCount}/6
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 short:mt-0">
        {ACCESSORY_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          const active = accessories[btn.key];
          return (
            <button
              key={btn.key}
              type="button"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault();
                onToggle(btn.key);
              }}
              onClick={(e) => {
                if (e.detail === 0) onToggle(btn.key);
              }}
              aria-pressed={active}
              aria-label={`${btn.pin} ${btn.label}`}
              title={`${btn.label} (${btn.pin})`}
              className={`flex min-h-[44px] touch-none select-none items-center justify-center rounded-lg border px-1.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 short:min-h-[38px] ${
                active
                  ? 'border-amber-400 bg-amber-500/25 text-amber-300'
                  : 'border-[#1A3D56]/80 bg-[#071624]/50 text-slate-200 hover:border-amber-400/50 hover:text-white'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'text-amber-400' : 'text-slate-300'}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
};
