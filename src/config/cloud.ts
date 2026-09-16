/**
 * 克拉SAY 云端回忆册配置
 * ------------------------------------------------------------------
 * 让所有访客上传的照片同步到云端，任何人打开网站都能浏览同一本回忆册。
 *
 * 三种配置方式（任选其一，环境变量优先级最高）：
 *
 *  1) 环境变量 / .env（推荐，密钥不进源码）
 *     在项目根目录（app/）新建 .env，内容见同目录 .env.example：
 *       VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
 *       VITE_SUPABASE_ANON_KEY=eyJ...很长一串
 *       VITE_SUPABASE_BUCKET=caratsay
 *
 *  2) 直接改本文件里的 FALLBACK 默认值（见下方）
 *
 *  3) 都不填 → 自动降级为「本地模式」：照片只存在访客自己的浏览器里。
 *
 * 获取方式（Supabase 控制台 → Project Settings → Data API）：
 *   - url     = Project URL       （形如 https://xxxxxxxx.supabase.co）
 *   - anonKey = anon / public key （很长的一串 eyJ... 开头的字符串）
 * anon key 是公开密钥，可以安全地放在前端。
 * ------------------------------------------------------------------
 */

/** 方式 2：不想用环境变量时，直接在这里填也行 */
const FALLBACK = {
  url: 'https://dfcpcllldgmdxfrpeiel.supabase.co',
  anonKey: 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU',
  bucket: 'caratsay',
};

const env = import.meta.env as Record<string, string | undefined>;

export const CLOUD_CONFIG = {
  url: env.VITE_SUPABASE_URL || FALLBACK.url,
  anonKey: env.VITE_SUPABASE_ANON_KEY || FALLBACK.anonKey,
  bucket: env.VITE_SUPABASE_BUCKET || FALLBACK.bucket,
};

/** 云端是否已配置 */
export const isCloudEnabled = (): boolean =>
  Boolean(CLOUD_CONFIG.url && CLOUD_CONFIG.anonKey && CLOUD_CONFIG.bucket);
