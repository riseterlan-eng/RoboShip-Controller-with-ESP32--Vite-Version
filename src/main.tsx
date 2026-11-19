import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface BeforeInstallPromptWindow extends Window {
  __kapalrcDeferredInstallPrompt?: Event | null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt = e;
  });
}

createRoot(document.getElementById('root')!).render(<App />);
