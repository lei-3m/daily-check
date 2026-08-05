/** 네트워크 응답을 기다리는 상한. 넘으면 오프라인과 동일하게 다룹니다. */
export const NETWORK_TIMEOUT_MS = 8000;

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * 응답이 오지 않는 네트워크에서 화면이 멈추지 않도록 상한을 둡니다.
 * navigator.onLine이 true여도 실제 연결이 없는 경우가 있습니다
 * (캡티브 포털, 죽은 Wi-Fi).
 *
 * 시간을 넘겨도 요청 자체는 취소되지 않습니다. 뒤늦게 성공하더라도
 * 이어지는 코드를 실행하지 않으므로 상태는 건드리지 않습니다.
 */
export async function withTimeout<T>(
  operation: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}
