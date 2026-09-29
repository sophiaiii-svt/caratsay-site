/**
 * 网络请求稳定性工具：超时控制 + 指数退避重试。
 * 上传链路（R2 / Supabase）都复用这两件武器，避免「一直转圈」或「一抖动就整单失败」。
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 带超时控制的 fetch：卡住的请求会被主动中断，便于快速切通道或重试 */
export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error(`请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 只对网络类抖动重试（超时 / 断连），业务错误（4xx）立即返回，不浪费时间 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseDelay = 700): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message || '');
      const transient = /超时|timeout|Failed to fetch|NetworkError|network|终止|abort|断/i.test(msg);
      if (!transient || i === tries - 1) break;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw lastErr;
}
