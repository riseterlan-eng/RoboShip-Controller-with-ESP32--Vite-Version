export interface WebBluetoothCharacteristicLike {
  uuid: string;
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
}

export interface WebBluetoothServiceLike {
  uuid: string;
  getCharacteristic: (uuid: string) => Promise<WebBluetoothCharacteristicLike>;
  getCharacteristics: () => Promise<WebBluetoothCharacteristicLike[]>;
}

export interface WebBluetoothGattServerLike {
  connected: boolean;
  connect: () => Promise<WebBluetoothGattServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<WebBluetoothServiceLike>;
  getPrimaryServices?: () => Promise<WebBluetoothServiceLike[]>;
}

export interface WebBluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: WebBluetoothGattServerLike;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface WebBluetoothNavigatorLike {
  requestDevice: (options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ namePrefix?: string; services?: string[] }>;
    optionalServices?: string[];
  }) => Promise<WebBluetoothDeviceLike>;
  getDevices?: () => Promise<WebBluetoothDeviceLike[]>;
}

export interface WebSerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface WebSerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => WebSerialPortInfo;
}

// Common ESP32 BLE UART / HM-10 Serial UUIDs (full lowercase UUIDs for iOS & Android compatibility)
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const HM10_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const HM10_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
export const ESP32_CUSTOM_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const ESP32_CUSTOM_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export const BLE_UART_OPTIONAL_SERVICES = [
  NORDIC_UART_SERVICE_UUID,
  HM10_SERVICE_UUID,
  ESP32_CUSTOM_SERVICE_UUID,
  '0000180f-0000-1000-8000-00805f9b34fb', // battery_service
  '0000180a-0000-1000-8000-00805f9b34fb', // device_information
];

const PREFERRED_TX_CHARACTERISTIC_UUIDS = [
  NORDIC_UART_TX_CHAR_UUID,
  HM10_CHAR_UUID,
  ESP32_CUSTOM_CHAR_UUID,
];

// CoreBluetooth on iOS often caps default GATT writes at 20 bytes unless MTU is negotiated
export const BLE_SAFE_CHUNK_BYTES = 20;

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof (navigator as unknown as { bluetooth?: WebBluetoothNavigatorLike }).bluetooth
      ?.requestDevice === 'function'
  );
}

export function isWebSerialSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    typeof (navigator as unknown as { serial?: { requestPort?: unknown } }).serial
      ?.requestPort === 'function'
  );
}

export function getWebBluetoothNavigator(): WebBluetoothNavigatorLike | null {
  if (!isWebBluetoothSupported()) return null;
  return (navigator as unknown as { bluetooth: WebBluetoothNavigatorLike }).bluetooth;
}

export interface WebSerialNavigatorLike {
  requestPort: () => Promise<WebSerialPortLike>;
  getPorts?: () => Promise<WebSerialPortLike[]>;
}

export function getWebSerialNavigator(): WebSerialNavigatorLike | null {
  if (!isWebSerialSupported()) return null;
  return (navigator as unknown as { serial: WebSerialNavigatorLike }).serial;
}

/**
 * Multi-strategy Web Bluetooth device picker compatible with Android Chrome, Desktop Chrome/Edge,
 * and iOS WebBLE browsers (Bluefy / WebBLE) that sometimes reject acceptAllDevices or specific options.
 */
export async function requestBluetoothDeviceResilient(
  navBt: WebBluetoothNavigatorLike
): Promise<WebBluetoothDeviceLike> {
  try {
    return await navBt.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_UART_OPTIONAL_SERVICES,
    });
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    // Re-throw immediate user cancellations or permission denials without re-prompting
    if (
      errName === 'NotFoundError' ||
      errName === 'AbortError' ||
      errName === 'SecurityError' ||
      errName === 'NotAllowedError'
    ) {
      throw err;
    }

    // Fallback 1: explicit filters (required by some iOS WebBLE shims)
    try {
      return await navBt.requestDevice({
        filters: [
          { services: [NORDIC_UART_SERVICE_UUID] },
          { services: [HM10_SERVICE_UUID] },
          { namePrefix: 'ESP' },
          { namePrefix: 'KAPAL' },
          { namePrefix: 'HC' },
          { namePrefix: 'BT' },
        ],
        optionalServices: [NORDIC_UART_SERVICE_UUID, HM10_SERVICE_UUID, ESP32_CUSTOM_SERVICE_UUID],
      });
    } catch (fallbackErr) {
      const fbName = fallbackErr instanceof Error ? fallbackErr.name : '';
      if (
        fbName === 'NotFoundError' ||
        fbName === 'AbortError' ||
        fbName === 'SecurityError' ||
        fbName === 'NotAllowedError'
      ) {
        throw fallbackErr;
      }
      // Fallback 2: minimal acceptAllDevices without optionalServices
      return await navBt.requestDevice({
        acceptAllDevices: true,
      });
    }
  }
}

