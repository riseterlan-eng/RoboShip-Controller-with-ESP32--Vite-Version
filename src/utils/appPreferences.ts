export type MaritimeThemeId =
  | 'deep-ocean'
  | 'sonar-grid'
  | 'twilight-harbor'
  | 'uro-logo'
  | 'custom';

export interface WallpaperConfig {
  themeId: MaritimeThemeId;
  customImageDataUrl: string | null;
  scrimOpacity: number; // 0.35 .. 0.90
}

export const WALLPAPER_STORAGE_KEY = 'kapalrc_wallpaper_v3';

export const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  themeId: 'uro-logo',
  customImageDataUrl: null,
  scrimOpacity: 0.45,
};

export interface MaritimePresetMeta {
  id: Exclude<MaritimeThemeId, 'custom'>;
  label: string;
  subtitle: string;
  previewBg: string;
  imageUrl?: string;
}

export const MARITIME_PRESETS: MaritimePresetMeta[] = [
  {
    id: 'uro-logo',
    label: 'Logo EURO FT-UNSRAT',
    subtitle: 'Wallpaper awal & gambar unggahan tim KAPAL KARAM',
    previewBg: '#FFFFFF',
    imageUrl: '/assets/aistudio/image_0af4d8d3.png',
  },
  {
    id: 'deep-ocean',
    label: 'Samudra Malam',
    subtitle: 'Biru laut dalam & pendar radar anjungan',
    previewBg: 'radial-gradient(circle at 50% 20%, #0C3554 0%, #06131F 72%)',
  },
  {
    id: 'sonar-grid',
    label: 'Peta Sonar',
    subtitle: 'Kisi koordinat hidrografi & jalur pelayaran',
    previewBg: 'radial-gradient(circle at 30% 25%, #0E3B4C 0%, #051622 75%)',
  },
  {
    id: 'twilight-harbor',
    label: 'Senja Dermaga',
    subtitle: 'Gradasi cakrawala senja & kuning kuningan kapal',
    previewBg: 'linear-gradient(155deg, #102A43 0%, #081C2E 55%, #1D2B3A 100%)',
  },
];

export function clampScrimOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WALLPAPER_CONFIG.scrimOpacity;
  return Math.max(0.15, Math.min(0.85, Number(value.toFixed(2))));
}

export function sanitizeWallpaperConfig(raw: unknown): WallpaperConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WALLPAPER_CONFIG };
  }
  const obj = raw as Partial<WallpaperConfig>;
  const validThemes: MaritimeThemeId[] = [
    'deep-ocean',
    'sonar-grid',
    'twilight-harbor',
    'uro-logo',
    'custom',
  ];
  const themeId = validThemes.includes(obj.themeId as MaritimeThemeId)
    ? (obj.themeId as MaritimeThemeId)
    : DEFAULT_WALLPAPER_CONFIG.themeId;

  const customImageDataUrl =
    typeof obj.customImageDataUrl === 'string' &&
    obj.customImageDataUrl.startsWith('data:image/')
      ? obj.customImageDataUrl
      : null;

  return {
    themeId:
      themeId === 'custom' && !customImageDataUrl ? DEFAULT_WALLPAPER_CONFIG.themeId : themeId,
    customImageDataUrl,
    scrimOpacity: clampScrimOpacity(
      typeof obj.scrimOpacity === 'number'
        ? obj.scrimOpacity
        : DEFAULT_WALLPAPER_CONFIG.scrimOpacity
    ),
  };
}

export function loadWallpaperConfig(): WallpaperConfig {
  try {
    const raw = localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WALLPAPER_CONFIG };
    return sanitizeWallpaperConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WALLPAPER_CONFIG };
  }
}

export function saveWallpaperConfig(config: WallpaperConfig): boolean {
  try {
    localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(sanitizeWallpaperConfig(config)));
    return true;
  } catch {
    return false;
  }
}

export function clearWallpaperConfig(): WallpaperConfig {
  try {
    localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
  return { ...DEFAULT_WALLPAPER_CONFIG };
}

/**
 * Detects private AI Studio development preview hostnames (ais-dev-*) that cannot be opened by other users.
 */
export function isPrivateDevPreviewOrigin(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return /^ais-dev-/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Converts a private AI Studio dev origin (https://ais-dev-...) into the public Shared App origin
 * (https://ais-pre-...) so QR codes and shared links work when sent to other people.
 * Leaves custom domains (Vercel, localhost, ais-pre-*) untouched.
 */
export function resolveShareableOrigin(rawOriginOrUrl: string): string {
  const trimmed = rawOriginOrUrl.trim();
  if (!trimmed) return 'https://kapalrc-bridge.vercel.app';

  try {
    const parsed = new URL(trimmed);
    if (/^ais-dev-/i.test(parsed.hostname)) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/i, 'ais-pre-');
    }
    return parsed.origin;
  } catch {
    return trimmed;
  }
}

/**
 * Converts a full URL (preserving path & query params) to its public shareable form when needed.
 */
export function resolveShareableUrl(rawHref: string): string {
  const trimmed = rawHref.trim();
  if (!trimmed) return '/';
  try {
    const parsed = new URL(trimmed);
    if (/^ais-dev-/i.test(parsed.hostname)) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/i, 'ais-pre-');
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Normalizes a custom deployment URL (e.g. Vercel URL) or falls back to shareable current origin.
 */
export function normalizeShareUrl(rawUrl: string, fallbackUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return resolveShareableOrigin(fallbackUrl);

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return resolveShareableOrigin(fallbackUrl);
    }
    if (/^ais-dev-/i.test(parsed.hostname)) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/i, 'ais-pre-');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return resolveShareableOrigin(fallbackUrl);
  }
}

/**
 * Copies text reliably across standard browsers, embedded iframes, and mobile in-app WebViews.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when Permissions-Policy blocks navigator.clipboard inside iframes
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Compresses and resizes a user-selected image file on an offscreen canvas so it fits cleanly
 * in localStorage and renders rapidly as a custom cockpit wallpaper.
 */
export function compressImageFileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('File gambar kosong.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung oleh browser.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
