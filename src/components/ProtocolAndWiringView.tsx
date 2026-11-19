import React, { useMemo, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import {
  buildBluetoothPayload,
  encodeAccessoriesMask,
  getButtonSignalCatalog,
  type BoatControlCommand,
  type SignalCategory,
  type SignalLogEntry,
} from '../utils/boatControl';

interface ProtocolAndWiringViewProps {
  currentCommand: BoatControlCommand;
  signalLog?: SignalLogEntry[];
  lastSignalAction?: string;
  onApplyCommand?: (patch: Partial<BoatControlCommand>) => void;
  onClearSignalLog?: () => void;
}

type SignalFilter = 'all' | SignalCategory;

const SIGNAL_FILTERS: { id: SignalFilter; label: string }[] = [
  { id: 'all', label: 'Semua (17)' },
  { id: 'dpad', label: 'Arah Motor' },
  { id: 'telegraph', label: 'Tuas Telegraf' },
  { id: 'joystick', label: 'Analog 360°' },
  { id: 'accessory', label: '6 Aksesori' },
];

const CATEGORY_ORDER: SignalCategory[] = ['dpad', 'telegraph', 'joystick', 'accessory'];

const PINOUT_ROWS = [
  { espPin: 'GPIO 25 (PWM)', target: 'L298N ENA', role: 'Kecepatan PWM Motor Baling-Baling (0–255)' },
  { espPin: 'GPIO 26', target: 'L298N IN1', role: 'Arah Putaran Maju (HIGH saat Mode Maju)' },
  { espPin: 'GPIO 27', target: 'L298N IN2', role: 'Arah Putaran Mundur (HIGH saat Mode Mundur)' },
  { espPin: 'GPIO 13 (PWM 50Hz)', target: 'Servo Kemudi (Signal)', role: 'Sudut Rudder 35° (Kiri) – 90° (Lurus) – 145° (Kanan)' },
  { espPin: 'GPIO 16', target: 'Relay / MOSFET CH1', role: 'Aksesori 1: Lampu Navigasi (Bit 0)' },
  { espPin: 'GPIO 17', target: 'Relay / MOSFET CH2', role: 'Aksesori 2: Lampu Sorot (Bit 1)' },
  { espPin: 'GPIO 18', target: 'Relay / Buzzer CH3', role: 'Aksesori 3: Sirine Kapal (Bit 2)' },
  { espPin: 'GPIO 19', target: 'Relay / MOSFET CH4', role: 'Aksesori 4: Beacon Strobe (Bit 3)' },
  { espPin: 'GPIO 21', target: 'Relay / MOSFET CH5', role: 'Aksesori 5: Pompa Air / Bilge (Bit 4)' },
  { espPin: 'GPIO 22', target: 'Relay / Servo CH6', role: 'Aksesori 6: Jangkar Kapal (Bit 5)' },
];

function getCommandPatchForButton(
  id: string,
  current: BoatControlCommand
): Partial<BoatControlCommand> {
  switch (id) {
    case 'dir-forward':
      return { direction: 'F' };
    case 'dir-reverse':
      return { direction: 'R' };
    case 'tel-stop':
      return { throttlePct: 0 };
    case 'tel-slow':
      return { throttlePct: 25 };
    case 'tel-half':
      return { throttlePct: 50 };
    case 'tel-full':
      return { throttlePct: 75 };
    case 'tel-flank':
      return { throttlePct: 100 };
    case 'joy-neutral':
      return { joyAngleDeg: 0, joyMagPct: 0 };
    case 'joy-up':
      return { joyAngleDeg: 0, joyMagPct: 100 };
    case 'joy-right':
      return { joyAngleDeg: 90, joyMagPct: 100 };
    case 'joy-down':
      return { joyAngleDeg: 180, joyMagPct: 100 };
    case 'joy-left':
      return { joyAngleDeg: 270, joyMagPct: 100 };
    case 'aux-nav':
      return {
        accessories: { ...current.accessories, navLights: !current.accessories.navLights },
      };
    case 'aux-spot':
      return {
        accessories: { ...current.accessories, spotlight: !current.accessories.spotlight },
      };
    case 'aux-siren':
      return {
        accessories: { ...current.accessories, siren: !current.accessories.siren },
      };
    case 'aux-beacon':
      return {
        accessories: { ...current.accessories, beacon: !current.accessories.beacon },
      };
    case 'aux-pump':
      return {
        accessories: { ...current.accessories, bilgePump: !current.accessories.bilgePump },
      };
    case 'aux-anchor':
      return {
        accessories: { ...current.accessories, anchor: !current.accessories.anchor },
      };
    case 'aux-all':
      return {
        accessories: {
          navLights: true,
          spotlight: true,
          siren: true,
          beacon: true,
          bilgePump: true,
          anchor: true,
        },
      };
    default:
      return {};
  }
}

export const ProtocolAndWiringView: React.FC<ProtocolAndWiringViewProps> = ({
  currentCommand,
  signalLog = [],
  lastSignalAction = 'Siap (Netral)',
  onApplyCommand,
  onClearSignalLog,
}) => {
  const [filter, setFilter] = useState<SignalFilter>('all');
  const liveFrame = buildBluetoothPayload(currentCommand).trim();
  const auxMask = encodeAccessoriesMask(currentCommand.accessories);

  const signalCatalog = useMemo(
    () => getButtonSignalCatalog(currentCommand),
    [currentCommand]
  );

  const groupedSignals = useMemo(() => {
    const categories = filter === 'all' ? CATEGORY_ORDER : [filter];
    return categories
      .map((cat) => {
        const items = signalCatalog.filter((item) => item.category === cat);
        return {
          category: cat,
          title: items[0]?.categoryLabel ?? cat,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [filter, signalCatalog]);

  return (
    <div className="space-y-6 pb-6">
      {/* Live Payload Format Breakdown */}
      <section className="rounded-xl border border-[#1A3D56] bg-[#0B1E2E]/75 p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-100">
          Format Data &amp; Payload Bluetooth (20Hz)
        </h2>
        <p className="mt-1 text-sm text-slate-300/90">
          Setiap paket dikirimkan dalam format ASCII ringkas berakhiran newline (<code className="font-mono text-cyan-300">\n</code>) lengkap dengan checksum XOR 8-bit agar ESP32 dapat memvalidasi integritas data dan mencegah glitch aktuator.
        </p>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#1E4764] bg-[#06131F]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Contoh Frame Aktif Saat Ini</div>
            <div
              data-testid="protocol-live-frame"
              className="mt-1 font-mono text-base font-bold tabular-nums text-cyan-300 sm:text-lg"
            >
              {liveFrame}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
            <div className="text-[10px] font-medium text-emerald-300/80 uppercase">
              Aksi Tombol Terakhir
            </div>
            <div data-testid="protocol-last-action" className="mt-0.5 font-semibold text-emerald-200">
              {lastSignalAction}
            </div>
          </div>
        </div>

        {/* Live Click Monitor Log */}
        <div
          data-testid="signal-click-log"
          className="mt-4 rounded-lg border border-[#163850] bg-[#06131F]/70 p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-200">
                Riwayat Sinyal Saat Tombol Diklik
              </h3>
              <p className="text-[11px] text-slate-400">
                Otomatis mencatat sinyal yang dikirim tiap kali Anda menekan tombol di Kontrol Kapal atau tombol Tes di bawah.
              </p>
            </div>
            {signalLog.length > 0 && onClearSignalLog && (
              <button
                type="button"
                onClick={onClearSignalLog}
                aria-label="Bersihkan riwayat sinyal"
                className="flex min-h-[32px] shrink-0 items-center gap-1 rounded-md border border-[#1E4764] bg-[#071624] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400/60 hover:text-white"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                <span>Bersihkan</span>
              </button>
            )}
          </div>

          {signalLog.length === 0 ? (
            <p className="mt-2.5 rounded border border-dashed border-[#1E4764] bg-[#04101B]/60 px-3 py-2 text-xs text-slate-400">
              Belum ada tombol yang diklik pada sesi ini. Klik salah satu tombol kontrol (Maju, Mundur, Telegraf, Analog, atau Aksesori) untuk melihat sinyal real-time yang dikirim.
            </p>
          ) : (
            <div className="mt-2.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {signalLog.map((entry) => (
                <div
                  key={entry.id}
                  data-testid="signal-log-entry"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#163850] bg-[#04101B]/85 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{entry.timeLabel}</span>
                    <span className="font-semibold text-emerald-300">{entry.actionLabel}</span>
                    <code className="rounded bg-[#071624] px-1.5 py-0.5 font-mono text-[11px] text-cyan-300">
                      {entry.frame}
                    </code>
                  </div>
                  <span className="font-mono text-[11px] text-amber-300/90">
                    {entry.pinSummary}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#163850] text-xs text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Field</th>
                <th className="py-2.5 pr-4 font-semibold">Tipe / Rentang</th>
                <th className="py-2.5 pr-4 font-semibold">Nilai Saat Ini</th>
                <th className="py-2.5 font-semibold">Fungsi pada ESP32</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#163850]/80 text-xs text-slate-300">
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">$CMD</td>
                <td className="py-2.5 pr-4">Header</td>
                <td className="py-2.5 pr-4 font-mono">CMD</td>
                <td className="py-2.5">Penanda awal frame perintah valid.</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">throttlePct</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">0 – 100</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums text-amber-300">
                  {currentCommand.throttlePct}
                </td>
                <td className="py-2.5">Duty cycle PWM pin ENA L298N (dipetakan ke 0–255).</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">dir</td>
                <td className="py-2.5 pr-4 font-mono">F | R</td>
                <td className="py-2.5 pr-4 font-mono text-amber-300">{currentCommand.direction}</td>
                <td className="py-2.5">F = Maju (IN1 HIGH, IN2 LOW) · R = Mundur (IN1 LOW, IN2 HIGH).</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">joyAngleDeg</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">0 – 359</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums text-amber-300">
                  {currentCommand.joyAngleDeg}°
                </td>
                <td className="py-2.5">Sudut arah absolut POV operator (0° Menjauh, 90° Kanan, 180° Menghadap, 270° Kiri).</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">joyMagPct</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">0 – 100</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums text-amber-300">
                  {currentCommand.joyMagPct}%
                </td>
                <td className="py-2.5">Kekuatan tarikan analog (0 = netral/deadzone, rudder kembali 90°).</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">auxMask</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">0 – 15 (4-bit)</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums text-amber-300">
                  {auxMask} (0b{auxMask.toString(2).padStart(4, '0')})
                </td>
                <td className="py-2.5">Bitmask aksesori: Bit 0 Nav, Bit 1 Sorot, Bit 2 Sirine, Bit 3 Beacon.</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-cyan-300">*CRC</td>
                <td className="py-2.5 pr-4 font-mono">Hex 2-digit</td>
                <td className="py-2.5 pr-4 font-mono text-emerald-400">
                  {liveFrame.split('*')[1]}
                </td>
                <td className="py-2.5">XOR dari seluruh karakter antara <code className="font-mono">$</code> dan <code className="font-mono">*</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-Button Signal Data Reference */}
      <section
        data-testid="button-signal-reference"
        className="rounded-xl border border-[#1A3D56] bg-[#0B1E2E]/75 p-4 sm:p-6"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-100">
              Sinyal Data Setiap Tombol &amp; Kontrol
            </h2>
            <p className="mt-1 text-sm text-slate-300/90">
              Klik tombol <strong className="text-cyan-300">Klik / Tes</strong> di tiap baris untuk melihat langsung sinyal <code className="font-mono text-cyan-300">$CMD</code> dan pin ESP32 yang dikirim saat tombol ditekan.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter kategori tombol"
            className="flex shrink-0 flex-wrap gap-1.5"
          >
            {SIGNAL_FILTERS.map((tab) => {
              const selected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                      : 'border-[#1E4764] bg-[#06131F]/80 text-slate-300 hover:border-cyan-400/60 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {groupedSignals.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="font-display text-sm font-bold tracking-wide text-amber-300">
                {group.title}
              </h3>

              <div className="overflow-x-auto rounded-lg border border-[#163850] bg-[#06131F]/70">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#163850] bg-[#071624]/80 text-slate-400">
                      <th className="px-3 py-2.5 font-semibold">Tombol / Kontrol</th>
                      <th className="px-3 py-2.5 font-semibold">Parameter Diubah</th>
                      <th className="px-3 py-2.5 font-semibold">Paket Data Dikirim</th>
                      <th className="px-3 py-2.5 font-semibold">Sinyal Pin / Aksi ESP32</th>
                      {onApplyCommand && (
                        <th className="px-3 py-2.5 text-right font-semibold">Uji Klik</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#163850]/80 text-slate-200">
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        data-testid={`signal-row-${item.id}`}
                        className={item.isActive ? 'bg-cyan-500/10' : undefined}
                      >
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{item.buttonName}</span>
                            {item.isActive && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                                AKTIF
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-amber-300 whitespace-nowrap">
                          {item.changedField}
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="rounded border border-[#1E4764] bg-[#04101B] px-2 py-0.5 font-mono text-cyan-300 whitespace-nowrap">
                            {item.sampleFrame}
                          </code>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {item.hardwareSignal}
                        </td>
                        {onApplyCommand && (
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              data-testid={`test-signal-btn-${item.id}`}
                              onClick={() =>
                                onApplyCommand(getCommandPatchForButton(item.id, currentCommand))
                              }
                              aria-label={`Klik dan kirim sinyal ${item.buttonName}`}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-cyan-400/50 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-cyan-400"
                            >
                              <Play className="h-3 w-3" aria-hidden="true" />
                              <span>Klik / Tes</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hardware Pinout & Power Architecture */}
      <section className="rounded-xl border border-[#1A3D56] bg-[#0B1E2E]/75 p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-100">
          Arsitektur Daya 12V &amp; Pemetaan Pin ESP32 Wroom
        </h2>
        <p className="mt-1 text-sm text-slate-300/90">
          Gunakan regulator Step-Down Buck Converter 5V (minimal 3A) dari baterai 12V untuk menyuplai ESP32 (pin VIN/5V) dan Servo Kemudi agar arus lonjakan motor DC tidak menyebabkan brownout pada ESP32. Pastikan semua jalur GND terhubung menjadi satu (Common Ground).
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#163850] text-xs text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Pin ESP32 Wroom</th>
                <th className="py-2.5 pr-4 font-semibold">Koneksi Modul</th>
                <th className="py-2.5 font-semibold">Keterangan Fungsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#163850]/80 text-xs text-slate-300">
              {PINOUT_ROWS.map((row) => (
                <tr key={row.espPin}>
                  <td className="py-2.5 pr-4 font-mono font-semibold text-amber-300">{row.espPin}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-100">{row.target}</td>
                  <td className="py-2.5 text-slate-300">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

