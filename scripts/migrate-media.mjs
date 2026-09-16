/**
 * 一次性数据迁移：把旧版写进 meta/feed-edits/{id}.json 的 media 字段，
 * 迁移到新版「多人各自叠加」结构 meta/media/{id}/{pubId}.json。
 *
 * 背景：旧版（含手机端缓存的旧 JS）把媒体登记在编辑覆盖层里，
 * 一旦有人再编辑该条的标题/日期，media 会被整段覆盖丢失；
 * 而且旧结构是「单人一份」，不满足多人各自叠加。
 *
 * 运行：node scripts/migrate-media.mjs
 */
const URL = 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const KEY = 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const BUCKET = 'caratsay';

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};
const NO_CACHE = { ...H, 'Content-Type': 'application/json', 'cache-control': 'no-cache, no-store, must-revalidate' };
const OWNER = 'migrated'; // 迁移数据的归属键（不是任何真实访客 id）

const objUrl = (name) => `${URL}/storage/v1/object/${BUCKET}/${name}`;
const pubUrl = (name) => `${URL}/storage/v1/object/public/${BUCKET}/${name}`;

async function readJson(name) {
  const r = await fetch(`${pubUrl(name)}?_t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

async function writeJson(name, data) {
  await fetch(objUrl(name), { method: 'DELETE', headers: H }).catch(() => {});
  const r = await fetch(objUrl(name), {
    method: 'POST',
    headers: { ...NO_CACHE, 'x-upsert': 'false' },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`${name} 写入失败 ${r.status} ${d?.message || ''}`);
  }
  return true;
}

/** 孤儿媒体：uploadMediaFile 传成功但索引没登记，需要手工归位 */
const ORPHANS = [
  {
    itemId: 'u206', // 净汉小红书开号首条 · 描述明确写「视频」，且此前没有任何媒体
    media: [
      {
        url: pubUrl('media/1787974761826_6ait7i_mmexport1787974482163.mp4'),
        type: 'video',
        name: 'mmexport1787974482163.mp4',
      },
    ],
  },
];

async function main() {
  // 1) 找出所有带 media 的旧编辑覆盖层
  const listRes = await fetch(`${URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: 'meta/feed-edits/', limit: 1000, offset: 0 }),
  });
  const rows = await listRes.json();
  const names = (Array.isArray(rows) ? rows : []).map((r) => r?.name).filter((n) => n?.endsWith('.json'));

  let migrated = 0;
  for (const n of names) {
    const d = await readJson(`meta/feed-edits/${n}`);
    if (!d || !Array.isArray(d.media) || d.media.length === 0) continue;
    const itemId = n.slice(0, -'.json'.length);
    console.log(`→ 迁移 ${itemId}：${d.media.length} 个媒体`);

    // 写新结构
    await writeJson(`meta/media/${itemId}/${OWNER}.json`, { media: d.media });
    // 从旧覆盖层移除 media 字段（保留其余编辑内容）
    const { media: _drop, ...rest } = d;
    await writeJson(`meta/feed-edits/${n}`, rest);
    migrated++;
  }

  // 2) 归位孤儿媒体
  for (const o of ORPHANS) {
    console.log(`→ 归位孤儿媒体到 ${o.itemId}：${o.media.length} 个`);
    await writeJson(`meta/media/${o.itemId}/${OWNER}.json`, { media: o.media });
    migrated++;
  }

  console.log(migrated ? `\n✓ 迁移完成，共处理 ${migrated} 项` : '\n· 没有需要迁移的数据');
}

main().catch((e) => {
  console.error('迁移失败：', e.message);
  process.exit(1);
});
