import React, { useState } from 'react';
import {
  AlertCircle,
  Bluetooth,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Smartphone,
  Star,
  Trash2,
  Usb,
  X,
} from 'lucide-react';
import { copyTextToClipboard, resolveShareableUrl } from '../utils/appPreferences';
import { sortBluetoothDevices, type BluetoothDeviceItem } from '../utils/boatControl';

export interface BluetoothScanNotice {
  tone: 'info' | 'warn' | 'error';
  text: string;
}

interface BluetoothScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: BluetoothDeviceItem[];
  isScanning: boolean;
  hasScanned: boolean;
  scanNotice: BluetoothScanNotice | null;
  connectedDeviceId: string | null;
  bluetoothSupported: boolean;
  serialSupported: boolean;
  serialConnected: boolean;
  isIOS: boolean;
  isInIframe: boolean;
  onStartScan: () => void;
  onClearDevices: () => void;
  onToggleFavorite: (address: string) => void;
  onConnect: (device: BluetoothDeviceItem) => void;
  onDisconnect: () => void;
  onConnectWebSerial?: () => void;
}

export const BluetoothScannerModal: React.FC<BluetoothScannerModalProps> = ({
  isOpen,
  onClose,
  devices,
  isScanning,
  hasScanned,
  scanNotice,
  connectedDeviceId,
  bluetoothSupported,
  serialSupported,
  serialConnected,
  isIOS,
  isInIframe,
  onStartScan,
  onClearDevices,
  onToggleFavorite,
  onConnect,
  onDisconnect,
  onConnectWebSerial,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const sortedDevices = sortBluetoothDevices(devices);
  const currentHref =
    typeof window !== 'undefined' ? resolveShareableUrl(window.location.href) : '/';
  const bluefyDeepLink = `bluefy://open?url=${encodeURIComponent(currentHref)}`;

  const handleCopyUrl = async () => {
    const ok = await copyTextToClipboard(currentHref);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } else {
      setCopiedUrl(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-scanner-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-[#1E4764] bg-[#0B1E2E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#163850] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="bt-scanner-title" className="font-display text-base font-bold text-slate-100 sm:text-lg">
              Pemindai Perangkat Bluetooth Real
            </h2>
            <p className="mt-0.5 text-xs text-slate-300/80">
              Hanya menampilkan perangkat Bluetooth &amp; Serial asli yang terdeteksi · Tag Favorit dipin di atas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pemindai Bluetooth"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#1E4764] bg-[#06131F] text-slate-300 hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#163850] bg-[#071624] px-5 py-3 sm:px-6">
          <div className="text-xs text-slate-300" data-testid="bt-scan-summary">
            {isScanning
              ? 'Membuka pemindai Bluetooth sistem untuk mendeteksi perangkat real...'
              : sortedDevices.length > 0
                ? `${sortedDevices.length} perangkat real terdeteksi · Favorit dipin di atas`
                : hasScanned
                  ? '0 perangkat real terdeteksi di daftar saat ini'
                  : 'Daftar bersih (belum ada perangkat terdeteksi)'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sortedDevices.length > 0 && (
              <button
                type="button"
                data-testid="clear-bt-list-btn"
                onClick={onClearDevices}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#1E4764] bg-[#06131F] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-red-400/60 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Bersihkan</span>
              </button>
            )}

            {serialSupported && onConnectWebSerial && (
              <button
                type="button"
                data-testid="scan-web-serial-btn"
                onClick={onConnectWebSerial}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#1E4764] bg-[#06131F] px-3.5 py-2 text-xs font-semibold text-slate-200 whitespace-nowrap hover:border-cyan-400/60 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <Usb className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                <span>{serialConnected ? 'USB/SPP Terhubung' : 'Bridge COM/USB'}</span>
              </button>
            )}

            <button
              type="button"
              data-testid="modal-scan-bt-btn"
              onClick={onStartScan}
              disabled={isScanning}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 whitespace-nowrap transition-colors hover:bg-cyan-300 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Bluetooth className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isScanning ? 'Memindai...' : 'Scan Bluetooth'}</span>
            </button>
          </div>
        </div>

        {/* Scan Notice / Error Banner */}
        {scanNotice && (
          <div
            role="status"
            data-testid="bt-scan-notice"
            className={`mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:mx-6 ${
              scanNotice.tone === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : scanNotice.tone === 'warn'
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                  : 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
            }`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{scanNotice.text}</span>
            </div>
            {isInIframe && (
              <a
                href={currentHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-md border border-current/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span>Buka Tab Baru</span>
              </a>
            )}
          </div>
        )}

        {/* iOS Active WebBLE Mode Indicator */}
        {isIOS && bluetoothSupported && (
          <div
            data-testid="ios-webble-ready-banner"
            className="mx-5 mt-3 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-200 sm:mx-6"
          >
            Mode iOS WebBLE Aktif · Menggunakan fallback filter ESP32 &amp; transmisi 20-byte MTU aman untuk iPhone/iPad.
          </div>
        )}

        {/* Device List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {sortedDevices.length === 0 ? (
            <div
              data-testid="bt-empty-state"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1E4764] bg-[#06131F] px-5 py-8 text-center"
            >
              <Bluetooth className="h-9 w-9 text-cyan-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-100">
                Belum ada perangkat Bluetooth real yang terdeteksi
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                Daftar perangkat dibersihkan dari awal (tanpa data contoh/palsu). Tekan{' '}
                <strong className="text-slate-200">Scan Bluetooth</strong> untuk memilih modul ESP32
                atau perangkat Bluetooth fisik yang aktif di sekitar Anda
                {serialSupported ? ', atau gunakan Bridge COM/USB untuk port Bluetooth Classic SPP' : ''}.
              </p>

              {/* Dedicated iOS Bluetooth Helper when Web Bluetooth is absent in iOS Safari/WKWebView */}
              {isIOS && !bluetoothSupported && (
                <div
                  data-testid="ios-bluetooth-guide"
                  className="mt-4 w-full max-w-md rounded-xl border border-amber-400/40 bg-[#0B1E2E] p-3.5 text-left"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Solusi Scan Bluetooth di iPhone / iPad (iOS)</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Safari &amp; Chrome bawaan iOS tidak membuka API Bluetooth ke web. Agar scan Bluetooth ESP32 berjalan lancar di iOS tanpa masalah, buka aplikasi ini lewat browser <strong className="text-slate-100">Bluefy</strong> (gratis di App Store):
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={bluefyDeepLink}
                      data-testid="ios-open-bluefy-link"
                      className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka di Bluefy</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#1E4764] bg-[#06131F] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                          <span>Link Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-[#1E4764] bg-[#06131F] px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:border-cyan-400"
                    >
                      <span>App Store (Bluefy)</span>
                    </a>
                  </div>
                </div>
              )}

              {!isIOS && !bluetoothSupported && (
                <p className="mt-3 max-w-md rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Browser ini belum mendukung Web Bluetooth API. Gunakan Google Chrome / Microsoft Edge pada Android atau Desktop.
                </p>
              )}

              {isInIframe && (
                <a
                  href={currentHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-[#0B1E2E] px-3.5 py-1.5 text-xs font-semibold text-cyan-300 hover:border-cyan-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buka Aplikasi di Tab Penuh agar Scan Bluetooth Aktif</span>
                </a>
              )}
            </div>
          ) : (
            <ul
              data-testid="bt-device-list"
              className="divide-y divide-[#163850] rounded-xl border border-[#1A3D56] bg-[#06131F]"
            >
              {sortedDevices.map((dev) => {
                const isCurrent = connectedDeviceId === dev.id;
                return (
                  <li
                    key={dev.id}
                    data-testid={`bt-device-row-${dev.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(dev.address)}
                        aria-label={
                          dev.isFavorite
                            ? `Hapus Tag Favorit dari ${dev.name}`
                            : `Tandai ${dev.name} sebagai Tag Favorit`
                        }
                        aria-pressed={dev.isFavorite}
                        className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          dev.isFavorite
                            ? 'border-amber-400/60 bg-amber-500/15 text-amber-400'
                            : 'border-[#1E4764] bg-[#0B1E2E] text-slate-400 hover:border-amber-400/50 hover:text-slate-200'
                        }`}
                      >
                        <Star
                          className={`h-5 w-5 ${dev.isFavorite ? 'fill-amber-400' : ''}`}
                          aria-hidden="true"
                        />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-100">
                            {dev.name}
                          </span>
                          {dev.isFavorite && (
                            <span className="text-xs font-medium text-amber-400">
                              · Favorit
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400 tabular-nums">
                          <span>{dev.address}</span>
                          <span aria-hidden="true">·</span>
                          <span>{dev.deviceType}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {typeof dev.rssi === 'number'
                              ? `${dev.rssi} dBm`
                              : dev.source === 'web-serial'
                                ? 'Serial Port Real'
                                : 'BLE Real'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => (isCurrent ? onDisconnect() : onConnect(dev))}
                      className={`min-h-[44px] shrink-0 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        isCurrent
                          ? 'border border-red-500/60 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                          : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                      }`}
                    >
                      {isCurrent ? 'Putuskan' : 'Hubungkan'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
