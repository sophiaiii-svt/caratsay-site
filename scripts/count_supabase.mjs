// 只读统计 Supabase caratsay 桶各区域数据量（用于规划迁移）
const URL = 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const KEY = 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const BUCKET = 'caratsay';

async function list(prefix) {
  const res = await fetch(`${URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) throw new Error(`list ${prefix} -> ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function isPhoto(name) {
  return /\w+__\d+__[\w\d]+\.(jpg|jpeg|png|webp|gif|mp4|webm|mov|avi|mkv)$/i.test(name);
}

const out = {};
let totalBytes = 0;

// 1) updates/ (动态 JSON)
const upd = await list('updates/');
out.updates_json = upd.length;
upd.forEach((r) => (totalBytes += Number(r?.metadata?.size || 0)));

// 2) meta/feed-edits/
const fe = await list('meta/feed-edits/');
out.feed_edits = fe.length;
fe.forEach((r) => (totalBytes += Number(r?.metadata?.size || 0)));

// 3) meta/media/ (两级：item 文件夹 -> 访客 json)
const mediaFolders = await list('meta/media/');
let mediaFiles = 0;
for (const f of mediaFolders) {
  const fn = f?.name;
  if (!fn) continue;
  const sub = await list(`meta/media/${fn}/`);
  mediaFiles += sub.length;
  sub.forEach((r) => (totalBytes += Number(r?.metadata?.size || 0)));
}
out.media_overlay_folders = mediaFolders.length;
out.media_overlay_files = mediaFiles;

// 4) 桶根（克拉SAY 照片等）
const root = await list('');
const rootPhotos = root.filter((r) => r?.name && isPhoto(r.name));
const rootOthers = root.filter((r) => r?.name && !isPhoto(r.name));
out.caratsay_photos = rootPhotos.length;
out.root_nonphoto = rootOthers.length;
out.root_nonphoto_names_sample = rootOthers.slice(0, 20).map((r) => r.name);
rootPhotos.forEach((r) => (totalBytes += Number(r?.metadata?.size || 0)));

out.total_bytes_approx = totalBytes;
out.total_mb_approx = (totalBytes / 1024 / 1024).toFixed(2);

console.log(JSON.stringify(out, null, 2));
