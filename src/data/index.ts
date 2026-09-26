export { members, officialAccounts } from './members';
import { albums as baseAlbums, subUnitAlbums as baseSubUnitAlbums, soloAlbums as baseSoloAlbums } from './albums';
import { mergeSpotify } from './mergeSpotify';

// 专辑数据 = 人工维护数据 + Spotify 自动同步合并（见 scripts/sync-spotify.mjs）
export const albums = mergeSpotify(baseAlbums, 'group');
export const subUnitAlbums = mergeSpotify(baseSubUnitAlbums, 'subunit');
export const soloAlbums = mergeSpotify(baseSoloAlbums, 'solo');
export { tours, fanmeetings } from './concerts';
export { varietyShows } from './variety';
export { subUnits } from './subunits';
export { militaryRecords, militaryEvents, kst, FIRST_ENLIST, OT13_RETURN } from './military';
export { wvsContent, tiktokContent, instagramContent, twitterContent, groupContent, fansiteGuide, miniteenItems, materialItems } from './content';
