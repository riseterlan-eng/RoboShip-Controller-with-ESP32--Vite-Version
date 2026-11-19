export type DriveDirection = 'F' | 'R';

export interface AccessoryState {
  navLights: boolean;
  spotlight: boolean;
  siren: boolean;
  beacon: boolean;
  bilgePump: boolean;
  anchor: boolean;
}

export interface JoystickOutput {
  normX: number; // -1 to 1 (left to right)
  normY: number; // -1 to 1 (up to down in screen coords)
  magnitude: number; // 0 to 1
  angleDeg: number; // 0 = Up/Away, 90 = Right, 180 = Down/Toward, 270 = Left
  isDeadzone: boolean;
}

export interface BoatControlCommand {
  throttlePct: number; // 0 to 100
  direction: DriveDirection;
  joyAngleDeg: number; // 0 to 359
  joyMagPct: number; // 0 to 100
  accessories: AccessoryState;
}

export interface BluetoothDeviceItem {
  id: string;
  name: string;
  address: string;
  rssi?: number | null;
  deviceType: 'ESP32-BLE' | 'ESP32-SPP' | 'HC-05' | 'USB-Serial' | 'Generic';
  source?: 'web-bluetooth' | 'web-serial';
  isFavorite: boolean;
}

export interface BoatSimState {
  x: number; // 0..1000 basin width
  y: number; // 0..600 basin height
  headingDeg: number; // 0 = North (Away), 90 = East (Right), 180 = South (Toward), 270 = West (Left)
  speed: number; // signed pixels/sec
  rudderAngleDeg: number; // 35..145, center 90
}

