import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  Download,
  ImagePlus,
  Maximize2,
  Minimize2,
  QrCode,
  Unplug,
} from 'lucide-react';
import { AccessoryPanel } from './components/AccessoryPanel';
import { BluetoothScannerModal } from './components/BluetoothScannerModal';
import { BoatBasinCanvas } from './components/BoatBasinCanvas';
import { DirectionDPad } from './components/DirectionDPad';
import { HeadlessJoystick } from './components/HeadlessJoystick';
import { InstallAndExportModal } from './components/InstallAndExportModal';
import { IntroSplashScreen } from './components/IntroSplashScreen';
import { ProtocolAndWiringView } from './components/ProtocolAndWiringView';
import { TelegraphLever } from './components/TelegraphLever';
import { WallpaperModal } from './components/WallpaperModal';
import {
  inferBluetoothDeviceType,
  loadFavoriteAddresses,
  saveFavoriteAddresses,
  upsertRealBluetoothDevice,
} from './data/bluetoothDevices';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import {
  findWritableGattCharacteristic,
  formatSerialPortLabel,
  getWebBluetoothNavigator,
  getWebSerialNavigator,
  isWebBluetoothSupported,
  isWebSerialSupported,
  requestBluetoothDeviceResilient,
  writeBlePayload,
  type WebBluetoothCharacteristicLike,
  type WebBluetoothDeviceLike,
  type WebSerialPortLike,
} from './utils/bluetoothBridge';
import {
  clearWallpaperConfig,
  loadWallpaperConfig,
  MARITIME_PRESETS,
  saveWallpaperConfig,
  type WallpaperConfig,
} from './utils/appPreferences';
import {
  appendSignalLogEntry,
  buildBluetoothPayload,
  describeControlChange,
  type AccessoryState,
  type BluetoothDeviceItem,
  type BoatControlCommand,
  type DriveDirection,
  type SignalLogEntry,
} from './utils/boatControl';
import type { BluetoothScanNotice } from './components/BluetoothScannerModal';

