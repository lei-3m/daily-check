import { useCallback, useEffect, useState } from 'react';
import {
  getInstallBannerDismissal,
  recordInstallBannerDismissal,
  type InstallBannerDismissal,
} from './storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** 'prompt' = 브라우저 설치 프롬프트를 띄울 수 있음, 'ios' = 안내 문구만, 'none' = 표시하지 않음 */
export type InstallBannerMode = 'none' | 'prompt' | 'ios';

// beforeinstallprompt는 페이지 로드 직후 한 번 발생한다. React가 마운트되기 전에
// 지나가면 다시 오지 않으므로, 모듈이 읽히는 시점에 바로 받아 둔다.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // 기본 미니 인포바를 막고 우리 배너에서 띄운다.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  // 설치했다고 "닫음"으로 기록하지 않는다. 설치 상태는 standalone으로 판단한다.
  // 나중에 지운 사용자에게는 안내가 다시 뜨는 편이 자연스럽다.
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    isInstalled = true;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // iOS 사파리는 display-mode 대신 navigator.standalone을 쓴다.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * iOS 사파리인지. 홈 화면 추가는 사파리에서만 되고, iOS의 크롬·파이어폭스에서는
 * 안내해도 그 메뉴가 없다.
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS는 데스크톱 사파리처럼 보고한다.
    (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Brave/.test(ua);
}

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const PERMANENT_DISMISS_COUNT = 2;

// 한 번 닫으면 7일 쉬었다가 다시, 두 번째로 닫으면 영구 숨김.
// 배너가 하단 액션 버튼과 가까워 실수로 닫는 경우가 있다.
function isSnoozed(dismissal: InstallBannerDismissal, now: number): boolean {
  if (dismissal.count >= PERMANENT_DISMISS_COUNT) return true;
  if (dismissal.count === 0) return false;
  // 기기 시계가 앞당겨졌다 돌아온 경우(음수)도 아직 쉬는 중으로 본다.
  return now - dismissal.lastDismissedAt < SNOOZE_MS;
}

/**
 * 홈 화면 추가 안내의 상태.
 *
 * - `installMode`: 이 기기에서 설치를 안내할 수 있는가. 계정 메뉴 항목이 쓴다.
 *   닫힘 기록과 무관하다. 메뉴는 언제든 열려 있어야 한다.
 * - `bannerMode`: 하단 배너를 지금 띄울 것인가. 닫힘 기록까지 반영한다.
 */
export function useInstallBanner() {
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => deferredPrompt !== null);
  const [isHiddenForSession, setIsHiddenForSession] = useState<boolean>(() => isInstalled);
  const [dismissal, setDismissal] = useState<InstallBannerDismissal>(getInstallBannerDismissal);

  useEffect(() => {
    const sync = () => {
      setHasPrompt(deferredPrompt !== null);
      if (isInstalled) setIsHiddenForSession(true);
    };
    subscribers.add(sync);
    sync();
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  const installMode: InstallBannerMode = (() => {
    if (isStandalone()) return 'none';
    if (hasPrompt) return 'prompt';
    if (isIosSafari()) return 'ios';
    return 'none';
  })();

  const bannerMode: InstallBannerMode =
    isHiddenForSession || isSnoozed(dismissal, Date.now()) ? 'none' : installMode;

  const dismiss = useCallback(() => {
    setDismissal(recordInstallBannerDismissal(Date.now()));
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return;
    // prompt()는 한 이벤트로 한 번만 쓸 수 있다.
    deferredPrompt = null;
    setHasPrompt(false);
    try {
      await event.prompt();
      await event.userChoice;
      // 어느 쪽이든 이 이벤트는 다 썼으므로 배너를 내린다.
      // 닫음으로 기록하지는 않는다. ✕를 누른 것이 아니다.
      setIsHiddenForSession(true);
    } catch (error) {
      console.error('Install prompt failed:', error);
      setIsHiddenForSession(true);
    }
  }, []);

  return { bannerMode, installMode, dismiss, promptInstall };
}
