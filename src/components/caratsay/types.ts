/** 克拉SAY 统一照片模型（云端 + 本地合并后） */
export interface Photo {
  id: string;
  section: string;
  /** 展示地址：云端为 https URL，本地为 dataURL */
  src: string;
  timestamp: number;
  origin: 'cloud' | 'local';
  /** 是否为当前浏览器上传的（决定能否删除） */
  mine: boolean;
}

/** 本地存储的原始条目 */
export interface LocalImage {
  id: string;
  section: string;
  data: string;
  timestamp: number;
  w?: number;
  h?: number;
}

export const formatMonth = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
};

export const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};
