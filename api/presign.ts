/**
 * Vercel Serverless Function —— 为 Cloudflare R2 生成「临时上传凭证」（presigned URL）
 * 纯静态前端不能持有 R2 密钥，因此由本函数在服务端用密钥签发一个 10 分钟有效的 PUT URL，
 * 浏览器拿到后直接把文件 PUT 到 R2（不经过本函数，省带宽、不受函数体积限制）。
 *
 * 环境变量（在 Vercel 项目 Settings → Environment Variables 配置）：
 *   R2_ACCOUNT_ID            Cloudflare 账户 ID
 *   R2_ACCESS_KEY_ID        R2 API Token 的 Access Key ID
 *   R2_SECRET_ACCESS_KEY    R2 API Token 的 Secret
 *   R2_BUCKET               桶名
 *   R2_PUBLIC_URL           (可选) 自定义域名公开前缀，如 https://cdn.example.com
 *                          不填则回退到 https://<accountId>.r2.cloudflarestorage.com/<bucket>
 *
 * R2 桶需：① 开启公开读；② CORS 允许本站 origin 的 PUT 方法。
 */
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB，与前端上限一致

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { contentType, size, ext } = req.body || {};
    const sz = Number(size);
    if (!contentType || !Number.isFinite(sz) || sz <= 0) {
      res.status(400).json({ error: '参数缺失' });
      return;
    }
    if (sz > MAX_BYTES) {
      res.status(413).json({ error: '文件超过 50MB 上限' });
      return;
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      res.status(500).json({ error: 'R2 未配置（缺少环境变量）' });
      return;
    }

    // 服务端生成 key，避免客户端路径穿越；只允许 media/ 前缀
    const safeExt = String(ext || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8) || 'bin';
    const key = `media/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });

    const publicBase = (
      process.env.R2_PUBLIC_URL ||
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
    ).replace(/\/$/, '');

    res.status(200).json({ uploadUrl, publicUrl: `${publicBase}/${key}`, key });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'presign failed' });
  }
}
