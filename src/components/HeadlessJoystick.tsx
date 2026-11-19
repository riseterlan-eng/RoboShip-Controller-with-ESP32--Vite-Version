import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, RotateCcw } from 'lucide-react';
import {
  combineCardinalAngles,
  computeHeadlessJoystick,
  type JoystickOutput,
} from '../utils/boatControl';

interface HeadlessJoystickProps {
  value: { angleDeg: number; magPct: number };
  onChange: (angleDeg: number, magPct: number) => void;
  disabled?: boolean;
}

const CARDINAL_HINTS = [
  { label: 'Menjauh (0°)', short: 'Atas', angle: 0, icon: ArrowUp },
  { label: 'Kanan (90°)', short: 'Kanan', angle: 90, icon: ArrowRight },
  { label: 'Menghadap (180°)', short: 'Bawah', angle: 180, icon: ArrowDown },
  { label: 'Kiri (270°)', short: 'Kiri', angle: 270, icon: ArrowLeft },
] as const;

export const HeadlessJoystick: React.FC<HeadlessJoystickProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [holdDirection, setHoldDirection] = useState(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const heldCardinalPointersRef = useRef<Map<number, number>>(new Map());

  const getPadRadius = useCallback(() => {
    if (!padRef.current) return 68;
    return Math.max(40, (padRef.current.clientWidth / 2) * 0.74);
  }, []);

  const syncKnobFromValue = useCallback(
    (angleDeg: number, magPct: number) => {
      if (magPct <= 0) {
        setKnobOffset({ x: 0, y: 0 });
        return;
      }
      const radius = getPadRadius();
      const rad = (angleDeg * Math.PI) / 180;
      const dist = (magPct / 100) * radius;
      setKnobOffset({
        x: Math.sin(rad) * dist,
        y: -Math.cos(rad) * dist,
      });
    },
    [getPadRadius]
  );

  useEffect(() => {
    if (!dragging) {
      syncKnobFromValue(value.angleDeg, value.magPct);
    }
  }, [dragging, value.angleDeg, value.magPct, syncKnobFromValue]);

  const processClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const radius = Math.max(40, (rect.width / 2) * 0.74);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      const out: JoystickOutput = computeHeadlessJoystick(dx, dy, radius);
      const dist = Math.min(Math.hypot(dx, dy), radius);
      const scale = dist / (Math.hypot(dx, dy) || 1);
      setKnobOffset({ x: dx * scale, y: dy * scale });

      if (out.isDeadzone) {
        onChange(0, 0);
      } else {
        onChange(out.angleDeg, Math.round(out.magnitude * 100));
      }
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic/browser environments where pointerId is not OS-active
    }
    activePointerId.current = e.pointerId;
    setDragging(true);
    processClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerId.current !== e.pointerId) return;
    processClientPoint(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setDragging(false);
    if (!holdDirection) {
      setKnobOffset({ x: 0, y: 0 });
      onChange(0, 0);
    }
  };

  const handleReset = () => {
    heldCardinalPointersRef.current.clear();
    setKnobOffset({ x: 0, y: 0 });
    onChange(0, 0);
  };

  const triggerPresetDirection = (angle: number) => {
    if (disabled) return;
    setHoldDirection(true);
    onChange(angle, 100);
  };

  const handleCardinalPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    angle: number
  ) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    heldCardinalPointersRef.current.set(e.pointerId, angle);
    const combined = combineCardinalAngles(
      Array.from(heldCardinalPointersRef.current.values())
    );
    setHoldDirection(true);
    if (combined !== null) {
      onChange(combined, 100);
    } else {
      onChange(angle, 100);
    }
  };

  const handleCardinalPointerRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    heldCardinalPointersRef.current.delete(e.pointerId);
  };

  const activeVectorDesc =
    value.magPct === 0
      ? 'Netral'
      : value.angleDeg >= 315 || value.angleDeg < 45
        ? 'Menjauh'
        : value.angleDeg >= 45 && value.angleDeg < 135
          ? 'Kanan POV'
          : value.angleDeg >= 135 && value.angleDeg < 225
            ? 'Menghadap'
            : 'Kiri POV';

  return (
    <section
      aria-label="Virtual Analog Headless Joystick"
      className="flex h-full min-h-0 flex-col items-center justify-between rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/38 p-2.5 touch-none select-none md:p-3.5"
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xs font-semibold text-slate-100 md:text-sm">
            Headless 360°
          </h2>
          <p className="hidden truncate text-[11px] text-slate-300/80 md:block short:hidden">
            Absolut terhadap pandangan operator
          </p>
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            setHoldDirection((prev) => !prev);
          }}
          onClick={(e) => {
            if (e.detail === 0) setHoldDirection((prev) => !prev);
          }}
          aria-pressed={holdDirection}
          className={`min-h-[34px] shrink-0 touch-none select-none whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 md:min-h-[38px] md:px-2.5 md:text-xs short:min-h-[30px] ${
            holdDirection
              ? 'border-cyan-400/70 bg-cyan-500/25 text-cyan-200'
              : 'border-[#1E4764]/80 bg-[#071624]/50 text-slate-200 hover:border-cyan-500/50'
          }`}
        >
          {holdDirection ? 'Terkunci' : 'Kunci'}
        </button>
      </div>

      {/* Analog Stick Pad */}
      <div className="relative my-1 flex flex-1 min-h-0 items-center justify-center">
        <div
          ref={padRef}
          data-testid="headless-joystick-pad"
          role="slider"
          aria-label="Kontrol Arah Headless 360 Derajat"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={value.angleDeg}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              triggerPresetDirection(0);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              triggerPresetDirection(90);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              triggerPresetDirection(180);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              triggerPresetDirection(270);
            } else if (e.key === 'Escape' || e.key === ' ') {
              e.preventDefault();
              handleReset();
            }
          }}
          className="relative flex h-[132px] w-[132px] touch-none select-none items-center justify-center rounded-full border-2 border-[#1E4764]/85 bg-[#06131F]/35 focus-visible:outline-2 focus-visible:outline-cyan-400 md:h-[204px] md:w-[204px] short:h-[136px] short:w-[136px]"
        >
          {/* Outer compass ring & crosshairs */}
          <svg
            aria-hidden="true"
            viewBox="0 0 216 216"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <circle
              cx="108"
              cy="108"
              r="84"
              fill="none"
              stroke="rgba(34, 211, 238, 0.22)"
              strokeDasharray="4 4"
            />
            <circle
              cx="108"
              cy="108"
              r="22"
              fill="none"
              stroke="rgba(148, 163, 184, 0.28)"
            />
            <line x1="108" y1="14" x2="108" y2="202" stroke="rgba(56, 189, 248, 0.14)" />
            <line x1="14" y1="108" x2="202" y2="108" stroke="rgba(56, 189, 248, 0.14)" />
          </svg>

          <span className="pointer-events-none absolute top-1.5 text-[9px] font-semibold tracking-wider text-cyan-300/80 md:text-[10px]">
            JAUH
          </span>
          <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-semibold tracking-wider text-cyan-300/80 md:text-[10px]">
            DEKAT
          </span>
          <span className="pointer-events-none absolute left-1.5 text-[9px] font-semibold tracking-wider text-cyan-300/80 md:text-[10px]">
            KIRI
          </span>
          <span className="pointer-events-none absolute right-1.5 text-[9px] font-semibold tracking-wider text-cyan-300/80 md:text-[10px]">
            KANAN
          </span>

          {/* Draggable Analog Cap */}
          <div
            data-testid="headless-joystick-knob"
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
              transition: dragging ? 'none' : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className={`pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-sm md:h-16 md:w-16 short:h-11 short:w-11 ${
              value.magPct > 0
                ? 'border-cyan-200 bg-cyan-400 text-slate-950'
                : 'border-[#2B6085] bg-[#0E283D]/75 text-cyan-100'
            }`}
          >
            <Compass className="h-5 w-5 md:h-6 md:w-6 short:h-5 short:w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Compact Quick Direction Bar + Readout */}
      <div className="w-full shrink-0 space-y-1.5">
        <div className="grid w-full grid-cols-5 gap-1 short:hidden">
          {CARDINAL_HINTS.map((item) => {
            const Icon = item.icon;
            const isActive = value.magPct > 0 && value.angleDeg === item.angle;
            return (
              <button
                key={item.angle}
                type="button"
                onPointerDown={(e) => handleCardinalPointerDown(e, item.angle)}
                onPointerUp={handleCardinalPointerRelease}
                onPointerCancel={handleCardinalPointerRelease}
                onClick={(e) => {
                  if (e.detail === 0) triggerPresetDirection(item.angle);
                }}
                aria-label={`Arah Headless ${item.label}`}
                className={`flex min-h-[38px] touch-none select-none items-center justify-center rounded-md border px-1 py-1 text-[10px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 md:min-h-[42px] md:text-xs ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                    : 'border-[#1A3D56]/80 bg-[#071624]/50 text-slate-200 hover:border-cyan-500/50 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 md:hidden" aria-hidden="true" />
                <span className="hidden md:inline">{item.short}</span>
              </button>
            );
          })}
          <button
            type="button"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              e.preventDefault();
              handleReset();
            }}
            onClick={(e) => {
              if (e.detail === 0) handleReset();
            }}
            aria-label="Reset Analog ke Netral"
            className="flex min-h-[38px] touch-none select-none items-center justify-center rounded-md border border-[#1A3D56]/80 bg-[#071624]/50 px-1 py-1 text-slate-200 hover:border-cyan-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 md:min-h-[42px]"
          >
            <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex w-full items-center justify-between border-t border-[#163850] pt-1 text-[11px] md:text-xs">
          <span className="truncate text-slate-300/80">{activeVectorDesc}</span>
          <span className="font-mono tabular-nums text-cyan-300">
            {value.angleDeg}° · {value.magPct}%
          </span>
        </div>
      </div>
    </section>
  );
};