type WorkspaceTab = 'remote' | 'protocol';

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('autostart') !== '1';
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('remote');
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Real Bluetooth & Web Serial Scanner State (Starts Clean — Zero Fake Devices)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanNotice, setScanNotice] = useState<BluetoothScanNotice | null>(null);
  const [favoriteAddresses, setFavoriteAddresses] = useState<string[]>(() =>
    loadFavoriteAddresses()
  );
  const [discoveredCatalog, setDiscoveredCatalog] = useState<
    Omit<BluetoothDeviceItem, 'isFavorite'>[]
  >([]);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDeviceItem | null>(null);

  // Hardware Refs (Web Bluetooth GATT + Web Serial SPP)
  const bleDevicesRef = useRef<Map<string, WebBluetoothDeviceLike>>(new Map());
  const bleCharacteristicRef = useRef<WebBluetoothCharacteristicLike | null>(null);
  const bleWritingRef = useRef<boolean>(false);
  const pendingBlePayloadRef = useRef<Uint8Array | null>(null);
  const lastTransmittedPayloadRef = useRef<string | null>(null);
  const serialPortsRef = useRef<Map<string, WebSerialPortLike>>(new Map());
  const [serialPort, setSerialPort] = useState<WebSerialPortLike | null>(null);
  const serialWriterRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  const bluetoothSupported = isWebBluetoothSupported();
  const serialSupported = isWebSerialSupported();

  // Custom Wallpaper / Maritime Theme & PWA Install Modal State
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState<WallpaperConfig>(() => loadWallpaperConfig());
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();

  // Remote Control State
  const [throttlePct, setThrottlePct] = useState<number>(0);
  const [direction, setDirection] = useState<DriveDirection>('F');
  const [joystick, setJoystick] = useState<{ angleDeg: number; magPct: number }>({
    angleDeg: 0,
    magPct: 0,
  });
  const [accessories, setAccessories] = useState<AccessoryState>({
    navLights: false,
    spotlight: false,
    siren: false,
    beacon: false,
    bilgePump: false,
    anchor: false,
  });
  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>([]);
  const [lastSignalAction, setLastSignalAction] = useState<string>('Siap (Netral)');
  const prevCommandRef = useRef<BoatControlCommand | null>(null);

  // Sync browser Fullscreen API exits (e.g. pressing Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    if (!isFullscreenMode) {
      setActiveTab('remote');
      setIsFullscreenMode(true);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fallback: immersive full-viewport controller mode still stays active
      }
    } else {
      setIsFullscreenMode(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore if native fullscreen was not active
      }
    }
  };

  const handleDirectInstall = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setInstallModalOpen(true);
  };

  const currentCommand: BoatControlCommand = useMemo(
    () => ({
      throttlePct,
      direction,
      joyAngleDeg: joystick.angleDeg,
      joyMagPct: joystick.magPct,
      accessories,
    }),
    [throttlePct, direction, joystick.angleDeg, joystick.magPct, accessories]
  );

  const livePayload = useMemo(
    () => buildBluetoothPayload(currentCommand).trim(),
    [currentCommand]
  );

  // Record every button/control change into the live signal monitor log
  useEffect(() => {
    const prev = prevCommandRef.current;
    prevCommandRef.current = currentCommand;
    if (!prev) return;

    const { actionLabel, pinSummary } = describeControlChange(prev, currentCommand);
    setLastSignalAction(actionLabel);
    const now = new Date();
    const timeLabel = now.toTimeString().slice(0, 8);
    const entry: SignalLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timeLabel,
      actionLabel,
      frame: livePayload,
      pinSummary,
    };
    setSignalLog((old) => appendSignalLogEntry(old, entry, 10));
  }, [currentCommand, livePayload]);

  const handleApplyProtocolCommand = useCallback(
    (patch: Partial<BoatControlCommand>) => {
      if (typeof patch.throttlePct === 'number') {
        setThrottlePct(patch.throttlePct);
      }
      if (patch.direction === 'F' || patch.direction === 'R') {
        setDirection(patch.direction);
      }
      if (
        typeof patch.joyAngleDeg === 'number' ||
        typeof patch.joyMagPct === 'number'
      ) {
        setJoystick((prev) => ({
          angleDeg: patch.joyAngleDeg ?? prev.angleDeg,
          magPct: patch.joyMagPct ?? prev.magPct,
        }));
      }
      if (patch.accessories) {
        setAccessories(patch.accessories);
      }
    },
    []
  );

  const devicesWithFavorites: BluetoothDeviceItem[] = useMemo(() => {
    return discoveredCatalog.map((d) => ({
      ...d,
      isFavorite: favoriteAddresses.includes(d.address),
    }));
  }, [discoveredCatalog, favoriteAddresses]);

  const handleDisconnect = useCallback(async () => {
    bleCharacteristicRef.current = null;
    bleWritingRef.current = false;

    if (connectedDevice?.source === 'web-bluetooth') {
      const bleDev = bleDevicesRef.current.get(connectedDevice.id);
      if (bleDev?.gatt?.connected) {
        try {
          bleDev.gatt.disconnect();
        } catch {
          // Ignore GATT disconnect error
        }
      }
    }

    setConnectedDevice(null);
    setThrottlePct(0);
    setJoystick({ angleDeg: 0, magPct: 0 });
    if (serialWriterRef.current) {
      try {
        await serialWriterRef.current.close();
      } catch {
        // Ignore stream close errors
      }
      serialWriterRef.current = null;
    }
    if (serialPort) {
      try {
        await serialPort.close();
      } catch {
        // Ignore port close errors
      }
      setSerialPort(null);
    }
  }, [connectedDevice, serialPort]);

  const refreshPermittedRealDevices = useCallback(async () => {
    const navBt = getWebBluetoothNavigator();
    if (navBt && typeof navBt.getDevices === 'function') {
      try {
        const permitted = await navBt.getDevices();
        for (const btDev of permitted) {
          const devId = String(btDev.id || btDev.name || 'ble-device');
          bleDevicesRef.current.set(devId, btDev);
          const item: Omit<BluetoothDeviceItem, 'isFavorite'> = {
            id: devId,
            name: btDev.name?.trim() || 'Perangkat Bluetooth Tanpa Nama',
            address: devId,
            rssi: null,
            deviceType: inferBluetoothDeviceType(btDev.name, 'web-bluetooth'),
            source: 'web-bluetooth',
          };
          setDiscoveredCatalog((prev) => upsertRealBluetoothDevice(prev, item));
        }
      } catch {
        // Browser may restrict getDevices until user grants permission
      }
    }

    const navSerial = getWebSerialNavigator();
    if (navSerial && typeof navSerial.getPorts === 'function') {
      try {
        const ports = await navSerial.getPorts();
        ports.forEach((port, idx) => {
          const meta = formatSerialPortLabel(port, idx);
          serialPortsRef.current.set(meta.id, port);
          const item: Omit<BluetoothDeviceItem, 'isFavorite'> = {
            id: meta.id,
            name: meta.name,
            address: meta.address,
            rssi: null,
            deviceType: 'USB-Serial',
            source: 'web-serial',
          };
          setDiscoveredCatalog((prev) => upsertRealBluetoothDevice(prev, item));
        });
      } catch {
        // Ignore serial getPorts restriction
      }
    }
  }, []);

  useEffect(() => {
    void refreshPermittedRealDevices();
  }, [refreshPermittedRealDevices]);

  const connectRealBleDevice = useCallback(
    async (btDevice: WebBluetoothDeviceLike, item: Omit<BluetoothDeviceItem, 'isFavorite'>) => {
      await handleDisconnect();
      try {
        if (btDevice.gatt) {
          const server = await btDevice.gatt.connect();
          bleCharacteristicRef.current = await findWritableGattCharacteristic(server);
          const onDisconnected = () => {
            bleCharacteristicRef.current = null;
            setConnectedDevice((curr) => (curr?.id === item.id ? null : curr));
            setScanNotice({
              tone: 'warn',
              text: `Koneksi Bluetooth ke ${item.name} terputus.`,
            });
          };
          if (typeof btDevice.removeEventListener === 'function') {
            btDevice.removeEventListener('gattserverdisconnected', onDisconnected);
          }
          if (typeof btDevice.addEventListener === 'function') {
            btDevice.addEventListener('gattserverdisconnected', onDisconnected);
          }
        }

        const isFav = favoriteAddresses.includes(item.address);
        setConnectedDevice({ ...item, isFavorite: isFav });
        setScanNotice(null);
        setScannerOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Koneksi GATT gagal.';
        setScanNotice({
          tone: 'error',
          text: `Terdeteksi ${item.name}, namun gagal tersambung: ${message}`,
        });
      }
    },
    [favoriteAddresses, handleDisconnect]
  );

  const handleOpenScanner = () => {
    setScannerOpen(true);
    void refreshPermittedRealDevices();
  };

  const handleStartScan = useCallback(async () => {
    setScanNotice(null);
    const navBt = getWebBluetoothNavigator();
    if (!navBt) {
      setHasScanned(true);
      setScanNotice({
        tone: 'warn',
        text: isIOS
          ? 'Safari iOS tidak mendukung Web Bluetooth bawaan. Gunakan browser Bluefy (App Store) di iOS, atau Google Chrome di Android/Desktop.'
          : isInIframe
            ? 'Akses Web Bluetooth tidak tersedia di mode pratinjau tersemat. Buka aplikasi di Tab Baru.'
            : 'Browser ini belum mendukung Web Bluetooth API. Gunakan Google Chrome atau Microsoft Edge.',
      });
      return;
    }

    setIsScanning(true);
    try {
      const btDevice = await requestBluetoothDeviceResilient(navBt);
      const devId = String(btDevice.id || btDevice.name || `ble-${Date.now()}`);

      bleDevicesRef.current.set(devId, btDevice);
      const realItem: Omit<BluetoothDeviceItem, 'isFavorite'> = {
        id: devId,
        name: btDevice.name?.trim() || 'Perangkat Bluetooth Tanpa Nama',
        address: devId,
        rssi: null,
        deviceType: inferBluetoothDeviceType(btDevice.name, 'web-bluetooth'),
        source: 'web-bluetooth',
      };

      setDiscoveredCatalog((prev) => upsertRealBluetoothDevice(prev, realItem));
      setHasScanned(true);
      await connectRealBleDevice(btDevice, realItem);
    } catch (err) {
      setHasScanned(true);
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotFoundError' || errName === 'AbortError') {
        setScanNotice({
          tone: 'info',
          text: 'Pemindaian dibatalkan atau belum ada perangkat fisik yang dipilih.',
        });
      } else if (errName === 'SecurityError' || errName === 'NotAllowedError') {
        setScanNotice({
          tone: 'warn',
          text: isInIframe
            ? 'Pemindaian Bluetooth diblokir oleh kebijakan iframe pratinjau. Klik "Buka Tab Baru" atau pasang aplikasi agar pemindaian Bluetooth real aktif.'
            : 'Izin Bluetooth ditolak. Pastikan Bluetooth HP/Laptop aktif dan izinkan akses browser.',
        });
      } else {
        setScanNotice({
          tone: 'error',
          text:
            err instanceof Error
              ? `Gagal memindai Bluetooth: ${err.message}`
              : 'Gagal memindai perangkat Bluetooth.',
        });
      }
    } finally {
      setIsScanning(false);
    }
  }, [connectRealBleDevice, isIOS, isInIframe]);

  const handleClearDevices = () => {
    setScanNotice(null);
    setHasScanned(false);
    if (connectedDevice) {
      const { isFavorite: _ignored, ...rest } = connectedDevice;
      setDiscoveredCatalog([rest]);
    } else {
      setDiscoveredCatalog([]);
    }
  };

  const handleToggleFavorite = (address: string) => {
    setFavoriteAddresses((prev) => {
      const next = prev.includes(address)
        ? prev.filter((item) => item !== address)
        : [...prev, address];
      saveFavoriteAddresses(next);
      return next;
    });
  };

  const handleConnectWebSerial = async () => {
    const navSerial = getWebSerialNavigator();
    if (!navSerial) return;
    setScanNotice(null);
    try {
      const port = await navSerial.requestPort();
      await port.open({ baudRate: 115200 });
      if (port.writable) {
        serialWriterRef.current = port.writable.getWriter();
      }
      const meta = formatSerialPortLabel(port, serialPortsRef.current.size);
      serialPortsRef.current.set(meta.id, port);

      const realSerialItem: Omit<BluetoothDeviceItem, 'isFavorite'> = {
        id: meta.id,
        name: meta.name,
        address: meta.address,
        rssi: null,
        deviceType: 'USB-Serial',
        source: 'web-serial',
      };
      setDiscoveredCatalog((prev) => upsertRealBluetoothDevice(prev, realSerialItem));
      setSerialPort(port);
      setConnectedDevice({
        ...realSerialItem,
        isFavorite: favoriteAddresses.includes(realSerialItem.address),
      });
      setScannerOpen(false);
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      if (errName !== 'NotFoundError' && errName !== 'AbortError') {
        setScanNotice({
          tone: 'error',
          text:
            err instanceof Error
              ? `Gagal membuka port Serial/SPP: ${err.message}`
              : 'Gagal membuka port Serial/SPP.',
        });
      }
    }
  };

  const handleConnectDevice = async (device: BluetoothDeviceItem) => {
    if (device.source === 'web-serial') {
      const existingPort = serialPortsRef.current.get(device.id);
      if (existingPort) {
        try {
          await handleDisconnect();
          await existingPort.open({ baudRate: 115200 });
          if (existingPort.writable) {
            serialWriterRef.current = existingPort.writable.getWriter();
          }
          setSerialPort(existingPort);
          setConnectedDevice(device);
          setScanNotice(null);
          setScannerOpen(false);
          return;
        } catch {
          // Port may need re-selection via picker
        }
      }
      await handleConnectWebSerial();
      return;
    }

    const bleDev = bleDevicesRef.current.get(device.id);
    if (bleDev) {
      await connectRealBleDevice(bleDev, device);
      return;
    }
    await handleStartScan();
  };

  // Transmit packet to Web Serial / Web Bluetooth ONLY when a control parameter changes
  useEffect(() => {
    if (!connectedDevice) {
      lastTransmittedPayloadRef.current = null;
      pendingBlePayloadRef.current = null;
      return;
    }
    if (!serialWriterRef.current && !bleCharacteristicRef.current) return;
    if (lastTransmittedPayloadRef.current === livePayload) return;

    lastTransmittedPayloadRef.current = livePayload;
    const packetBytes = new TextEncoder().encode(`${livePayload}\n`);

    const writer = serialWriterRef.current;
    if (writer) {
      writer.write(packetBytes).catch(() => {});
      return;
    }

    const bleChar = bleCharacteristicRef.current;
    if (!bleChar) return;

    const flushBle = (bytes: Uint8Array) => {
      bleWritingRef.current = true;
      writeBlePayload(bleChar, bytes)
        .catch(() => {})
        .finally(() => {
          bleWritingRef.current = false;
          const queued = pendingBlePayloadRef.current;
          if (queued) {
            pendingBlePayloadRef.current = null;
            flushBle(queued);
          }
        });
    };

    if (bleWritingRef.current) {
      pendingBlePayloadRef.current = packetBytes;
    } else {
      flushBle(packetBytes);
    }
  }, [connectedDevice, livePayload]);

  const handleToggleAccessory = (key: keyof AccessoryState) => {
    setAccessories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleUpdateWallpaper = (next: WallpaperConfig) => {
    setWallpaper(next);
    saveWallpaperConfig(next);
  };

  const handleResetWallpaper = () => {
    setWallpaper(clearWallpaperConfig());
  };

  const activePreset = useMemo(
    () => MARITIME_PRESETS.find((p) => p.id === wallpaper.themeId) ?? MARITIME_PRESETS[0],
    [wallpaper.themeId]
  );

  const hasCustomImage =
    wallpaper.themeId === 'custom' && typeof wallpaper.customImageDataUrl === 'string';
  const hasPresetImage = !hasCustomImage && typeof activePreset.imageUrl === 'string';

  const isConnected = connectedDevice !== null;
  const anyModalOpen = showIntro || scannerOpen || wallpaperOpen || installModalOpen;

  return (
    <div
      data-testid="app-shell"
      data-theme-mode={wallpaper.themeId}
      data-fullscreen={isFullscreenMode ? 'true' : 'false'}
      className={
        activeTab === 'remote'
          ? 'relative flex h-[100dvh] flex-col overflow-hidden bg-[#06131F] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-slate-100'
          : 'relative min-h-screen bg-[#06131F] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-slate-100'
      }
    >
      {showIntro && <IntroSplashScreen onEnter={() => setShowIntro(false)} />}

      {/* Full-bleed Maritime Theme or Custom User Wallpaper Background Layer */}
      <div
        aria-hidden="true"
        data-testid="app-wallpaper-layer"
        className={`pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat ${
          hasPresetImage ? 'bg-contain' : 'bg-cover'
        }`}
        style={
          hasCustomImage
            ? { backgroundImage: `url(${wallpaper.customImageDataUrl})` }
            : hasPresetImage
              ? {
                  backgroundColor: activePreset.previewBg,
                  backgroundImage: `url(${activePreset.imageUrl})`,
                }
              : { background: activePreset.previewBg }
        }
      />

      {/* Contrast Scrim & Subtle Sonar Grid Pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundColor:
            hasCustomImage || hasPresetImage
              ? `rgba(6, 19, 31, ${wallpaper.scrimOpacity})`
              : 'rgba(6, 19, 31, 0.22)',
          backgroundImage:
            wallpaper.themeId === 'sonar-grid'
              ? 'radial-gradient(rgba(34, 211, 238, 0.12) 1px, transparent 1px)'
              : undefined,
          backgroundSize: wallpaper.themeId === 'sonar-grid' ? '28px 28px' : undefined,
        }}
      />

      {/* Top Bar Contract: Hidden in Controller Fullscreen Mode */}
      {!isFullscreenMode && (
        <header className="relative z-10 shrink-0 border-b border-[#163850]/80 bg-[#071624]/65">
          <div className="mx-auto flex w-full items-center justify-between gap-4 px-3 py-2 md:gap-8 md:px-5 md:py-2.5 short:py-1.5">
            {/* Zone 1: Single-element brand wordmark + uploaded logo */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('remote');
              }}
              className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 md:text-lg"
            >
              <img
                src="/assets/aistudio/image_0af4d8d3.png"
                alt=""
                aria-hidden="true"
                className="h-7 w-7 rounded-md bg-white object-contain p-0.5 shrink-0"
              />
              <span>KAPAL KARAM</span>
            </a>

            {/* Zone 2: Clean single-line nav tabs */}
            <nav
              aria-label="Navigasi Utama"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              {(
                [
                  { id: 'remote', label: 'Kontrol Kapal' },
                  { id: 'protocol', label: 'Protokol Data' },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-h-[38px] border-b-2 px-1 py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 short:min-h-[32px] ${
                      active
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: 1 primary action button */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleOpenScanner}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 whitespace-nowrap shrink-0 transition-colors hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300 md:min-h-[42px] md:px-4 short:min-h-[34px]"
              >
                <Bluetooth className="h-4 w-4" aria-hidden="true" />
                <span>Scan Bluetooth</span>
              </button>
            </div>
          </div>

          {/* Mobile Nav Strip */}
          <nav
            aria-label="Navigasi Mobile"
            className="flex md:hidden items-center justify-around border-t border-[#163850] px-2"
          >
            {(
              [
                { id: 'remote', label: 'Kontrol Kapal' },
                { id: 'protocol', label: 'Protokol Data' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[36px] px-3 text-xs font-medium whitespace-nowrap ${
                    active ? 'text-cyan-300 underline underline-offset-4' : 'text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>
      )}

      {/* Main Content */}
      <main
        className={
          activeTab === 'remote'
            ? 'relative z-10 flex min-h-0 flex-1 flex-col gap-2 p-2.5 md:gap-3 md:p-3.5 short:gap-1.5 short:p-2'
            : 'relative z-10 mx-auto max-w-7xl px-4 py-4 sm:px-6'
        }
      >
        {/* Connection Status, Direct Install, Wallpaper, Fullscreen & Live Serial Frame Strip */}
        <div
          data-testid="connection-status-bar"
          className={`flex shrink-0 flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#1A3D56]/80 bg-[#0B1E2E]/42 px-2.5 py-1.5 md:gap-2 md:px-4 md:py-2 short:py-1 ${
            activeTab === 'remote' ? '' : 'mb-4'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold md:text-sm">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-red-500'
                }`}
              />
              <span
                data-testid="connection-status-text"
                className={isConnected ? 'text-emerald-300' : 'text-red-300'}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <span className="hidden text-[#2B6085] lg:inline" aria-hidden="true">·</span>

            <span className="hidden text-xs text-slate-300 lg:inline">
              {connectedDevice
                ? `${connectedDevice.name} (${connectedDevice.address})`
                : 'Belum ada modul Bluetooth ESP32 terhubung'}
            </span>

            {isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex min-h-[32px] items-center gap-1 rounded-md border border-red-500/40 bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-200 hover:bg-red-500/25 focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <Unplug className="h-3 w-3" aria-hidden="true" />
                <span>Putuskan</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            {isFullscreenMode && (
              <button
                type="button"
                onClick={handleOpenScanner}
                aria-label="Scan Bluetooth"
                className="flex min-h-[32px] items-center gap-1 rounded-md bg-cyan-400 px-2 py-1 text-[11px] font-semibold text-slate-950 whitespace-nowrap hover:bg-cyan-300 short:min-h-[28px]"
              >
                <Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Scan BT</span>
              </button>
            )}

            {!isInstalled && (
              <button
                type="button"
                data-testid="direct-install-btn"
                onClick={handleDirectInstall}
                aria-label="Pasang Langsung Aplikasi ke Perangkat"
                className="flex min-h-[32px] items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-[11px] font-bold text-slate-950 whitespace-nowrap transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-amber-300 md:px-2.5 md:text-xs short:min-h-[28px]"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Pasang</span>
                <span className="hidden sm:inline">Pasang App</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-install-zip-btn"
              onClick={() => setInstallModalOpen(true)}
              aria-label="QR Code, Link, dan Download ZIP"
              className="flex min-h-[32px] items-center gap-1 rounded-md border border-[#1E4764]/80 bg-[#071624]/55 px-2 py-1 text-[11px] font-semibold text-slate-100 whitespace-nowrap transition-colors hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 md:px-2.5 md:text-xs short:min-h-[28px]"
            >
              <QrCode className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span className="sm:hidden">QR/ZIP</span>
              <span className="hidden sm:inline">QR &amp; ZIP</span>
            </button>

            <button
              type="button"
              data-testid="open-wallpaper-btn"
              onClick={() => setWallpaperOpen(true)}
              aria-label="Atur Wallpaper dan Tema Kapal"
              className="flex min-h-[32px] items-center gap-1 rounded-md border border-[#1E4764]/80 bg-[#071624]/55 px-2 py-1 text-[11px] font-semibold text-slate-100 whitespace-nowrap transition-colors hover:border-cyan-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 md:px-2.5 md:text-xs short:min-h-[28px]"
            >
              <ImagePlus className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span className="sm:hidden">Latar</span>
              <span className="hidden sm:inline">Wallpaper</span>
            </button>

            {activeTab === 'remote' && (
              <button
                type="button"
                data-testid="fullscreen-toggle-btn"
                onClick={handleToggleFullscreen}
                aria-pressed={isFullscreenMode}
                aria-label={isFullscreenMode ? 'Keluar Mode Layar Penuh' : 'Aktifkan Mode Layar Penuh'}
                className={`flex min-h-[32px] items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 md:px-2.5 md:text-xs short:min-h-[28px] ${
                  isFullscreenMode
                    ? 'border-cyan-300 bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                    : 'border-[#1E4764]/80 bg-[#071624]/55 text-slate-100 hover:border-cyan-400/60 hover:text-white'
                }`}
              >
                {isFullscreenMode ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Keluar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
                    <span className="sm:hidden">Full</span>
                    <span className="hidden sm:inline">Layar Penuh</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums md:text-xs">
              <span className="text-slate-300">TX:</span>
              <code
                data-testid="live-tx-payload"
                className="rounded border border-[#163850]/80 bg-[#06131F]/65 px-1.5 py-0.5 text-cyan-300 md:px-2"
              >
                {livePayload}
              </code>
              <span
                data-testid="live-signal-action"
                className="hidden max-w-[160px] truncate rounded bg-emerald-500/15 px-1.5 py-0.5 font-sans text-[11px] font-medium text-emerald-200 xl:inline-block"
              >
                {lastSignalAction}
              </span>
            </div>
          </div>
        </div>

        {/* Active Tab Views */}
        {activeTab === 'remote' && (
          <div
            data-testid="remote-multitouch-zone"
            className="flex min-h-0 flex-1 touch-none select-none flex-col gap-2 md:grid md:grid-cols-[minmax(190px,1fr)_minmax(300px,1.45fr)_minmax(190px,1fr)] md:gap-2.5 lg:grid-cols-[minmax(250px,1fr)_minmax(340px,1.45fr)_minmax(240px,1fr)] lg:gap-3"
          >
            {/* Center Arena + Controls (Appears top on mobile, center column on desktop/landscape) */}
            <div className="flex flex-col gap-2 md:order-2 md:min-h-0 md:h-full md:gap-3">
              <BoatBasinCanvas
                command={currentCommand}
                isConnected={isConnected}
                paused={anyModalOpen}
              />

              <div className="grid shrink-0 grid-cols-2 gap-2 md:gap-3">
                <DirectionDPad direction={direction} onChange={setDirection} />
                <AccessoryPanel
                  accessories={accessories}
                  onToggle={handleToggleAccessory}
                />
              </div>
            </div>

            {/* Mobile bottom thumb row OR Desktop Left/Right side columns */}
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:contents">
              {/* Left Thumb Zone: Headless 360 Analog */}
              <div className="min-h-0 h-full md:order-1">
                <HeadlessJoystick
                  value={joystick}
                  onChange={(angleDeg, magPct) => setJoystick({ angleDeg, magPct })}
                />
              </div>

              {/* Right Thumb Zone: Ship Telegraph Throttle Lever */}
              <div className="min-h-0 h-full md:order-3">
                <TelegraphLever throttlePct={throttlePct} onChange={setThrottlePct} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'protocol' && (
          <ProtocolAndWiringView
            currentCommand={currentCommand}
            signalLog={signalLog}
            lastSignalAction={lastSignalAction}
            onApplyCommand={handleApplyProtocolCommand}
            onClearSignalLog={() => setSignalLog([])}
          />
        )}
      </main>

      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-3 left-3 z-40 rounded-lg border border-amber-400/50 bg-[#0B1E2E] px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg"
        >
          Mode Offline — Aplikasi tetap berjalan dari cache PWA lokal
        </div>
      )}

      <BluetoothScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        devices={devicesWithFavorites}
        isScanning={isScanning}
        hasScanned={hasScanned}
        scanNotice={scanNotice}
        connectedDeviceId={connectedDevice?.id ?? null}
        bluetoothSupported={bluetoothSupported}
        serialSupported={serialSupported}
        serialConnected={serialPort !== null}
        isIOS={isIOS}
        isInIframe={isInIframe}
        onStartScan={handleStartScan}
        onClearDevices={handleClearDevices}
        onToggleFavorite={handleToggleFavorite}
        onConnect={handleConnectDevice}
        onDisconnect={handleDisconnect}
        onConnectWebSerial={handleConnectWebSerial}
      />

      <WallpaperModal
        isOpen={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        config={wallpaper}
        onChange={handleUpdateWallpaper}
        onReset={handleResetWallpaper}
      />

      <InstallAndExportModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
      />
    </div>
  );
}
