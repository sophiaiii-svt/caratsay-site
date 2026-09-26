/**
 * 将 Spotify 自动同步的数据（spotify-data.ts）合并进人工维护的专辑数据：
 *  - 已有专辑（按标题匹配）：更新曲目列表 / 发行日期 / 把「待公布」的主打曲替换为真实曲目
 *  - 新发行（近 90 天内或未来发行）：自动追加为新条目
 * 人工维护的小卡配置、特典、文案不受影响。
 */
import type { Album } from '@/types';
import { spotifySync } from './spotify-data';

interface SpotifyRelease {
  bucket: 'group' | 'subunit' | 'solo';
  artist?: string;
  spotifyAlbumId: string;
  title: string;
  spotifyType?: string;
  releaseDate: string;
  tracks: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s*[-–(（].*$/, '') // 去掉 " - EP" / "(...)" 等后缀
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '');

const PALETTE = ['#F8961E', '#FB8500', '#3A0CA3', '#7209B7', '#E85D04', '#2A9D8F', '#3A86FF', '#7B2CBF', '#FF6B35', '#6A4C93'];

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
};

const fmtDate = (d: string) => d.replaceAll('-', '.');
const APPEND_WINDOW_MS = 90 * 24 * 3600 * 1000;

export function mergeSpotify(base: Album[], bucket: 'group' | 'subunit' | 'solo'): Album[] {
  const all = (spotifySync as unknown as { releases?: SpotifyRelease[] }).releases ?? [];
  const releases = all.filter((r) => r.bucket === bucket);
  if (releases.length === 0) return base;

  const out = [...base];
  const now = Date.now();

  for (const rel of releases) {
    const target = norm(rel.title);
    const idx = out.findIndex((a) => {
      const stripped = a.title.includes(' - ') ? a.title.split(' - ').slice(1).join(' - ') : a.title;
      return norm(stripped) === target || norm(a.title) === target;
    });

    if (idx >= 0) {
      // 已有专辑：更新曲目 / 日期 / 待公布主打
      const a = { ...out[idx] };
      if (rel.tracks.length > 0) a.tracks = [...rel.tracks];
      const rd = fmtDate(rel.releaseDate);
      if (rd !== a.releaseDate) {
        a.releaseDate = rd;
        a.year = Number(rel.releaseDate.slice(0, 4));
      }
      if (rel.tracks.length > 0 && (a.titleTrack === '（待公布）' || a.titleTrack === '(TBD)' || a.titleTrack === 'TBD')) {
        a.titleTrack = rel.tracks[0];
      }
      out[idx] = a;
    } else {
      // 新发行：仅自动追加近期 / 未来发行，避免历史无关条目混入
      const rdMs = new Date(rel.releaseDate).getTime();
      if (!(rdMs > now - APPEND_WINDOW_MS)) continue;
      const artist = rel.artist ?? '';
      const album: Album = {
        id: 'spotify-' + rel.spotifyAlbumId,
        title: bucket === 'group' ? rel.title : `${artist} - ${rel.title}`,
        type: bucket === 'subunit' ? 'subunit' : bucket === 'solo' ? 'solo' : rel.spotifyType === 'single' ? 'mini' : 'full',
        ...(bucket === 'group' ? {} : { artist }),
        releaseDate: fmtDate(rel.releaseDate),
        year: Number(rel.releaseDate.slice(0, 4)),
        coverColor: PALETTE[hash(artist || 'seventeen') % PALETTE.length],
        titleTrack: rel.tracks[0] ?? '（待公布）',
        description: '（Spotify 自动同步的新发行作品，介绍信息待补充）',
        tracks: [...rel.tracks],
      };
      out.push(album);
    }
  }

  return out;
}
