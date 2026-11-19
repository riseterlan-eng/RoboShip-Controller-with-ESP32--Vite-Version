import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface IntroSplashScreenProps {
  onEnter: () => void;
  enterDurationMs?: number;
}

export const IntroSplashScreen: React.FC<IntroSplashScreenProps> = ({
  onEnter,
  enterDurationMs = 1100,
}) => {
  const [isEntering, setIsEntering] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleEnterClick = () => {
    if (isEntering) return;
    setIsEntering(true);
    setProgressPct(8);

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / enterDurationMs);
      const eased = Math.round((1 - Math.pow(1 - ratio, 2)) * 100);
      setProgressPct(eased);

      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onEnter();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div
      data-testid="intro-splash"
      data-entering={isEntering ? 'true' : 'false'}
      role="region"
      aria-label="Tayangan Awal KAPAL KARAM"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-white pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      {/* Background menggunakan file gambar yang diunggah pengguna */}
      <div
        aria-hidden="true"
        data-testid="intro-splash-bg"
        className="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/assets/aistudio/image_0af4d8d3.png')",
          backgroundColor: '#FFFFFF',
        }}
      />

      {/* Lapisan gradasi agar teks header & panel aksi tetap kontras terbaca */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6, 19, 31, 0.78) 0%, rgba(255, 255, 255, 0.06) 26%, rgba(255, 255, 255, 0.06) 64%, rgba(6, 19, 31, 0.94) 100%)',
        }}
      />

      {/* Bar Atas Kiri */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <span
          data-testid="intro-top-left-label"
          className="font-mono text-xs font-semibold tracking-wider text-cyan-300 uppercase"
        >
          EURO FT-UNSRAT · ESP32
        </span>
      </div>

      {/* Kartu Judul & Aksi Bawah (Ditahan di Intro sampai tombol ditekan) */}
      <div className="relative z-10 mx-auto mb-6 w-full max-w-md px-5">
        <div className="rounded-2xl border border-[#1E4764] bg-[#06131F]/94 p-5 text-center shadow-2xl">
          <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
            KAPAL KARAM
          </h1>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            Remote Control Bluetooth Robot Kapal Apung ESP32
          </p>

          {isEntering && (
            <div data-testid="intro-loading-panel" className="mt-4 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-medium text-cyan-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden="true" />
                  <span>
                    {progressPct < 45
                      ? 'Menyiapkan panel kontrol...'
                      : progressPct < 85
                        ? 'Menginisialisasi Bridge Bluetooth...'
                        : 'Membuka anjungan KAPAL KARAM...'}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-amber-300">{progressPct}%</span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 w-full overflow-hidden rounded-full bg-[#0D2235]"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-400 transition-[width] duration-75"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="intro-enter-btn"
            disabled={isEntering}
            onClick={handleEnterClick}
            className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/80 focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            {isEntering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memuat Kontrol Kapal...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Kontrol Kapal</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
