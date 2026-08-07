import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 새 서비스 워커가 준비되었는지 지켜본다.
 *
 * 배포 직후에도 이미 열려 있는 탭은 옛 화면 그대로다. 자동으로 새로고침하면
 * 작성 중인 내용이 날아가므로, 알리기만 하고 새로고침은 사용자가 누를 때 한다.
 */
export function useServiceWorkerUpdate() {
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    // 첫 방문(컨트롤러 없음)은 새 버전이 아니라 설치다. 알리지 않는다.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const markReady = () => {
      if (!cancelled && hadController) setIsUpdateReady(true);
    };

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      if (worker.state === 'installed' || worker.state === 'activated') {
        markReady();
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' || worker.state === 'activated') markReady();
      });
    };

    // 다른 탭에서 새 워커가 활성화된 경우에도 이 탭은 옛 화면을 들고 있다.
    const handleControllerChange = () => markReady();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        watchWorker(registration.waiting);
        watchWorker(registration.installing);
        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing);
        });
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });

    // 오래 열어둔 탭도 돌아올 때마다 새 배포를 확인한다.
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      registrationRef.current?.update().catch(() => {
        /* 네트워크가 없으면 다음 기회에 */
      });
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('focus', checkForUpdate);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, []);

  return { isUpdateReady, applyUpdate };
}
