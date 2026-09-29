/**
 * 上传前图片预处理 —— 只在「非压不可」时才动原图。
 *
 * 策略（按用户要求）：只有超过上传上限(默认 50MB) 的图片才会被处理，
 * 低于上限的一律原图直传，保留原始画质与元数据。
 * 超过上限时：等比缩到长边 2048px 并逐步降低 JPEG 质量，直到压进上限；
 * 任何一步失败（如 HEIC 无法解码）都安全回退为原文件，不影响上传。
 */
const MAX_EDGE = 2048;
/** 默认触发阈值：50MB（与前端 / 服务端上传上限一致） */
const SIZE_GATE = 50 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));

/**
 * @param gate 触发压缩的体积阈值（字节）。小于它的文件原样返回。
 */
export async function optimizeForUpload(file: File, gate: number = SIZE_GATE): Promise<File> {
  // 只处理图片，且只处理「超过上限、不压传不上去」的
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // GIF 压缩会丢帧
  if (file.size <= gate) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE / longest);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if ('close' in bitmap) (bitmap as ImageBitmap).close();

    // 从 0.9 起逐档降质量，直到压进上限
    let quality = 0.9;
    let blob = await toBlob(canvas, quality);
    while (blob && blob.size > gate && quality > 0.4) {
      quality -= 0.1;
      blob = await toBlob(canvas, quality);
    }
    if (!blob || blob.size >= file.size) return file; // 压不动就用原图

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // 压缩失败不影响上传
  }
}
