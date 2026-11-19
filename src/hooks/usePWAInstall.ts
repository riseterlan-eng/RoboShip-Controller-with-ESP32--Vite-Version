import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface BeforeInstallPromptWindow extends Window {
  __kapalrcDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
}

export interface PlatformDetectionResult {
  isAndroid: boolean;
  isIOS: boolean;
  isIOSSafari: boolean;
  isInIframe: boolean;
}

/**
 * Pure platform detector covering Android, iPhone, iPad (including iPadOS Macintosh UA),
 * and embedded iframe context.
 */
export function detectMobilePlatform(
  userAgent: string,
  maxTouchPoints = 0,
  isInIframe = false
): PlatformDetectionResult {
  const ua = userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIPhoneIPadIPod = /iphone|ipad|ipod/i.test(ua);
  const isIPadOSDesktopUA = /macintosh/i.test(ua) && maxTouchPoints > 1;
  const isIOS = isIPhoneIPadIPod || isIPadOSDesktopUA;

  const isNonSafariIOSBrowser = /crios|fxios|edgios|opios|fban|fbav|instagram|line|whatsapp/i.test(
    ua
  );
  const isIOSSafari = isIOS && /safari/i.test(ua) && !isNonSafariIOSBrowser;

  return {
    isAndroid,
    isIOS,
    isIOSSafari,
    isInIframe,
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === 'undefined') return null;
    return (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt ?? null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<PlatformDetectionResult>(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { isAndroid: false, isIOS: false, isIOSSafari: false, isInIframe: false };
    }
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    return detectMobilePlatform(navigator.userAgent, navigator.maxTouchPoints || 0, inIframe);
  });

  useEffect(() => {
    const checkStandalone = () => {
      try {
        return (
          window.matchMedia?.('(display-mode: standalone)').matches ||
          window.matchMedia?.('(display-mode: fullscreen)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true
        );
      } catch {
        return false;
      }
    };

    setIsInstalled(checkStandalone());

    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    setPlatform(
      detectMobilePlatform(
        window.navigator.userAgent,
        window.navigator.maxTouchPoints || 0,
        inIframe
      )
    );

    // Sync any prompt captured during early boot in main.tsx
    const earlyPrompt = (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt = evt;
      setDeferredPrompt(evt);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt = null;
    };

    const standaloneQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayModeChange = () => {
      setIsInstalled(checkStandalone());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent =
      deferredPrompt ?? (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as BeforeInstallPromptWindow).__kapalrcDeferredInstallPrompt = null;
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isAndroid: platform.isAndroid,
    isIOS: platform.isIOS,
    isIOSSafari: platform.isIOSSafari,
    isInIframe: platform.isInIframe,
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
