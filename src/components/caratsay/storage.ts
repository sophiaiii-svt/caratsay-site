import type { LocalImage } from './types';

export const STORAGE_KEY = 'caratsay_images';
export const MINE_KEY = 'caratsay_mine';
export const MAX_IMAGES = 200;
const COMPRESS_MAX_WIDTH = 1400;
const COMPRESS_QUALITY = 0.82;

/** 压缩图片，同时产出 dataURL（本地兜底）与 Blob（云端上传） */
export function compressImage(
  file: File
): Promise<{ data: string; blob: Blob; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片加载失败'));
      img.onload = () => {
        let { width, height } = img;
        if (width > COMPRESS_MAX_WIDTH) {
          height = Math.round((height * COMPRESS_MAX_WIDTH) / width);
          width = COMPRESS_MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('浏览器不支持 Canvas'));
          return;
        }
        // JPEG 无透明通道，先铺白底避免变黑
        const isPng = file.type === 'image/png';
        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mime = isPng ? 'image/png' : 'image/jpeg';
        const data = canvas.toDataURL(mime, COMPRESS_QUALITY);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }
            resolve({ data, blob, w: width, h: height });
          },
          mime,
          COMPRESS_QUALITY
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** 安全读取本地照片 */
export function loadLocal(): LocalImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i) =>
        i &&
        typeof i.id === 'string' &&
        typeof i.section === 'string' &&
        typeof i.data === 'string' &&
        typeof i.timestamp === 'number'
    );
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
}

/** 安全写入本地照片，空间不足时自动淘汰旧图 */
export function saveLocal(images: LocalImage[]): { ok: boolean; error?: string } {
  const attempt = (list: LocalImage[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };
  try {
    attempt(images);
    return { ok: true };
  } catch {
    for (const ratio of [0.7, 0.5, 0.3]) {
      try {
        attempt(images.slice(0, Math.max(1, Math.floor(images.length * ratio))));
        return { ok: true };
      } catch {
        /* 继续缩减 */
      }
    }
    return { ok: false, error: '浏览器存储空间不足' };
  }
}

/** 读取「我上传过的云端照片 id」 */
export function loadMine(): Set<string> {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function saveMine(ids: Set<string>): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function localStorageSize(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '0 KB';
    return humanSize(new Blob([raw]).size);
  } catch {
    return '未知';
  }
}
