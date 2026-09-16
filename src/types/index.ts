export interface Member {
  id: string;
  stageName: string;
  birthName: string;
  koreanName: string;
  position: string;
  unit: 'hiphop' | 'vocal' | 'performance';
  birthday: string;
  emoji: string;
  color: string;
  instagram?: string;
  weibo?: string;
  xiaohongshu?: { handle: string; url: string; description: string };
  representativeColor: string;
  miniteenImage: string;
  /** 详细信息 */
  details: {
    height: string;
    bloodType: string;
    mbti: string;
    nationality: string;
    role: string;
    tmi: string;
  };
}

export interface Album {
  id: string;
  title: string;
  type: 'mini' | 'full' | 'repackage' | 'special' | 'best' | 'japanese' | 'subunit';
  releaseDate: string;
  year: number;
  coverColor: string;
  titleTrack: string;
  description: string;
  tracks: string[];
  /** 封面图 URL */
  coverImage?: string;
  /** 小卡配置说明 */
  photocardInfo?: string;
  /** 通路特典 */
  benefits?: { store: string; description: string }[];
}

export interface Concert {
  id: string;
  name: string;
  year: string;
  dates: string;
  cities: string[];
  description: string;
  link: string;
  linkLabel: string;
  /** 团体 / 小分队 */
  scope: 'group' | 'subunit';
  /** 小分队标识（scope=subunit 时使用） */
  subUnitId?: string;
}

export interface TourStop {
  city: string;
  venue?: string;
  dates: string;
  status: 'ended' | 'upcoming' | 'ongoing';
}

export interface Tour {
  id: string;
  theme: string;
  year: string;
  scope: 'group' | 'subunit';
  subUnitId?: string;
  stops: TourStop[];
  description: string;
  link: string;
  linkLabel: string;
}

export interface Fanmeeting {
  id: string;
  name: string;
  year: string;
  dates: string;
  cities: string[];
  description: string;
  link: string;
}

export interface SubUnit {
  id: string;
  name: string;
  fullName: string;
  members: string[];
  debut: string;
  description: string;
  albums: { title: string; releaseDate: string; titleTrack: string }[];
  concerts: { name: string; dates: string; cities: string[]; status: 'done' | 'none' }[];
  color: string;
}

export interface VarietyShow {
  id: string;
  name: string;
  year: string;
  episodes: number | string;
  platform: string;
  description: string;
  link: string;
  linkLabel: string;
  /** B站链接 */
  biliLink?: string;
  biliLabel?: string;
  /** 分组：official 自制/官方 · kr 韩综出演 · cn 中国/海外 · music 音乐/电台 */
  category?: 'official' | 'kr' | 'cn' | 'music';
}

export interface ContentSource {
  platform: 'wvs' | 'tiktok' | 'instagram' | 'twitter' | 'group';
  memberId?: string;
  title: string;
  url: string;
  description: string;
}

export interface OfficialAccount {
  platform: string;
  handle: string;
  url: string;
  icon: string;
}

export interface MiniteenItem {
  id: string;
  title: string;
  category: 'character' | 'merch';
  image?: string;
  description: string;
  link?: string;
  memberId?: string;
  /** 卡通形象官方名字 (e.g. CHOITCHERRY) */
  characterName?: string;
  /** 卡通形象详细介绍 */
  characterIntro?: string;
  /** 物种 */
  characterSpecies?: string;
  /** 角色MBTI */
  characterMbti?: string;
  /** 角色爱好 */
  characterHobby?: string;
  /** 角色喜欢的食物 */
  characterFavoriteFood?: string;
  /** 角色喜欢的音乐 */
  characterFavoriteSong?: string;
  /** 角色特殊能力/特征 */
  characterSpecial?: string;
  /** 角色居住地 */
  characterResidence?: string;
  /** 角色讨厌的事物 */
  characterDislikes?: string;
}

export interface MaterialItem {
  id: string;
  memberId: string;
  title: string;
  category: 'official' | 'fansite' | 'video' | 'info' | 'photo';
  description: string;
  url?: string;
  tags?: string[];
}
