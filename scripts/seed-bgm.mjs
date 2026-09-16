/**
 * 把站长提供的三首 SEVENTEEN 曲目上传为克拉SAY 的预置 BGM
 *
 * 对应场景（与克拉SAY 三种视图绑定，切换视图会自动换歌）：
 *   us again.m4a        -> grid      (网格)
 *   cheers to youth.m4a -> book      (回忆册)
 *   Circles.m4a         -> slideshow (放映)
 *
 * addedBy 固定为 'site-owner'，因此普通访客无法删除（canDeleteTrack 会返回 false）。
 * 运行：node scripts/seed-bgm.mjs
 */
import { readFileSync } from 'node:fs';

const URL = 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const KEY = 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const BUCKET = 'caratsay';
const PLAYLIST = 'bgm/playlist.json';
const DESKTOP = 'C:\\Users\\EDY\\Desktop';

const TRACKS = [
  {
    file: 'us again.m4a',
    obj: 'bgm/audio/site_us-again.m4a',
    title: 'US again',
    scene: 'grid',
  },
  {
    file: 'cheers to youth.m4a',
    obj: 'bgm/audio/site_cheers-to-youth.m4a',
    title: '青春赞歌 (Cheers)',
    scene: 'book',
  },
  {
    file: 'Circles.m4a',
    obj: 'bgm/audio/site_circle.m4a',
    title: 'Circle',
    scene: 'slideshow',
  },
];

const auth = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra });

async function upload(track) {
  const buf = readFileSync(`${DESKTOP}\\${track.file}`);
  // m4a 的正确 MIME：audio/mp4（不能写 audio/mpeg，否则部分浏览器拒绝播放）
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${track.obj}`, {
    method: 'POST',
    headers: auth({
      'Content-Type': 'audio/mp4',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'true', // 允许重跑本脚本覆盖旧文件
    }),
    body: buf,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`上传 ${track.file} 失败 (${res.status}) ${detail}`);
  }
  return `${URL}/storage/v1/object/public/${BUCKET}/${track.obj}`;
}

(async () => {
  console.log('=== 上传音频到云端 ===');
  const built = [];
  for (const t of TRACKS) {
    const url = await upload(t);
    console.log(`  ✓ ${t.file.padEnd(24)} → ${t.obj}`);
    built.push({
      id: `site_${t.scene}`,
      title: t.title,
      artist: 'SEVENTEEN',
      url,
      source: 'cloud',
      scene: t.scene,
      addedBy: 'site-owner', // 站长预置，访客不可删
      addedAt: Date.now(),
    });
  }

  console.log('\n=== 写入播放列表 ===');
  // 先删后插：anon 不能 upsert
  await fetch(`${URL}/storage/v1/object/${BUCKET}/${PLAYLIST}`, { method: 'DELETE', headers: auth() });
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${PLAYLIST}`, {
    method: 'POST',
    headers: auth({
      'Content-Type': 'application/json',
      'cache-control': 'no-cache, no-store, must-revalidate',
    }),
    body: JSON.stringify({ v: 1, tracks: built, updatedAt: Date.now() }),
  });
  if (!res.ok) throw new Error(`播放列表写入失败 (${res.status})`);
  console.log(`  ✓ 已写入 ${built.length} 首`);

  console.log('\n=== 验证直链可访问 ===');
  for (const t of built) {
    const r = await fetch(t.url, { method: 'GET', headers: { Range: 'bytes=0-1' } });
    const ct = r.headers.get('content-type');
    console.log(`  ${r.status === 200 || r.status === 206 ? '✓' : '✗'} ${t.title.padEnd(20)} HTTP ${r.status} | ${ct}`);
  }

  console.log('\n完成。三首预置 BGM 已生效，所有访客可见。');
})().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});
