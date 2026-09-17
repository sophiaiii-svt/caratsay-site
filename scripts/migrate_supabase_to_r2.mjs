/**
 * 一次性迁移：把 Supabase `caratsay` 桶的全部内容递归复制到 Cloudflare R2。
 * 目的：把现有「动态 / 克拉SAY / bgm / quotes / 同步feed」等所有云端数据，
 *       完整搬进新的永久库（R2），作为独立备份；当前站点仍读 Supabase，内容不变。
 *
 * 用法（在 app/ 目录下，需已 npm install 含 @aws-sdk）：
 *   DRY_RUN=1 \
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET=caratsay-media \
 *   node scripts/migrate_supabase_to_r2.mjs        # 先干跑看数量
 *   # 去掉 DRY_RUN=1 即执行真实复制
 *
 * 说明：
 *   - 源桶为公开读，用 anon key 列目录 + 公开 URL 下载（只读，不写源）。
 *   - 目标用 R2 S3 API 直传，Key 与源完全一致（根照片留在根，updates/、meta/ 保持原结构）。
 *   - 已存在于 R2 的同名 Key 会被覆盖（幂等，可重复跑）。
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const SRC_URL = 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const SRC_KEY = 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const SRC_BUCKET = 'caratsay';

const DRY = process.env.DRY_RUN === '1';
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET;

async function list(prefix) {
  const res = await fetch(`${SRC_URL}/storage/v1/object/list/${SRC_BUCKET}`, {
    method: 'POST',
    headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) throw new Error(`list ${prefix} -> ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

let copied = 0;
let bytes = 0;

async function walk(prefix) {
  const rows = await list(prefix);
  for (const r of rows) {
    const name = r?.name;
    if (!name) continue;
    const isFile = r?.metadata && r.metadata.size != null;
    if (isFile) {
      const fullKey = prefix + name;
      const size = Number(r.metadata.size);
      if (DRY) {
        copied++;
        bytes += size;
        if (copied <= 30) console.log(`[dry] ${fullKey} (${size}B)`);
        continue;
      }
      const dl = await fetch(`${SRC_URL}/storage/v1/object/public/${SRC_BUCKET}/${fullKey}`);
      if (!dl.ok) {
        console.error(`下载失败 ${fullKey} -> ${dl.status}`);
        continue;
      }
      const buf = Buffer.from(await dl.arrayBuffer());
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: fullKey,
          Body: buf,
          ContentType: dl.headers.get('content-type') || 'application/octet-stream',
        }),
      );
      copied++;
      bytes += buf.length;
      if (copied % 25 === 0) console.log(`已复制 ${copied} 个 (${(bytes / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      // 文件夹：递归
      await walk(prefix + name + '/');
    }
  }
}

console.log(DRY ? '=== DRY RUN（仅统计，不写入 R2）===' : '=== 开始复制到 R2 ===');
await walk('');
console.log(
  DRY
    ? `干跑完成：将复制约 ${copied} 个对象，约 ${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `复制完成：共 ${copied} 个对象，${(bytes / 1024 / 1024).toFixed(2)} MB`
);
