export const RAW_PROJECT_FILES: Record<string, string> = import.meta.glob(
  [
    '/index.html',
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
