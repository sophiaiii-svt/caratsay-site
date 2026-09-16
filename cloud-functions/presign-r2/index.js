/**
 * presign-r2 · 为 Cloudflare R2 生成「临时上传凭证」（presigned URL）
 * ------------------------------------------------------------------
 * 纯静态前端不能持有 R2 密钥，因此由本云函数（Event Function，与 resolve-link 同模型，
 * 经 CloudBase Web SDK app.callFunction 调用）在服务端用密钥签发一个 10 分钟有效的
 * PUT URL；浏览器拿到后直接把文件 PUT 到 R2（不经过本函数，省带宽、不受函数体积限制）。
 *
 * 纯 Node 实现 AWS SigV4 预签名（零 npm 依赖，避免云函数装 @aws-sdk 出错）。
 *
 * 环境变量（部署后在 CloudBase 控制台 / 本函数 envVariables 配置）：
 *   R2_ACCOUNT_ID         Cloudflare 账户 ID
 *   R2_ACCESS_KEY_ID      R2 API Token 的 Access Key ID
 *   R2_SECRET_ACCESS_KEY  R2 API Token 的 Secret
 *   R2_BUCKET             桶名
 *   R2_PUBLIC_URL         (重要) 桶的公开读取地址，如 https://pub-xxxx.r2.dev
 *                         或你的自定义域名 https://cdn.example.com。
 *                         不填则回退到 S3 API 端点（该端点不提供公开读，卡片会无法显示，
 *                         故强烈建议填写你的 .r2.dev 或自定义域名）。
 *
 * R2 桶需：① 开启「公开读取 / Public bucket」；② CORS 允许本站 origin 的 PUT 方法。
 */

const crypto = require('crypto');

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB，与前端上限一致

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

/* AWS SigV4 UriEncode（RFC3986，仅留 A-Za-z0-9-_.~ 不编码） */
function uriEncode(s) {
  return String(s).replace(/[^A-Za-z0-9\-_.~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
function getSignatureKey(key, dateStamp, region, service) {
  let kDate = hmac('AWS4' + key, dateStamp);
  let kRegion = hmac(kDate, region);
  let kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/* 为 R2 生成 PUT 预签名 URL（region 固定 'auto'） */
function presignPut({ accountId, accessKeyId, secretAccessKey, bucket, key, expires = 600 }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 17); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  const signedHeaders = 'host';

  // 参与签名的查询参数（不含 X-Amz-Signature）
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const finalQuery = `${canonicalQuery}&${uriEncode('X-Amz-Signature')}=${uriEncode(signature)}`;
  return `https://${host}/${bucket}/${key}?${finalQuery}`;
}

function parseInput(event) {
  if (!event) return {};
  if (event.contentType) return event; // callFunction 的 data 直接是 event
  if (event.body) {
    try {
      return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return {};
    }
  }
  return {};
}

function buildPresign(body) {
  const { contentType, size, ext } = body || {};
  const sz = Number(size);
  if (!contentType || !Number.isFinite(sz) || sz <= 0) {
    return { statusCode: 400, data: { error: '参数缺失' } };
  }
  if (sz > MAX_BYTES) {
    return { statusCode: 413, data: { error: '文件超过 50MB 上限' } };
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { statusCode: 500, data: { error: 'R2 未配置（缺少环境变量）' } };
  }

  const safeExt = String(ext || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8) || 'bin';
  const key = `media/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${safeExt}`;

  const uploadUrl = presignPut({ accountId, accessKeyId, secretAccessKey, bucket, key });

  const publicBase = (process.env.R2_PUBLIC_URL || `https://${accountId}.r2.cloudflarestorage.com/${bucket}`)
    .replace(/\/+$/, '');

  return { statusCode: 200, data: { uploadUrl, publicUrl: `${publicBase}/${key}`, key } };
}

exports.main = async (event) => {
  const body = parseInput(event);
  const { statusCode, data } = buildPresign(body);
  return { statusCode, headers: CORS, body: JSON.stringify(data) };
};
