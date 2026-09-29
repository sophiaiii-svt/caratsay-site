/**
 * 上传前图片预处理：手机原图动辄 4~10MB，弱网下极易中途断连。
 * 这里在浏览器本地把超大图等比缩到长边 2048px 并压到 JPEG 0.85，
 * 体积通常能降到原来的 1/5 ~ 1/10，上传成功率和速度都明显提升。
 * 任何一步失败（如 HEIC 无法解码）都安全回退为原文件，不影响上传。
 */
const MAX_EDGE = 2048;
const SIZE_GATE = 2 * 1024 * 1024; // 小于 2MB 的原图不处理，避免无谓损耗

export async function optimizeForUpload(file: File): Promise<File> {
  // 只处理图片，且只处理体积偏大的
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SIZE_GATE) return file;
  // GIF 压缩后会丢帧，跳过
  if (file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE / longest);
    if (scale > 0.9) return file; // 尺寸本来就不大，压缩没意义

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if ('close' in bitmap) (bitmap as ImageBitmap).close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
    if (!blob || blob.size >= file.size) return file; // 压完没变小就用原图

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // 压缩失败不影响上传
  }
}
