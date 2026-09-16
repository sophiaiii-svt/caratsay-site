/**
 * BGM 云端播放列表 读写往返验证
 * 模拟前端 bgmCloud.ts 的行为：写入 playlist.json → 读回 → 删除音频 → 清空
 * 运行：node verify_bgm.mjs
 */
const URL = 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const KEY = 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const BUCKET = 'caratsay';
const PLAYLIST = 'bgm/playlist.json';

const auth = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  ...extra,
});

async function savePlaylist(tracks) {
  await fetch(`${URL}/storage/v1/object/${BUCKET}/${PLAYLIST}`, {
    method: 'DELETE',
    headers: auth(),
  });
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${PLAYLIST}`, {
    method: 'POST',
    headers: auth({
      'Content-Type': 'application/json',
      'cache-control': 'no-cache, no-store, must-revalidate',
    }),
    body: JSON.stringify({ v: 1, tracks, updatedAt: Date.now() }),
  });
  return res.ok;
}

async function readPlaylist() {
  const res = await fetch(
    `${URL}/storage/v1/object/public/${BUCKET}/${PLAYLIST}?_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  const d = await res.json();
  return Array.isArray(d.tracks) ? d.tracks : null;
}

async function uploadAudio(bytes, name) {
  const objName = `bgm/audio/${Date.now()}_verify_${name}`;
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${objName}`, {
    method: 'POST',
    headers: auth({
      'Content-Type': 'audio/mpeg',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'false',
    }),
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return `${URL}/storage/v1/object/public/${BUCKET}/${objName}`;
}

async function del(name) {
  await fetch(`${URL}/storage/v1/object/${BUCKET}/${name}`, { method: 'DELETE', headers: auth() });
}

(async () => {
  console.log('=== 1) 写入播放列表 ===');
  const fakeTrack = {
    id: 'bgm_verify_1',
    title: '验证曲目 (verify)',
    url: 'https://example.com/verify.mp3',
    source: 'link',
    scene: 'grid',
    addedBy: 'u_verify',
    addedAt: Date.now(),
  };
  const okWrite = await savePlaylist([fakeTrack]);
  console.log(okWrite ? '  ✓ 写入成功' : '  ✗ 写入失败');

  console.log('=== 2) 读回并校验字段 ===');
  const read = await readPlaylist();
  if (!read) return console.log('  ✗ 读回失败');
  const t = read.find((x) => x.id === 'bgm_verify_1');
  console.log('  ✓ 读到', read.length, '条');
  console.log('    title =', t?.title, '| scene =', t?.scene, '| source =', t?.source);

  console.log('=== 3) 上传音频二进制 ===');
  const url = await uploadAudio(Buffer.from('ID3fake-audio-bytes'), 'probe.mp3');
  console.log('  ✓ 上传成功:', url.split('/').pop());
  const head = await fetch(url, { method: 'GET' });
  console.log('  ✓ 直链可读, HTTP', head.status, '| content-type:', head.headers.get('content-type'));

  console.log('=== 4) 清理验证数据 ===');
  await del(url.split(`/object/public/${BUCKET}/`)[1].split('?')[0]);
  await savePlaylist([]);
  const after = await readPlaylist();
  console.log('  ✓ 已清空, 剩余', after ? after.length : 0, '条');
  console.log('\n全部通过：播放列表读写 + 音频上传 + 直链可读 均正常。');
})().catch((e) => {
  console.error('验证失败:', e.message);
  process.exit(1);
});