export const DEADZONE_RATIO = 0.12;
export const RUDDER_CENTER_DEG = 90;
export const RUDDER_MAX_DEFLECTION_DEG = 55; // 35° (Port/Left) to 145° (Starboard/Right)

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function wrapAngle360(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function wrapAngle180(deg: number): number {
  let wrapped = ((deg + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180) wrapped = 180;
  return wrapped;
}

/**
 * Converts pointer delta (dx, dy) from joystick center into absolute 360° Headless coordinates.
 * 0° = Up (away from operator), 90° = Right, 180° = Down (toward operator), 270° = Left.
 */
export function computeHeadlessJoystick(
  dx: number,
  dy: number,
  radius: number,
  deadzone = DEADZONE_RATIO
): JoystickOutput {
  if (radius <= 0) {
    return { normX: 0, normY: 0, magnitude: 0, angleDeg: 0, isDeadzone: true };
  }

  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(dist, radius);
  const rawMag = clampedDist / radius;

  if (rawMag < deadzone) {
    return { normX: 0, normY: 0, magnitude: 0, angleDeg: 0, isDeadzone: true };
  }

  const scale = clampedDist / (dist || 1);
  const normX = (dx * scale) / radius;
  const normY = (dy * scale) / radius;

  // Remap magnitude outside deadzone smoothly to [0, 1]
  const remappedMag = clamp((rawMag - deadzone) / (1 - deadzone), 0, 1);

  // atan2(x, -y) gives 0 rad at Up (0, -1), +PI/2 at Right (1, 0), PI at Down (0, 1)
  const rad = Math.atan2(normX, -normY);
  const angleDeg = Math.round(wrapAngle360((rad * 180) / Math.PI)) % 360;

  return {
    normX: Number(normX.toFixed(3)),
    normY: Number(normY.toFixed(3)),
    magnitude: Number(remappedMag.toFixed(3)),
    angleDeg,
    isDeadzone: false,
  };
}

/**
 * Combines one or more simultaneously held cardinal directions (0, 90, 180, 270)
 * into a single Headless angle (e.g. 0 + 90 -> 45 deg diagonal).
 * Returns null if empty or opposite directions cancel out.
 */
export function combineCardinalAngles(angles: number[]): number | null {
  if (angles.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180;
    sumX += Math.sin(rad);
    sumY += -Math.cos(rad);
  }
  if (Math.hypot(sumX, sumY) < 0.01) {
    return null;
  }
  const combinedRad = Math.atan2(sumX, -sumY);
  return Math.round(wrapAngle360((combinedRad * 180) / Math.PI)) % 360;
}

/**
 * Headless Mode Rudder Controller:
 * Computes target rudder servo angle (35°..145°, center 90°) from operator's target POV angle
 * and the boat's current compass heading.
 */
export function computeRudderForHeadless(
  targetAngleDeg: number,
  boatHeadingDeg: number,
  joyMagPct: number,
  direction: DriveDirection = 'F'
): number {
  if (joyMagPct <= 0) {
    return RUDDER_CENTER_DEG;
  }

  const errorDeg = wrapAngle180(targetAngleDeg - boatHeadingDeg);
  if (Math.abs(errorDeg) < 3) {
    return RUDDER_CENTER_DEG;
  }

  // Proportional gain: full deflection at >= 65° heading error, scaled by joystick magnitude
  const kp = 0.85;
  const gainScale = 0.45 + 0.55 * clamp(joyMagPct / 100, 0, 1);
  const dirSign = direction === 'R' ? -1 : 1;
  const deflection = clamp(
    errorDeg * kp * gainScale * dirSign,
    -RUDDER_MAX_DEFLECTION_DEG,
    RUDDER_MAX_DEFLECTION_DEG
  );

  return Math.round(RUDDER_CENTER_DEG + deflection);
}

export function encodeAccessoriesMask(acc: AccessoryState): number {
  return (
    (acc.navLights ? 1 : 0) |
    (acc.spotlight ? 2 : 0) |
    (acc.siren ? 4 : 0) |
    (acc.beacon ? 8 : 0) |
    (acc.bilgePump ? 16 : 0) |
    (acc.anchor ? 32 : 0)
  );
}

export function decodeAccessoriesMask(mask: number): AccessoryState {
  return {
    navLights: Boolean(mask & 1),
    spotlight: Boolean(mask & 2),
    siren: Boolean(mask & 4),
    beacon: Boolean(mask & 8),
    bilgePump: Boolean(mask & 16),
    anchor: Boolean(mask & 32),
  };
}

export function computeXorChecksum(body: string): string {
  let xor = 0;
  for (let i = 0; i < body.length; i++) {
    xor ^= body.charCodeAt(i);
  }
  return xor.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Formats Bluetooth Classic SPP command frame:
 * $CMD,<throttlePct>,<dir>,<joyAngleDeg>,<joyMagPct>,<auxMask>*<CRC>\n
 */
export function buildBluetoothPayload(cmd: BoatControlCommand): string {
  const pwm = Math.round(clamp(cmd.throttlePct, 0, 100));
  const dir: DriveDirection = cmd.direction === 'R' ? 'R' : 'F';
  const angle = Math.round(wrapAngle360(cmd.joyAngleDeg)) % 360;
  const mag = Math.round(clamp(cmd.joyMagPct, 0, 100));
  const aux = encodeAccessoriesMask(cmd.accessories);

  const body = `CMD,${pwm},${dir},${angle},${mag},${aux}`;
  const crc = computeXorChecksum(body);
  return `$${body}*${crc}\n`;
}

export interface ParsedBluetoothPayload {
  valid: boolean;
  command?: BoatControlCommand;
  error?: string;
}

export function parseBluetoothPayload(rawLine: string): ParsedBluetoothPayload {
  const trimmed = rawLine.trim();
  if (!trimmed.startsWith('$')) {
    return { valid: false, error: 'Missing start delimiter $' };
  }
  const starIdx = trimmed.indexOf('*');
  if (starIdx === -1) {
    return { valid: false, error: 'Missing checksum delimiter *' };
  }

  const body = trimmed.slice(1, starIdx);
  const crcHex = trimmed.slice(starIdx + 1).toUpperCase();
  const expectedCrc = computeXorChecksum(body);
  if (crcHex !== expectedCrc) {
    return { valid: false, error: `Checksum mismatch: got ${crcHex}, expected ${expectedCrc}` };
  }

  const parts = body.split(',');
  if (parts.length !== 6 || parts[0] !== 'CMD') {
    return { valid: false, error: 'Invalid CMD field count or header' };
  }

  const throttlePct = Number(parts[1]);
  const dirRaw = parts[2];
  const joyAngleDeg = Number(parts[3]);
  const joyMagPct = Number(parts[4]);
  const auxMask = Number(parts[5]);

  if (
    !Number.isFinite(throttlePct) ||
    !Number.isFinite(joyAngleDeg) ||
    !Number.isFinite(joyMagPct) ||
    !Number.isFinite(auxMask) ||
    (dirRaw !== 'F' && dirRaw !== 'R')
  ) {
    return { valid: false, error: 'Malformed numeric or direction fields' };
  }

  return {
    valid: true,
    command: {
      throttlePct: clamp(throttlePct, 0, 100),
      direction: dirRaw,
      joyAngleDeg: wrapAngle360(joyAngleDeg) % 360,
      joyMagPct: clamp(joyMagPct, 0, 100),
      accessories: decodeAccessoriesMask(auxMask),
    },
  };
}

/**
 * Sorts scanned Bluetooth devices so Favorite-tagged devices always appear at the top,
 * followed by strongest signal (highest RSSI).
 */
export function sortBluetoothDevices(devices: BluetoothDeviceItem[]): BluetoothDeviceItem[] {
  return [...devices].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }
    const rssiA = a.rssi ?? -999;
    const rssiB = b.rssi ?? -999;
    if (rssiB !== rssiA) {
      return rssiB - rssiA;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Advances 2D boat simulation in the water basin using Headless Mode rudder control,
 * Telegraph throttle PWM, and Forward/Reverse motor direction.
 */
export function stepBoatPhysics(
  boat: BoatSimState,
  cmd: BoatControlCommand,
  dtSec: number,
  bounds = { width: 1000, height: 600, margin: 44 }
): BoatSimState {
  const dt = clamp(dtSec, 0.001, 0.1);

  // Rudder target from Headless Mode controller
  const targetRudder = computeRudderForHeadless(
    cmd.joyAngleDeg,
    boat.headingDeg,
    cmd.joyMagPct,
    cmd.direction
  );

  // Smooth servo travel (~300 deg/sec)
  const maxRudderStep = 320 * dt;
  const rudderDelta = clamp(targetRudder - boat.rudderAngleDeg, -maxRudderStep, maxRudderStep);
  const nextRudder = boat.rudderAngleDeg + rudderDelta;

  // Propeller thrust: either Telegraph Throttle OR joystick push contributes minimum steerageway
  const telegraphSpeed = (cmd.throttlePct / 100) * 195;
  const effectiveThrust =
    cmd.throttlePct > 0
      ? telegraphSpeed
      : cmd.joyMagPct > 15
        ? (cmd.joyMagPct / 100) * 70
        : 0;

  const targetSpeed = cmd.direction === 'R' ? -effectiveThrust * 0.68 : effectiveThrust;
  const speedTau = 1.8;
  const nextSpeed = boat.speed + (targetSpeed - boat.speed) * clamp(dt * speedTau, 0, 1);

  // Rudder effectiveness scales with water flow over rudder blade (minimum low-speed thruster wash)
  const rudderDeflectionNorm = (nextRudder - RUDDER_CENTER_DEG) / RUDDER_MAX_DEFLECTION_DEG;
  const flowAuthority = Math.max(0.28, Math.abs(nextSpeed) / 160);
  const turnSign = nextSpeed >= -5 ? 1 : -1;
  const yawRateDegPerSec = rudderDeflectionNorm * 135 * flowAuthority * turnSign;
  const nextHeading = wrapAngle360(boat.headingDeg + yawRateDegPerSec * dt);

  const headingRad = (nextHeading * Math.PI) / 180;
  // 0° = Up (-Y), 90° = Right (+X)
  const vx = Math.sin(headingRad) * nextSpeed;
  const vy = -Math.cos(headingRad) * nextSpeed;

  const nextX = clamp(boat.x + vx * dt, bounds.margin, bounds.width - bounds.margin);
  const nextY = clamp(boat.y + vy * dt, bounds.margin, bounds.height - bounds.margin);

  return {
    x: nextX,
    y: nextY,
    headingDeg: nextHeading,
    speed: nextSpeed,
    rudderAngleDeg: nextRudder,
  };
}

export type SignalCategory = 'dpad' | 'telegraph' | 'joystick' | 'accessory';

export interface ButtonSignalSpec {
  id: string;
  category: SignalCategory;
  categoryLabel: string;
  buttonName: string;
  changedField: string;
  sampleFrame: string;
  hardwareSignal: string;
  isActive: boolean;
}

const ALL_ACCESSORIES_OFF: AccessoryState = {
  navLights: false,
  spotlight: false,
  siren: false,
  beacon: false,
  bilgePump: false,
  anchor: false,
};

/**
 * Generates the exact Bluetooth payload frame and ESP32 hardware signal mapping
 * for every button and control on the KAPAL KARAM controller screen.
 */
export function getButtonSignalCatalog(cmd: BoatControlCommand): ButtonSignalSpec[] {
  const frameFor = (override: Partial<BoatControlCommand>): string =>
    buildBluetoothPayload({
      ...cmd,
      ...override,
    }).trim();

  const { navLights, spotlight, siren, beacon, bilgePump, anchor } = cmd.accessories;
  const allOn = navLights && spotlight && siren && beacon && bilgePump && anchor;

  return [
    // D-Pad Arah Motor
    {
      id: 'dir-forward',
      category: 'dpad',
      categoryLabel: 'Tombol Arah Motor (D-Pad)',
      buttonName: 'Mode Maju',
      changedField: 'dir = F',
      sampleFrame: frameFor({ direction: 'F' }),
      hardwareSignal: 'GPIO 26 (IN1) = HIGH · GPIO 27 (IN2) = LOW · GPIO 25 (ENA) = PWM',
      isActive: cmd.direction === 'F',
    },
    {
      id: 'dir-reverse',
      category: 'dpad',
      categoryLabel: 'Tombol Arah Motor (D-Pad)',
      buttonName: 'Mode Mundur',
      changedField: 'dir = R',
      sampleFrame: frameFor({ direction: 'R' }),
      hardwareSignal: 'GPIO 26 (IN1) = LOW · GPIO 27 (IN2) = HIGH · GPIO 25 (ENA) = PWM',
      isActive: cmd.direction === 'R',
    },

    // Tuas Telegraf / Kecepatan PWM
    {
      id: 'tel-stop',
      category: 'telegraph',
      categoryLabel: 'Tuas Telegraf (Kecepatan PWM)',
      buttonName: 'STOP (0%)',
      changedField: 'throttlePct = 0',
      sampleFrame: frameFor({ throttlePct: 0 }),
      hardwareSignal: 'GPIO 25 (ENA) = PWM 0/255 · IN1 & IN2 = LOW (Motor Mati)',
      isActive: cmd.throttlePct === 0,
    },
    {
      id: 'tel-slow',
      category: 'telegraph',
      categoryLabel: 'Tuas Telegraf (Kecepatan PWM)',
      buttonName: 'SLOW (25%)',
      changedField: 'throttlePct = 25',
      sampleFrame: frameFor({ throttlePct: 25 }),
      hardwareSignal: 'GPIO 25 (ENA) = PWM 64/255 (25% daya motor)',
      isActive: cmd.throttlePct === 25,
    },
    {
      id: 'tel-half',
      category: 'telegraph',
      categoryLabel: 'Tuas Telegraf (Kecepatan PWM)',
      buttonName: 'HALF (50%)',
      changedField: 'throttlePct = 50',
      sampleFrame: frameFor({ throttlePct: 50 }),
      hardwareSignal: 'GPIO 25 (ENA) = PWM 128/255 (50% daya motor)',
      isActive: cmd.throttlePct === 50,
    },
    {
      id: 'tel-full',
      category: 'telegraph',
      categoryLabel: 'Tuas Telegraf (Kecepatan PWM)',
      buttonName: 'FULL (75%)',
      changedField: 'throttlePct = 75',
      sampleFrame: frameFor({ throttlePct: 75 }),
      hardwareSignal: 'GPIO 25 (ENA) = PWM 191/255 (75% daya motor)',
      isActive: cmd.throttlePct === 75,
    },
    {
      id: 'tel-flank',
      category: 'telegraph',
      categoryLabel: 'Tuas Telegraf (Kecepatan PWM)',
      buttonName: 'FLANK (100%)',
      changedField: 'throttlePct = 100',
      sampleFrame: frameFor({ throttlePct: 100 }),
      hardwareSignal: 'GPIO 25 (ENA) = PWM 255/255 (Kecepatan penuh)',
      isActive: cmd.throttlePct === 100,
    },

    // Analog Headless 360°
    {
      id: 'joy-neutral',
      category: 'joystick',
      categoryLabel: 'Analog Headless 360° & Tombol Arah',
      buttonName: 'Netral / Reset Analog',
      changedField: 'angle = 0°, mag = 0%',
      sampleFrame: frameFor({ joyAngleDeg: 0, joyMagPct: 0 }),
      hardwareSignal: 'Servo Kemudi GPIO 13 = 90° (Lurus / Center)',
      isActive: cmd.joyMagPct === 0,
    },
    {
      id: 'joy-up',
      category: 'joystick',
      categoryLabel: 'Analog Headless 360° & Tombol Arah',
      buttonName: 'Atas / Menjauh (0°)',
      changedField: 'angle = 0°, mag = 100%',
      sampleFrame: frameFor({ joyAngleDeg: 0, joyMagPct: 100 }),
      hardwareSignal: 'Target POV 0° (menjauhi operator) · Servo GPIO 13 = 90° saat lurus',
      isActive: cmd.joyMagPct > 0 && (cmd.joyAngleDeg >= 315 || cmd.joyAngleDeg < 45),
    },
    {
      id: 'joy-right',
      category: 'joystick',
      categoryLabel: 'Analog Headless 360° & Tombol Arah',
      buttonName: 'Kanan (90°)',
      changedField: 'angle = 90°, mag = 100%',
      sampleFrame: frameFor({ joyAngleDeg: 90, joyMagPct: 100 }),
      hardwareSignal: 'Servo GPIO 13 belok kanan → hingga 145° (+55°)',
      isActive: cmd.joyMagPct > 0 && cmd.joyAngleDeg >= 45 && cmd.joyAngleDeg < 135,
    },
    {
      id: 'joy-down',
      category: 'joystick',
      categoryLabel: 'Analog Headless 360° & Tombol Arah',
      buttonName: 'Bawah / Menghadap (180°)',
      changedField: 'angle = 180°, mag = 100%',
      sampleFrame: frameFor({ joyAngleDeg: 180, joyMagPct: 100 }),
      hardwareSignal: 'Putar haluan 180° menghadap operator · Servo GPIO 13 defleksi penuh',
      isActive: cmd.joyMagPct > 0 && cmd.joyAngleDeg >= 135 && cmd.joyAngleDeg < 225,
    },
    {
      id: 'joy-left',
      category: 'joystick',
      categoryLabel: 'Analog Headless 360° & Tombol Arah',
      buttonName: 'Kiri (270°)',
      changedField: 'angle = 270°, mag = 100%',
      sampleFrame: frameFor({ joyAngleDeg: 270, joyMagPct: 100 }),
      hardwareSignal: 'Servo GPIO 13 belok kiri → hingga 35° (-55°)',
      isActive: cmd.joyMagPct > 0 && cmd.joyAngleDeg >= 225 && cmd.joyAngleDeg < 315,
    },

    // 6 Tombol Aksesori (Bitmask)
    {
      id: 'aux-nav',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Navigasi (ON)',
      changedField: 'auxMask Bit 0 (+1)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, navLights: true } }),
      hardwareSignal: 'GPIO 16 = HIGH saat aktif · LOW saat mati',
      isActive: navLights,
    },
    {
      id: 'aux-spot',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Sorot (ON)',
      changedField: 'auxMask Bit 1 (+2)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, spotlight: true } }),
      hardwareSignal: 'GPIO 17 = HIGH saat aktif · LOW saat mati',
      isActive: spotlight,
    },
    {
      id: 'aux-siren',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Sirine (ON)',
      changedField: 'auxMask Bit 2 (+4)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, siren: true } }),
      hardwareSignal: 'GPIO 18 = HIGH saat aktif · LOW saat mati',
      isActive: siren,
    },
    {
      id: 'aux-beacon',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Beacon (ON)',
      changedField: 'auxMask Bit 3 (+8)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, beacon: true } }),
      hardwareSignal: 'GPIO 19 = HIGH saat aktif · LOW saat mati',
      isActive: beacon,
    },
    {
      id: 'aux-pump',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Pompa Air (ON)',
      changedField: 'auxMask Bit 4 (+16)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, bilgePump: true } }),
      hardwareSignal: 'GPIO 21 = HIGH saat aktif · LOW saat mati',
      isActive: bilgePump,
    },
    {
      id: 'aux-anchor',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Jangkar (ON)',
      changedField: 'auxMask Bit 5 (+32)',
      sampleFrame: frameFor({ accessories: { ...ALL_ACCESSORIES_OFF, anchor: true } }),
      hardwareSignal: 'GPIO 22 = HIGH saat aktif · LOW saat mati',
      isActive: anchor,
    },
    {
      id: 'aux-all',
      category: 'accessory',
      categoryLabel: '6 Tombol Aksesori Kapal (Bitmask 0–63)',
      buttonName: 'Semua Aksesori Aktif (6/6)',
      changedField: 'auxMask = 63 (0b111111)',
      sampleFrame: frameFor({
        accessories: {
          navLights: true,
          spotlight: true,
          siren: true,
          beacon: true,
          bilgePump: true,
          anchor: true,
        },
      }),
      hardwareSignal: 'GPIO 16, 17, 18, 19, 21, 22 = HIGH semua secara bersamaan',
      isActive: allOn,
    },
  ];
}

export interface SignalLogEntry {
  id: string;
  timeLabel: string;
  actionLabel: string;
  frame: string;
  pinSummary: string;
}

/**
 * Produces a concise human-readable description of which button/control changed
 * between two BoatControlCommand states and what hardware signal it sends.
 */
export function describeControlChange(
  prev: BoatControlCommand,
  next: BoatControlCommand
): { actionLabel: string; pinSummary: string } {
  const parts: string[] = [];
  const pins: string[] = [];

  if (prev.direction !== next.direction) {
    parts.push(next.direction === 'F' ? 'Mode Maju' : 'Mode Mundur');
    pins.push(
      next.direction === 'F'
        ? 'GPIO26(IN1)=HIGH, GPIO27(IN2)=LOW'
        : 'GPIO26(IN1)=LOW, GPIO27(IN2)=HIGH'
    );
  }

  if (prev.throttlePct !== next.throttlePct) {
    const pwm255 = Math.round((clamp(next.throttlePct, 0, 100) / 100) * 255);
    parts.push(`Telegraf ${next.throttlePct}%`);
    pins.push(`GPIO25(ENA)=PWM ${pwm255}`);
  }

  if (prev.joyAngleDeg !== next.joyAngleDeg || prev.joyMagPct !== next.joyMagPct) {
    if (next.joyMagPct === 0) {
      parts.push('Analog Netral (0°)');
      pins.push('GPIO13(Servo)=90°');
    } else {
      parts.push(`Analog ${next.joyAngleDeg}° (${next.joyMagPct}%)`);
      const rudder = computeRudderForHeadless(next.joyAngleDeg, 0, next.joyMagPct, next.direction);
      pins.push(`GPIO13(Servo)=${rudder}°`);
    }
  }

  const accMeta: { key: keyof AccessoryState; name: string; gpio: string }[] = [
    { key: 'navLights', name: 'Navigasi', gpio: 'GPIO16' },
    { key: 'spotlight', name: 'Sorot', gpio: 'GPIO17' },
    { key: 'siren', name: 'Sirine', gpio: 'GPIO18' },
    { key: 'beacon', name: 'Beacon', gpio: 'GPIO19' },
    { key: 'bilgePump', name: 'Pompa', gpio: 'GPIO21' },
    { key: 'anchor', name: 'Jangkar', gpio: 'GPIO22' },
  ];
  for (const item of accMeta) {
    if (prev.accessories[item.key] !== next.accessories[item.key]) {
      const on = next.accessories[item.key];
      parts.push(`${item.name} ${on ? 'ON' : 'OFF'}`);
      pins.push(`${item.gpio}=${on ? 'HIGH' : 'LOW'}`);
    }
  }

  if (parts.length === 0) {
    const auxMask = encodeAccessoriesMask(next.accessories);
    return {
      actionLabel: 'Kirim Ulang Sinyal',
      pinSummary: `PWM ${Math.round((next.throttlePct / 100) * 255)} · dir=${next.direction} · aux=${auxMask}`,
    };
  }

  return {
    actionLabel: parts.join(' + '),
    pinSummary: pins.join(' · '),
  };
}

export function describeCommandChange(
  prev: BoatControlCommand | null,
  next: BoatControlCommand
): string {
  const frame = buildBluetoothPayload(next).trim();
  if (!prev) {
    return `Siap · Netral (${frame})`;
  }
  const { actionLabel, pinSummary } = describeControlChange(prev, next);
  return pinSummary ? `${actionLabel} · ${pinSummary}` : actionLabel;
}

export interface ChangedParameterSignal {
  hasChanges: boolean;
  label: string;
  param: string;
}

/**
 * Formats ONLY the specific parameter(s) that changed between prev and next commands
 * so the compact monitor strip shows concise delta updates instead of all parameters.
 */
export function formatChangedParameterSignal(
  prev: BoatControlCommand | null,
  next: BoatControlCommand
): ChangedParameterSignal {
  if (!prev) {
    return { hasChanges: false, label: 'Siap', param: '—' };
  }

  const labels: string[] = [];
  const params: string[] = [];

  if (prev.direction !== next.direction) {
    labels.push(next.direction === 'F' ? 'Maju' : 'Mundur');
    params.push(`dir=${next.direction}`);
  }

  if (prev.throttlePct !== next.throttlePct) {
    const pwmPct = Math.round(clamp(next.throttlePct, 0, 100));
    labels.push(`Gas ${pwmPct}%`);
    params.push(`pwm=${pwmPct}`);
  }

  if (prev.joyAngleDeg !== next.joyAngleDeg || prev.joyMagPct !== next.joyMagPct) {
    if (next.joyMagPct === 0) {
      labels.push('Kemudi Netral');
      params.push('joy=0,0');
    } else {
      labels.push(`Kemudi ${Math.round(next.joyAngleDeg)}°`);
      params.push(`joy=${Math.round(next.joyAngleDeg)},${Math.round(next.joyMagPct)}`);
    }
  }

  const accKeys: { key: keyof AccessoryState; label: string; code: string }[] = [
    { key: 'navLights', label: 'Navigasi', code: 'nav' },
    { key: 'spotlight', label: 'Sorot', code: 'sorot' },
    { key: 'siren', label: 'Sirine', code: 'sirine' },
    { key: 'beacon', label: 'Beacon', code: 'beacon' },
    { key: 'bilgePump', label: 'Pompa', code: 'pompa' },
    { key: 'anchor', label: 'Jangkar', code: 'jangkar' },
  ];
  for (const acc of accKeys) {
    if (prev.accessories[acc.key] !== next.accessories[acc.key]) {
      const active = next.accessories[acc.key];
      labels.push(`${acc.label} ${active ? 'ON' : 'OFF'}`);
      params.push(`${acc.code}=${active ? 1 : 0}`);
    }
  }

  if (params.length === 0) {
    return { hasChanges: false, label: 'Siap', param: '—' };
  }

  return {
    hasChanges: true,
    label: labels.join(' + '),
    param: params.join(' '),
  };
}

export function appendSignalLogEntry(
  log: SignalLogEntry[],
  entry: SignalLogEntry,
  maxItems = 8
): SignalLogEntry[] {
  return [entry, ...log].slice(0, Math.max(1, maxItems));
}


