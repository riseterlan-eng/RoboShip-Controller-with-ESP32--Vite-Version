import type { BluetoothDeviceItem } from '../utils/boatControl';

const FAVORITES_STORAGE_KEY = 'kapalrc_favorite_bt_addresses_v1';

/**
 * Pure helper to infer hardware module type from real device name reported by OS/Browser.
 */
export function inferBluetoothDeviceType(
  name: string | undefined | null,
  source: 'web-bluetooth' | 'web-serial' = 'web-bluetooth'
): BluetoothDeviceItem['deviceType'] {
  if (source === 'web-serial') return 'USB-Serial';
  const upper = (name || '').toUpperCase();
  if (upper.includes('ESP32') || upper.includes('KAPAL')) return 'ESP32-BLE';
  if (upper.includes('HC-05') || upper.includes('HC-06')) return 'HC-05';
  if (upper.includes('SPP')) return 'ESP32-SPP';
  return 'Generic';
}

/**
 * Inserts or updates a real detected Bluetooth/Serial device in the active list without duplicates.
 */
export function upsertRealBluetoothDevice(
  existing: Omit<BluetoothDeviceItem, 'isFavorite'>[],
  incoming: Omit<BluetoothDeviceItem, 'isFavorite'>
): Omit<BluetoothDeviceItem, 'isFavorite'>[] {
  const index = existing.findIndex(
    (item) => item.id === incoming.id || item.address === incoming.address
  );
  if (index === -1) {
    return [incoming, ...existing];
  }
  const next = [...existing];
  next[index] = {
    ...next[index],
    ...incoming,
  };
  return next;
}

export function loadFavoriteAddresses(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavoriteAddresses(addresses: string[]): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    // Ignore storage quota errors
  }
}
