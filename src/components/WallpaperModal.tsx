import React, { useRef, useState } from 'react';
import { Check, ImagePlus, RotateCcw, SlidersHorizontal, Upload, X } from 'lucide-react';
import {
  compressImageFileToDataUrl,
  MARITIME_PRESETS,
  type MaritimeThemeId,
  type WallpaperConfig,
} from '../utils/appPreferences';

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WallpaperConfig;
  onChange: (next: WallpaperConfig) => void;
  onReset: () => void;
}

export const WallpaperModal: React.FC<WallpaperModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar yang valid (JPG, PNG, WEBP).');
      return;
    }

    setErrorMsg(null);
    setUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1600);
      onChange({
        ...config,
        themeId: 'custom',
        customImageDataUrl: dataUrl,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memproses gambar dari perangkat.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSelectPreset = (themeId: Exclude<MaritimeThemeId, 'custom'>) => {
    setErrorMsg(null);
    onChange({
      ...config,
      themeId,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallpaper-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#1E4764] bg-[#0B1E2E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#163850] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="wallpaper-modal-title"
              className="font-display text-base font-bold text-slate-100 md:text-lg"
            >
              Tema Kapal &amp; Wallpaper Kustom
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Pasang foto dari galeri/perangkat Anda atau pilih nuansa anjungan laut
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan wallpaper"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#1E4764] bg-[#06131F] text-slate-300 hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Upload Custom Device Image */}
          <div className="rounded-xl border border-[#1A3D56] bg-[#071624] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-100">
                  <ImagePlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  <span>Unggah Wallpaper dari Perangkat</span>
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Pilih foto kapal, danau, atau gambar pribadi (JPG, PNG, WEBP) tersimpan lokal di perangkat Anda.
                </p>
              </div>

              <input
                ref={fileInputRef}
                data-testid="wallpaper-file-input"
                type="file"
                accept="image/*"
                onChange={handleSelectFile}
                className="sr-only"
                aria-label="Pilih file gambar wallpaper dari perangkat"
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 whitespace-nowrap transition-colors hover:bg-cyan-300 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{uploading ? 'Memproses...' : 'Pilih Foto / Gambar'}</span>
              </button>
            </div>

            {errorMsg && (
              <p className="mt-2.5 text-xs font-medium text-red-300" role="alert">
                {errorMsg}
              </p>
            )}

            {config.customImageDataUrl && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#1E4764] bg-[#0B1E2E] p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={config.customImageDataUrl}
                    alt="Pratinjau wallpaper kustom"
                    className="h-12 w-20 shrink-0 rounded-md border border-[#245274] object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-100">
                      Gambar Kustom Perangkat
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      {config.themeId === 'custom' ? 'Sedang aktif' : 'Tersimpan · klik Terapkan'}
                    </div>
                  </div>
                </div>
                {config.themeId !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, themeId: 'custom' })}
                    className="min-h-[38px] shrink-0 rounded-md bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30"
                  >
                    Terapkan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dimming / Contrast Scrim Slider */}
          <div className="rounded-xl border border-[#1A3D56] bg-[#071624] p-4">
            <label
              htmlFor="wallpaper-scrim-slider"
              className="flex items-center justify-between text-xs font-semibold text-slate-200"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>Kegelapan Lapisan Kontrol (Agar Tombol Tetap Jelas)</span>
              </span>
              <span className="font-mono tabular-nums text-amber-300">
                {Math.round(config.scrimOpacity * 100)}%
              </span>
            </label>
            <input
              id="wallpaper-scrim-slider"
              type="range"
              min={15}
              max={85}
              step={5}
              value={Math.round(config.scrimOpacity * 100)}
              onChange={(e) =>
                onChange({
                  ...config,
                  scrimOpacity: Number(e.target.value) / 100,
                })
              }
              className="mt-2.5 h-2 w-full cursor-pointer accent-amber-400"
            />
          </div>

          {/* Built-in Maritime Presets */}
          <div>
            <h3 className="mb-2.5 text-xs font-semibold text-slate-300">
              Pilihan Latar Maritim Bawaan
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MARITIME_PRESETS.map((preset) => {
                const active = config.themeId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    aria-pressed={active}
                    className={`flex min-h-[76px] flex-col justify-between rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/15'
                        : 'border-[#1A3D56] bg-[#071624] hover:border-[#2B6085]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      {preset.imageUrl ? (
                        <img
                          src={preset.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="h-6 w-10 rounded border border-white/20 bg-white object-contain p-0.5"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="h-5 w-8 rounded border border-white/15"
                          style={{ background: preset.previewBg }}
                        />
                      )}
                      {active && <Check className="h-4 w-4 text-cyan-300" aria-hidden="true" />}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-slate-100">{preset.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-slate-400">
                        {preset.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#163850] bg-[#071624] px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              onReset();
            }}
            className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-[#1E4764] bg-[#0B1E2E] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Bawaan</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
