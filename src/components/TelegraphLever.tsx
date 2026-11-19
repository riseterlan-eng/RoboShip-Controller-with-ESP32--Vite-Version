import React, { useRef, useState } from 'react';
import { Gauge } from 'lucide-react';
import { clamp } from '../utils/boatControl';

interface TelegraphLeverProps {
  throttlePct: number;
  onChange: (nextPct: number) => void;
}

const TELEGRAPH_DETENTS = [
  { label: 'FLANK', pct: 100 },
  { label: 'FULL', pct: 75 },
  { label: 'HALF', pct: 50 },
  { label: 'SLOW', pct: 25 },
  { label: 'STOP', pct: 0 },
] as const;

export const TelegraphLever: React.FC<TelegraphLeverProps> = ({ throttlePct, onChange }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromClientY = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rel = 1 - (clientY - rect.top) / rect.height;
    const pct = Math.round(clamp(rel * 100, 0, 100));
    onChange(pct);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic/browser environments where pointerId is not OS-active
    }
    activePointerId.current = e.pointerId;
    setDragging(true);
    updateFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerId.current !== e.pointerId) return;
    updateFromClientY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setDragging(false);
  };

  const pwm255 = Math.round((throttlePct / 100) * 255);

  return (
    <section
      aria-label="Tuas Telegraf Pengatur Kecepatan"
      className="flex h-full min-h-0 flex-col justify-between rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/38 p-2.5 touch-none select-none md:p-3.5"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xs font-semibold text-slate-100 md:text-sm">
            Tuas Telegraf
          </h2>
          <p className="hidden truncate text-[11px] text-slate-300/80 md:block short:hidden">
            Dorong tuas untuk PWM motor
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-bold tabular-nums text-amber-400 md:text-xl short:text-sm">
            {throttlePct}%
          </div>
          <div className="font-mono text-[10px] tabular-nums text-slate-300/80 md:text-[11px] short:hidden">
            PWM {pwm255}
          </div>
        </div>
      </div>

      {/* Telegraph Bridge Slot + Detent Buttons */}
      <div className="my-1.5 flex min-h-0 flex-1 items-stretch justify-center gap-2 md:gap-3">
        {/* Vertical Telegraph Track */}
        <div
          ref={trackRef}
          data-testid="telegraph-lever-track"
          role="slider"
          aria-label="Persentase PWM Tuas Telegraf"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={throttlePct}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(clamp(throttlePct + 5, 0, 100));
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(clamp(throttlePct - 5, 0, 100));
            }
          }}
          className="relative min-h-[120px] w-11 shrink-0 touch-none select-none rounded-xl border border-[#1E4764]/80 bg-[#06131F]/40 p-1.5 focus-visible:outline-2 focus-visible:outline-amber-400 md:w-14 md:p-2 short:w-10"
        >
          {/* Scale markings */}
          <div className="pointer-events-none absolute inset-x-2 top-2.5 bottom-2.5 flex flex-col justify-between">
            {[100, 75, 50, 25, 0].map((mark) => (
              <div key={mark} className="flex items-center justify-between">
                <span className="h-[1px] w-1.5 bg-[#2B6085]" />
                <span className="h-[1px] w-1.5 bg-[#2B6085]" />
              </div>
            ))}
          </div>

          {/* Active fill */}
          <div
            className="pointer-events-none absolute right-2 bottom-2 left-2 rounded-md bg-amber-500/25"
            style={{
              height: `calc(${throttlePct}% - 10px)`,
              minHeight: throttlePct > 0 ? '4px' : '0px',
            }}
          />

          {/* Lever Handle */}
          <div
            style={{
              bottom: `calc(${throttlePct}% * 0.78 + 5px)`,
              transition: dragging ? 'none' : 'bottom 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="pointer-events-none absolute right-1 left-1 flex h-6 items-center justify-center rounded-md border border-amber-200 bg-amber-400 text-slate-950 shadow-sm md:h-8"
          >
            <div className="h-1 w-5 rounded-full bg-slate-950/60 md:w-7" />
          </div>
        </div>

        {/* Detent Notch Buttons */}
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
          {TELEGRAPH_DETENTS.map((detent) => {
            const isSelected = throttlePct === detent.pct;
            const isStop = detent.pct === 0;
            return (
              <button
                key={detent.label}
                type="button"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  onChange(detent.pct);
                }}
                onClick={(e) => {
                  if (e.detail === 0) onChange(detent.pct);
                }}
                aria-label={`Set Telegraf ke ${detent.label} ${detent.pct} persen`}
                className={`flex min-h-[26px] flex-1 touch-none select-none items-center justify-between gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 md:min-h-[38px] md:px-3 md:text-xs short:min-h-[28px] short:text-[10px] ${
                  isSelected
                    ? isStop
                      ? 'border-red-400 bg-red-500/30 text-red-100'
                      : 'border-amber-400 bg-amber-500/25 text-amber-200'
                    : 'border-[#1A3D56]/80 bg-[#071624]/50 text-slate-200 hover:border-amber-400/50 hover:text-white'
                }`}
              >
                <span>{detent.label}</span>
                <span className="font-mono tabular-nums text-slate-300/80">{detent.pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine Slider Control for 1% precision */}
      <div className="shrink-0 border-t border-[#163850] pt-1.5 short:hidden">
        <label
          htmlFor="pwm-fine-slider"
          className="mb-1 flex items-center justify-between text-[11px] text-slate-300/80 md:text-xs"
        >
          <span className="flex items-center gap-1 truncate">
            <Gauge className="h-3 w-3 shrink-0 text-amber-400 md:h-3.5 md:w-3.5" aria-hidden="true" />
            <span className="truncate">Presisi PWM</span>
          </span>
          <span className="font-mono tabular-nums text-slate-100">{throttlePct}%</span>
        </label>
        <input
          id="pwm-fine-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={throttlePct}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-amber-400"
        />
      </div>
    </section>
  );
};