/**
 * Resolves a writable BLE GATT characteristic for streaming $CMD,...*CRC\n frames to ESP32.
 */
export async function findWritableGattCharacteristic(
  server: WebBluetoothGattServerLike
): Promise<WebBluetoothCharacteristicLike | null> {
  for (const serviceUuid of BLE_UART_OPTIONAL_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of PREFERRED_TX_CHARACTERISTIC_UUIDS) {
        try {
          const ch = await service.getCharacteristic(charUuid);
          if (ch.properties.writeWithoutResponse || ch.properties.write) {
            return ch;
          }
        } catch {
          // Try next known characteristic UUID
        }
      }
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties.writeWithoutResponse || c.properties.write
      );
      if (writable) return writable;
    } catch {
      // Service not present on this device
    }
  }

  // Fallback: inspect any exposed primary service for a writable characteristic
  if (typeof server.getPrimaryServices === 'function') {
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          const writable = chars.find(
            (c) => c.properties.writeWithoutResponse || c.properties.write
          );
          if (writable) return writable;
        } catch {
          // Ignore restricted service
        }
      }
    } catch {
      // Ignore if getPrimaryServices fails on iOS shim
    }
  }

  return null;
}

async function writeSingleBleChunk(
  characteristic: WebBluetoothCharacteristicLike,
  chunkBuffer: ArrayBuffer
): Promise<void> {
  if (
    characteristic.properties.writeWithoutResponse &&
    typeof characteristic.writeValueWithoutResponse === 'function'
  ) {
    try {
      await characteristic.writeValueWithoutResponse(chunkBuffer);
      return;
    } catch {
      // Fall through to writeValueWithResponse / legacy writeValue on iOS WebBLE shims
    }
  }
  if (
    characteristic.properties.write &&
    typeof characteristic.writeValueWithResponse === 'function'
  ) {
    await characteristic.writeValueWithResponse(chunkBuffer);
    return;
  }
  if (typeof characteristic.writeValue === 'function') {
    await characteristic.writeValue(chunkBuffer);
  }
}

/**
 * Splits BLE writes into 20-byte MTU-safe chunks (prevents packet truncation/errors on iOS CoreBluetooth).
 */
export async function writeBlePayload(
  characteristic: WebBluetoothCharacteristicLike,
  payloadBytes: Uint8Array,
  chunkSize = BLE_SAFE_CHUNK_BYTES
): Promise<void> {
  const safeSize = Math.max(1, chunkSize);
  for (let offset = 0; offset < payloadBytes.byteLength; offset += safeSize) {
    const end = Math.min(offset + safeSize, payloadBytes.byteLength);
    const slice = payloadBytes.slice(offset, end);
    await writeSingleBleChunk(characteristic, slice.buffer as ArrayBuffer);
  }
}

export function formatSerialPortLabel(port: WebSerialPortLike, index: number): {
  id: string;
  name: string;
  address: string;
} {
  const info = typeof port.getInfo === 'function' ? port.getInfo() : {};
  const vid =
    typeof info.usbVendorId === 'number'
      ? info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')
      : null;
  const pid =
    typeof info.usbProductId === 'number'
      ? info.usbProductId.toString(16).toUpperCase().padStart(4, '0')
      : null;

  if (vid && pid) {
    return {
      id: `serial-${vid}-${pid}-${index}`,
      name: `Serial Bridge (${vid}:${pid})`,
      address: `COM/USB-${vid}:${pid}`,
    };
  }
  return {
    id: `serial-spp-${index}`,
    name: `Bluetooth SPP / Serial Port #${index + 1}`,
    address: `SPP-PORT-${index + 1}`,
  };
}
