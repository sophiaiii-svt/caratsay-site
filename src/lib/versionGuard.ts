/**
 * 版本守卫：防止用户浏览器长期停留在旧版代码上。
 * ------------------------------------------------------------------
 * 踩过的坑：手机端缓存了部署前的旧 JS，上传照片时按「旧数据结构」写入，
 * 结果电脑端按新结构读取就看不到——两端代码不一致导致数据对不上。
 *
 * 做法：页面启动时记下当前入口 JS 文件名（vite 构建后带 content hash，
 * 内容变了文件名就变），之后定时拉取首页 HTML 比对入口文件名，
 * 一旦发现不一致说明已发布新版本，自动刷新一次（用 sessionStorage 防止刷新死循环）。
 */

const CHECK_INTERVAL = 3 * 60 * 1000; // 3 分钟
const RELOADED_FLAG = 'svt_reloaded_for';

/** 当前页面实际加载的入口 JS 文件名，如 index-DYxOI6Ec.js */
function currentEntry(): string | null {
  try {
    const el = document.querySelector<HTMLScriptElement>('script[src*="/assets/"]');
    if (el) {
      const m = el.src.match(/\/assets\/(index-[^"']+\.js)/);
      if (m) return m[1];
    }
    // 兜底：从已加载的资源里找
    for (const entry of performance.getEntriesByType('resource')) {
      const m = entry.name.match(/\/assets\/(index-[^"']+\.js)/);
      if (m) return m[1];
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 拉取线上首页，解析出最新的入口 JS 文件名 */
async function remoteEntry(): Promise<string | null> {
  try {
    const res = await fetch(`${location.origin}/?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\/assets\/(index-[^"']+\.js)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function startVersionGuard(): () => void {
  const mine = currentEntry();
  if (!mine) return () => {};

  let stopped = false;

  const check = async () => {
    if (stopped || document.hidden) return; // 页面在后台时不打扰
    const latest = await remoteEntry();
    if (stopped || !latest || latest === mine) return;
    // 只对「同一个新版本」自动刷新一次，避免反复刷新
    const done = sessionStorage.getItem(RELOADED_FLAG);
    if (done === latest) return;
    sessionStorage.setItem(RELOADED_FLAG, latest);
    window.location.reload();
  };

  const timer = window.setInterval(check, CHECK_INTERVAL);
  // 页面重新可见时也查一次（手机切后台再回来很常见）
  const onVisible = () => {
    if (!document.hidden) void check();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
