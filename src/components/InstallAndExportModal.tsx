import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderArchive,
  Globe,
  Loader2,
  QrCode,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  copyTextToClipboard,
  isPrivateDevPreviewOrigin,
  normalizeShareUrl,
  resolveShareableOrigin,
} from '../utils/appPreferences';
import { generateProjectZipBlob, triggerBlobDownload } from '../utils/projectZip';

interface InstallAndExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalTab = 'install' | 'zip' | 'vercel';
type MobileGuidePlatform = 'android' | 'ios';

const CUSTOM_SHARE_URL_KEY = 'kapalrc_share_url_v1';

export const InstallAndExportModal: React.FC<InstallAndExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [tab, setTab] = useState<ModalTab>('install');
  const { isInstallable, isInstalled, isAndroid, isIOS, isInIframe, install } = usePWAInstall();
  const [guidePlatform, setGuidePlatform] = useState<MobileGuidePlatform>(() =>
    isIOS ? 'ios' : 'android'
  );

  const rawOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://kapalrc-bridge.vercel.app';
  const defaultOrigin = resolveShareableOrigin(rawOrigin);
  const usingDevToSharedRedirect = isPrivateDevPreviewOrigin(rawOrigin);

  const [customUrlInput, setCustomUrlInput] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_SHARE_URL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyErrorNotice, setCopyErrorNotice] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isIOS) setGuidePlatform('ios');
    else if (isAndroid) setGuidePlatform('android');
  }, [isIOS, isAndroid]);

  const activeShareUrl = useMemo(
    () => normalizeShareUrl(customUrlInput, defaultOrigin),
    [customUrlInput, defaultOrigin]
  );

  useEffect(() => {
    if (!isOpen) {
      setInstallNotice(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(activeShareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#06131F',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [activeShareUrl, isOpen]);

  if (!isOpen) return null;

  const handleSaveShareUrl = (val: string) => {
    setCustomUrlInput(val);
    try {
      if (val.trim()) {
        localStorage.setItem(CUSTOM_SHARE_URL_KEY, val);
      } else {
        localStorage.removeItem(CUSTOM_SHARE_URL_KEY);
      }
    } catch {
      // Ignore storage error
    }
  };

  const handleCopyLink = async () => {
    setCopyErrorNotice(null);
    const ok = await copyTextToClipboard(activeShareUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } else {
      setCopiedLink(false);
      setCopyErrorNotice('Salin otomatis diblokir browser. Tekan & tahan kotak link di atas untuk menyalin manual.');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'KAPAL KARAM — Remote Kapal ESP32',
        text: 'Buka dan pasang aplikasi KAPAL KARAM (Remote Control Kapal Apung ESP32) di Android / iPhone:',
        url: activeShareUrl,
      });
    } catch {
      // User cancelled share dialog
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = 'kapal-karam-qr.png';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDirectInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallNotice('Aplikasi sedang dipasang ke perangkat Anda.');
      }
      return;
    }

    if (guidePlatform === 'ios' || isIOS) {
      setGuidePlatform('ios');
      setInstallNotice(
        'iOS (iPhone/iPad): Buka tautan ini di Safari, ketuk ikon Share (kotak panah atas), lalu pilih "Tambah ke Layar Utama" (Add to Home Screen).'
      );
    } else {
      setGuidePlatform('android');
      setInstallNotice(
        isInIframe
          ? 'Anda sedang di mode pratinjau tersemat. Klik "Buka Tab Baru" di bawah, lalu ketuk Pasang App / menu Chrome (⋮) > Instal aplikasi.'
          : 'Di Chrome Android: ketuk menu browser (⋮) di pojok kanan atas, lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".'
      );
    }
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    setZipStatus(null);
    try {
      const blob = await generateProjectZipBlob();
      triggerBlobDownload(blob, 'kapal-karam-vscode-vercel.zip');
      setZipStatus(
        'File ZIP project berhasil diunduh! Ekstrak, buka di VS Code, lalu jalankan npm install && npm run dev.'
      );
    } catch {
      setZipStatus('Gagal membuat arsip ZIP. Silakan coba ulang.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleCopySnippet = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 1600);
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const detectedLabel = isIOS ? 'iPhone / iPad (iOS)' : isAndroid ? 'Android' : 'Desktop / Mobile';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#1E4764] bg-[#0B1E2E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#163850] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="install-export-title"
              className="font-display text-base font-bold text-slate-100 md:text-lg"
            >
              Pasang di Android &amp; iOS · Link/QR · ZIP
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Instal sebagai aplikasi layar penuh di Android dan iPhone/iPad, scan QR Code, atau jalankan dari VS Code
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela Install dan Download"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#1E4764] bg-[#06131F] text-slate-300 hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#163850] bg-[#071624] px-5 py-2">
          {(
            [
              { id: 'install', label: 'Android & iOS + QR', icon: QrCode },
              { id: 'zip', label: 'Download ZIP (VS Code)', icon: FolderArchive },
              { id: 'vercel', label: 'GitHub & Vercel', icon: Globe },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  active
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:bg-[#0B1E2E] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'install' && (
            <div className="space-y-4">
              {/* Direct PWA Install Banner */}
              <div className="rounded-xl border border-[#1E4764] bg-[#071624] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-100">
                        <Smartphone className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                        <span>Pasang Langsung ke Perangkat</span>
                      </h3>
                      <span className="rounded border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
                        {detectedLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {isInstalled
                        ? 'Aplikasi sudah berjalan dalam mode Standalone (terpasang di layar utama perangkat).'
                        : isInstallable
                          ? 'Browser siap! Ketuk Pasang Sekarang untuk menginstal aplikasi otomatis ke layar utama.'
                          : isIOS
                            ? 'Pada iPhone/iPad: ikuti 3 langkah Add to Home Screen di Safari pada panduan iOS di bawah.'
                            : 'Gunakan tombol di samping atau ikuti panduan Android / iOS di bawah ini.'}
                    </p>
                  </div>

                  {!isInstalled ? (
                    <button
                      type="button"
                      data-testid="modal-direct-install-btn"
                      onClick={handleDirectInstallClick}
                      className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 whitespace-nowrap hover:bg-amber-300"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span>{isInstallable ? 'Pasang Sekarang' : 'Cara Pasang ke HP'}</span>
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-300">
                      Sudah Terpasang
                    </span>
                  )}
                </div>

                {isInIframe && !isInstalled && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                    <span>
                      Anda membuka aplikasi di mode pratinjau (iframe). Untuk menginstal ke Android/iOS, buka dulu di tab penuh.
                    </span>
                    <a
                      href={activeShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-md bg-cyan-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-300"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      <span>Buka Tab Penuh</span>
                    </a>
                  </div>
                )}

                {installNotice && (
                  <p
                    role="status"
                    className="mt-3 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                  >
                    {installNotice}
                  </p>
                )}
              </div>

              {/* Android vs iOS Platform Install Guide */}
              <div className="rounded-xl border border-[#1E4764] bg-[#071624] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-slate-100">
                    Panduan Instalasi Android &amp; iOS
                  </h3>
                  <div className="flex items-center gap-1 rounded-lg border border-[#1E4764] bg-[#06131F] p-1">
                    <button
                      type="button"
                      data-testid="guide-tab-android"
                      onClick={() => setGuidePlatform('android')}
                      className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold ${
                        guidePlatform === 'android'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Android
                    </button>
                    <button
                      type="button"
                      data-testid="guide-tab-ios"
                      onClick={() => setGuidePlatform('ios')}
                      className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold ${
                        guidePlatform === 'ios'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      iOS (iPhone &amp; iPad)
                    </button>
                  </div>
                </div>

                {guidePlatform === 'android' ? (
                  <ol
                    data-testid="guide-panel-android"
                    className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-300"
                  >
                    <li>
                      Buka tautan aplikasi (atau scan QR di bawah) menggunakan <strong className="text-slate-100">Google Chrome / Edge</strong> di HP Android.
                    </li>
                    <li>
                      Ketuk tombol <strong className="text-amber-300">Pasang App</strong> di atas layar, atau ketuk menu <strong className="text-slate-100">⋮</strong> di pojok kanan atas Chrome lalu pilih <strong className="text-slate-100">Instal aplikasi / Tambahkan ke layar utama</strong>.
                    </li>
                    <li>
                      Konfirmasi <strong className="text-slate-100">Instal</strong>. Ikon <strong className="text-cyan-300">KAPAL KARAM</strong> akan terpasang sebagai aplikasi Android penuh dan mendukung <strong className="text-slate-100">Web Bluetooth</strong> langsung.
                    </li>
                  </ol>
                ) : (
                  <ol
                    data-testid="guide-panel-ios"
                    className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-300"
                  >
                    <li>
                      Buka tautan aplikasi (atau scan QR di bawah) menggunakan browser <strong className="text-slate-100">Safari</strong> di iPhone/iPad.{' '}
                      <span className="text-slate-400">
                        (Jika terbuka di in-app browser seperti WhatsApp/IG, ketuk Buka di Safari).
                      </span>
                    </li>
                    <li>
                      Ketuk ikon <strong className="text-amber-300">Share / Bagikan</strong> (kotak dengan panah ke atas ↑) di bilah bawah/atas Safari.
                    </li>
                    <li>
                      Gulir ke bawah lalu ketuk <strong className="text-slate-100">&ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)</strong>, lalu ketuk <strong className="text-slate-100">Tambah (Add)</strong>.
                    </li>
                    <li>
                      Buka ikon <strong className="text-cyan-300">KAPAL KARAM</strong> dari Home Screen iPhone/iPad untuk tampilan layar penuh tanpa bar Safari.{' '}
                      <span className="text-slate-400">
                        (Untuk koneksi Bluetooth BLE real di iOS, gunakan browser <strong className="text-slate-200">Bluefy</strong> dari App Store).
                      </span>
                    </li>
                  </ol>
                )}
              </div>

              {/* QR Code & Link Share */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#1E4764] bg-[#071624] p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-cyan-400/40 bg-white p-2">
                    {qrDataUrl ? (
                      <img
                        data-testid="install-qr-image"
                        src={qrDataUrl}
                        alt={`QR Code untuk membuka ${activeShareUrl}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin text-slate-800" aria-hidden="true" />
                    )}
                  </div>
                  {qrDataUrl && (
                    <button
                      type="button"
                      onClick={handleDownloadQrPng}
                      className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#1E4764] bg-[#0B1E2E] px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-cyan-400/60"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                      <span>Unduh QR PNG</span>
                    </button>
                  )}
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-100">
                      Scan QR Code atau Bagikan Link
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Scan QR dengan kamera Android atau iPhone untuk membuka aplikasi langsung di browser HP dan memasangnya ke layar utama.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="share-url-input"
                      className="block text-[11px] font-semibold text-slate-300"
                    >
                      Link Aktif / Domain Vercel Anda (Opsional ubah untuk update QR)
                    </label>
                    <input
                      id="share-url-input"
                      data-testid="share-url-input"
                      type="text"
                      value={customUrlInput}
                      onChange={(e) => handleSaveShareUrl(e.target.value)}
                      placeholder={defaultOrigin}
                      className="mt-1 w-full rounded-lg border border-[#1E4764] bg-[#06131F] px-3 py-2 font-mono text-xs text-cyan-200 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div
                    data-testid="active-share-url"
                    className="rounded-lg border border-[#163850] bg-[#06131F] px-3 py-2 font-mono text-xs text-cyan-300 break-all"
                  >
                    {activeShareUrl}
                  </div>

                  {usingDevToSharedRedirect && !customUrlInput.trim() && (
                    <p
                      data-testid="dev-to-shared-notice"
                      className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] leading-relaxed text-emerald-200"
                    >
                      Link otomatis memakai alamat publik (<code className="font-mono">ais-pre-...</code>) agar bisa dibuka orang lain. Jika ingin dibuka bebas oleh siapa pun di HP tanpa login, deploy ke Vercel (tab <strong>GitHub &amp; Vercel</strong>) lalu tempel link Vercel Anda di atas.
                    </p>
                  )}

                  {copyErrorNotice && (
                    <p role="status" className="text-[11px] text-amber-300">
                      {copyErrorNotice}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="copy-share-link-btn"
                      onClick={handleCopyLink}
                      className="flex min-h-[42px] items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-4 w-4" aria-hidden="true" />
                          <span>Link Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={activeShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-[#1E4764] bg-[#0B1E2E] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/60"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                      <span>Buka Tab Baru</span>
                    </a>

                    {canNativeShare && (
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-[#1E4764] bg-[#0B1E2E] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/60"
                      >
                        <Share2 className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                        <span>Bagikan</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'zip' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-500/40 bg-[#071624] p-4">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Paket Lengkap Web App PWA (Siap VS Code, GitHub &amp; Vercel)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Berisi seluruh kode sumber React, Vite, konfigurasi PWA Android &amp; iOS, <code className="font-mono text-cyan-300">vercel.json</code>, serta pengaturan VS Code. Siap langsung dijalankan di laptop atau di-push ke GitHub.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="download-fullstack-zip-btn"
                    disabled={downloadingZip}
                    onClick={handleDownloadZip}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {downloadingZip ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FolderArchive className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>
                      {downloadingZip
                        ? 'Mengemas ZIP...'
                        : 'Download Project ZIP (VS Code & Vercel)'}
                    </span>
                  </button>
                </div>

                {zipStatus && (
                  <p className="mt-2.5 text-xs font-medium text-emerald-300" role="status">
                    {zipStatus}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#1E4764] bg-[#071624] p-4">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Cara Running di VS Code &amp; Pasang di Android / iOS
                </h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
                  <li>Ekstrak file <code className="font-mono text-cyan-300">kapal-karam-vscode-vercel.zip</code> lalu buka foldernya di <strong>VS Code</strong>.</li>
                  <li>Buka Terminal VS Code dan jalankan perintah berikut:</li>
                </ol>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#163850] bg-[#06131F] px-3 py-2 font-mono text-xs text-cyan-200">
                  <code>npm install && npm run dev</code>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet('vscode', 'npm install && npm run dev')}
                    className="min-h-[32px] shrink-0 rounded border border-[#1E4764] px-2.5 py-1 text-[11px] font-sans font-semibold text-slate-200 hover:border-cyan-400"
                  >
                    {copiedCmd === 'vscode' ? 'Disalin' : 'Salin'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Untuk memasang di HP Android/iOS melalui HTTPS (wajib agar tombol instal &amp; Bluetooth aktif di jaringan publik), deploy ke Vercel lewat tab <strong className="text-slate-200">GitHub &amp; Vercel</strong>.
                </p>
              </div>
            </div>
          )}

          {tab === 'vercel' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#1E4764] bg-[#071624] p-4">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Publish Online ke Vercel lewat GitHub (Bebas Error)
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  File konfigurasi <code className="font-mono text-cyan-300">vercel.json</code>, PWA Manifest Android &amp; iOS, dan TypeScript build sudah disiapkan agar proses deployment di Vercel langsung berhasil pada percobaan pertama.
                </p>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-amber-300">
                      01. Push Project ke Repository GitHub Anda
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#163850] bg-[#06131F] px-3 py-2 font-mono text-[11px] text-cyan-200">
                      <code className="overflow-x-auto whitespace-pre">
                        git init && git add . && git commit -m &quot;KAPAL KARAM&quot; && git branch -M main
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopySnippet(
                            'git',
                            'git init && git add . && git commit -m "KAPAL KARAM" && git branch -M main'
                          )
                        }
                        className="min-h-[32px] shrink-0 rounded border border-[#1E4764] px-2.5 py-1 font-sans text-[11px] font-semibold text-slate-200 hover:border-cyan-400"
                      >
                        {copiedCmd === 'git' ? 'Disalin' : 'Salin'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-amber-300">
                      02. Import Repository di Vercel
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Login ke <strong>vercel.com</strong> &rarr; <strong>Add New Project</strong> &rarr; pilih repo GitHub Anda. Vercel otomatis membaca <code className="font-mono text-cyan-300">vercel.json</code> (Build Command: <code className="font-mono">npm run build</code>, Output: <code className="font-mono">dist</code>) &rarr; klik <strong>Deploy</strong>.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-amber-300">
                      03. Pasang ke Android &amp; iPhone via HTTPS Vercel
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Buka link <code className="font-mono text-cyan-300">https://nama-app.vercel.app</code> di Chrome Android (ketuk <strong>Pasang App</strong>) atau Safari iPhone/iPad (ketuk <strong>Share &rarr; Tambah ke Layar Utama</strong>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
