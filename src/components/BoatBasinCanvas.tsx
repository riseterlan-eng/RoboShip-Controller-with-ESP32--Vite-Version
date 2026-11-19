import React, { useEffect, useRef, useState } from 'react';
import { Radio, RotateCcw } from 'lucide-react';
import {
  formatChangedParameterSignal,
  stepBoatPhysics,
  type BoatControlCommand,
  type BoatSimState,
} from '../utils/boatControl';

interface BoatBasinCanvasProps {
  command: BoatControlCommand;
  isConnected: boolean;
  paused?: boolean;
}

const INITIAL_BOAT: BoatSimState = {
  x: 380,
  y: 205,
  headingDeg: 0,
  speed: 0,
  rudderAngleDeg: 90,
};

export const BoatBasinCanvas: React.FC<BoatBasinCanvasProps> = ({
  command,
  isConnected,
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const commandRef = useRef<BoatControlCommand>(command);
  const connectedRef = useRef<boolean>(isConnected);
  const pausedRef = useRef<boolean>(paused);
  const boatRef = useRef<BoatSimState>({ ...INITIAL_BOAT });
  const wakeRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const [hudStats, setHudStats] = useState({
    headingDeg: 0,
    rudderDeg: 90,
    speedKnots: '0.0',
  });
  const prevCommandRef = useRef<BoatControlCommand | null>(null);
  const [changedSignal, setChangedSignal] = useState<{ label: string; param: string }>(() =>
    formatChangedParameterSignal(null, command)
  );

  useEffect(() => {
    commandRef.current = command;
    if (prevCommandRef.current !== null) {
      const nextSignal = formatChangedParameterSignal(prevCommandRef.current, command);
      if (nextSignal.hasChanges) {
        setChangedSignal({ label: nextSignal.label, param: nextSignal.param });
      }
    }
    prevCommandRef.current = command;
  }, [command]);

  useEffect(() => {
    connectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const handleResetBoat = () => {
    boatRef.current = { ...INITIAL_BOAT };
    wakeRef.current = [];
    setHudStats({ headingDeg: 0, rudderDeg: 90, speedKnots: '0.0' });
  };

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudTick = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!pausedRef.current) {
        const activeCmd = connectedRef.current
          ? commandRef.current
          : {
              ...commandRef.current,
              throttlePct: 0,
              joyMagPct: 0,
            };

        const nextBoat = stepBoatPhysics(boatRef.current, activeCmd, dt, {
          width: 760,
          height: 380,
          margin: 42,
        });
        boatRef.current = nextBoat;

        // Record wake particles when propeller spins
        if (Math.abs(nextBoat.speed) > 12) {
          const rad = (nextBoat.headingDeg * Math.PI) / 180;
          const sternX = nextBoat.x - Math.sin(rad) * 32;
          const sternY = nextBoat.y + Math.cos(rad) * 32;
          wakeRef.current.push({ x: sternX, y: sternY, alpha: 0.65 });
          if (wakeRef.current.length > 48) {
            wakeRef.current.shift();
          }
        }
        for (const p of wakeRef.current) {
          p.alpha *= 0.96;
        }
        wakeRef.current = wakeRef.current.filter((p) => p.alpha > 0.04);

        // Throttle React HUD readout updates to ~10Hz
        hudTick += dt;
        if (hudTick >= 0.1) {
          hudTick = 0;
          setHudStats({
            headingDeg: Math.round(nextBoat.headingDeg),
            rudderDeg: Math.round(nextBoat.rudderAngleDeg),
            speedKnots: (Math.abs(nextBoat.speed) / 38).toFixed(1),
          });
        }

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawBasin(ctx, nextBoat, activeCmd, wakeRef.current, now, connectedRef.current);
          }
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <section
      aria-label="Simulator Kolam Uji Robot Kapal"
      className="flex h-[184px] shrink-0 flex-col rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/38 p-2.5 md:h-auto md:min-h-0 md:flex-1 md:p-3.5 short:p-2"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 md:mb-2 short:mb-1">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xs font-semibold text-slate-100 md:text-sm short:text-xs">
            Arena Kapal
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-slate-200 md:text-xs">
            <span className="whitespace-nowrap">Haluan {hudStats.headingDeg}°</span>
            <span className="text-[#2B6085]" aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Rudder {hudStats.rudderDeg}°</span>
            <span className="hidden whitespace-nowrap text-[#2B6085] lg:inline" aria-hidden="true">·</span>
            <span className="hidden whitespace-nowrap lg:inline">Laju {hudStats.speedKnots} kt</span>
          </div>
          <button
            type="button"
            onClick={handleResetBoat}
            aria-label="Reset Posisi Kapal"
            className="flex min-h-[32px] items-center gap-1 rounded-md border border-[#1E4764]/80 bg-[#071624]/55 px-2 py-1 text-[11px] font-medium text-slate-100 whitespace-nowrap hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 md:min-h-[34px] md:text-xs short:min-h-[28px]"
          >
            <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Signal Monitor Screen + Arena Canvas */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#163850]/80 bg-[#041422]/30">
        {/* Layar Monitor Sinyal Data Ringkas (Hanya Parameter yang Diubah) */}
        <div
          data-testid="live-signal-screen"
          aria-live="polite"
          className="flex shrink-0 items-center justify-between gap-2 border-b border-[#163850]/80 bg-[#04101B]/72 px-2 py-0.5 md:px-2.5"
        >
          <div className="flex min-w-0 items-center gap-1">
            <Radio
              className={`h-3 w-3 shrink-0 ${isConnected ? 'text-emerald-400' : 'text-cyan-400'}`}
              aria-hidden="true"
            />
            <span
              data-testid="live-signal-desc"
              className="truncate text-[10px] font-medium leading-tight text-slate-200"
            >
              {changedSignal.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 font-mono text-[10px] leading-tight tabular-nums">
            <span className="text-slate-400">TX:</span>
            <code
              data-testid="live-signal-frame"
              className="rounded border border-[#1E4764] bg-[#071624] px-1.5 py-px font-semibold text-cyan-300"
            >
              {changedSignal.param}
            </code>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <canvas
            ref={canvasRef}
            data-testid="boat-basin-canvas"
            data-heading={hudStats.headingDeg}
            data-rudder={hudStats.rudderDeg}
            width={760}
            height={380}
            className="block h-full w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
};

function drawBasin(
  ctx: CanvasRenderingContext2D,
  boat: BoatSimState,
  cmd: BoatControlCommand,
  wake: { x: number; y: number; alpha: number }[],
  nowMs: number,
  isConnected: boolean
) {
  const W = 760;
  const H = 380;

  // Translucent ocean water tint so underlying custom/default wallpaper stays visible
  ctx.clearRect(0, 0, W, H);
  const seaGrad = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 460);
  seaGrad.addColorStop(0, 'rgba(9, 40, 61, 0.24)');
  seaGrad.addColorStop(1, 'rgba(4, 19, 32, 0.38)');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle nautical coordinate grid & sonar range rings
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 50; x < W; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 50; y < H; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (const r of [90, 165]) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Operator POV zone marker at bottom edge
  ctx.fillStyle = 'rgba(6, 19, 31, 0.65)';
  ctx.fillRect(W / 2 - 140, H - 30, 280, 24);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  ctx.strokeRect(W / 2 - 140, H - 30, 280, 24);
  ctx.fillStyle = '#BAE6FD';
  ctx.font = '600 12px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POSISI OPERATOR (MENGHADAP KE ATAS / 0°)', W / 2, H - 14);

  // Draw wake trail
  for (const p of wake) {
    ctx.fillStyle = `rgba(165, 243, 252, ${p.alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Headless target POV vector around boat when joystick active
  if (isConnected && cmd.joyMagPct > 0) {
    const targetRad = (cmd.joyAngleDeg * Math.PI) / 180;
    const vecLen = 78;
    const tx = boat.x + Math.sin(targetRad) * vecLen;
    const ty = boat.y - Math.cos(targetRad) * vecLen;

    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(boat.x, boat.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Siren acoustic pulse rings (Aux Bit 2)
  if (isConnected && cmd.accessories.siren) {
    const phase = (nowMs % 900) / 900;
    ctx.strokeStyle = `rgba(245, 158, 11, ${(1 - phase) * 0.75})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(boat.x, boat.y, 32 + phase * 64, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw Boat Hull
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate((boat.headingDeg * Math.PI) / 180);

  // Spotlight beam (Aux Bit 1)
  if (isConnected && cmd.accessories.spotlight) {
    const grad = ctx.createLinearGradient(0, -34, 0, -210);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
    grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(-48, -210);
    ctx.lineTo(48, -210);
    ctx.lineTo(8, -32);
    ctx.closePath();
    ctx.fill();
  }

  // Hull body (pointed bow up, flat transom stern down)
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = isConnected ? '#38BDF8' : '#64748B';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -38); // Bow tip
  ctx.quadraticCurveTo(22, -14, 19, 28);
  ctx.lineTo(-19, 28);
  ctx.quadraticCurveTo(-22, -14, 0, -38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Deck cabin
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-11, -12, 22, 26, 4);
  ctx.fill();
  ctx.stroke();

  // Bow direction chevron
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(5, -21);
  ctx.lineTo(-5, -21);
  ctx.closePath();
  ctx.fill();

  // Port (Red) & Starboard (Green) Navigation Lights (Aux Bit 0)
  if (isConnected && cmd.accessories.navLights) {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(-16, -6, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(16, -6, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Strobe Beacon (Aux Bit 3)
  if (isConnected && cmd.accessories.beacon) {
    const flash = Math.floor(nowMs / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#F59E0B' : 'rgba(245, 158, 11, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rudder Blade at Stern
  const rudderDeflectionRad = ((boat.rudderAngleDeg - 90) * Math.PI) / 180;
  ctx.save();
  ctx.translate(0, 30);
  ctx.rotate(rudderDeflectionRad);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 14);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Disconnected overlay hint on canvas
  if (!isConnected) {
    ctx.fillStyle = 'rgba(11, 18, 32, 0.68)';
    ctx.fillRect(W / 2 - 250, 14, 500, 32);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.strokeRect(W / 2 - 250, 14, 500, 32);
    ctx.fillStyle = '#FCA5A5';
    ctx.font = '600 13px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bluetooth Disconnected · Klik "Scan Bluetooth" untuk mengendalikan kapal', W / 2, 35);
  }
}
