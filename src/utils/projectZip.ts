import JSZip from 'jszip';
import { RAW_PROJECT_FILES } from './projectFilesGlob';

const SELF_GLOB_FILE_CONTENT = `export const RAW_PROJECT_FILES: Record<string, string> = import.meta.glob(
  [
    '/index.html',
    '/controller.html',
    '/landing.css',
    '/landing.js',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/vercel.json',
    '/README.md',
    '/.env.example',
    '/.gitignore',
    '/.vscode/extensions.json',
    '/.vscode/settings.json',
    '/public/icon.svg',
    '/public/icon-maskable.svg',
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/src/**/*.css',
    '!/src/**/*.test.ts',
    '!/src/utils/projectFilesGlob.ts',
  ],
  { query: '?raw', import: 'default', eager: true }
);
`;

const PUBLIC_BINARY_ICONS = [
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
  'apple-touch-icon.png',
  'assets/aistudio/image_0af4d8d3.png',
];

/**
 * Generates a ready-to-run ZIP archive for the complete Web App (VS Code + GitHub + Vercel + PWA).
 */
export async function generateProjectZipBlob(): Promise<Blob> {
  const zip = new JSZip();

  for (const [rawPath, content] of Object.entries(RAW_PROJECT_FILES)) {
    const normalized = rawPath.replace(/^\/+/, '');
    zip.file(normalized, content);
  }

  // Ensure the glob helper itself is included so `npm run build` succeeds after unzip
  zip.file('src/utils/projectFilesGlob.ts', SELF_GLOB_FILE_CONTENT);

  // Fetch static PWA binary icons from public/
  await Promise.all(
    PUBLIC_BINARY_ICONS.map(async (filename) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${filename}`);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          zip.file(`public/${filename}`, buf);
        }
      } catch {
        // Skip if offline and icon fetch unavailable
      }
    })
  );

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
