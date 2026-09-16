/**
 * SEVENTEEN 兵役倒计时数据
 * 所有日期均为韩国时间（KST, UTC+9），格式 YYYY-MM-DD
 * 资料来源：PLEDIS 官方公告 / Soompi / News1 / 新浪娱乐 / Weverse
 */

export type MilitaryStatus = 'discharged' | 'serving' | 'upcoming' | 'exempt';

export interface MilitaryRecord {
  /** 对应 members.ts 的 id */
  memberId: string;
  /** 中文本名 */
  cnName: string;
  /** 艺名 */
  stageName: string;
  /** 韩文名 */
  koreanName: string;
  status: MilitaryStatus;
  /** 服役形态 */
  serviceType?: string;
  /** 服役月数 */
  serviceMonths?: number;
  /** 入伍日 YYYY-MM-DD (KST) */
  enlistDate?: string;
  /** 退伍日 YYYY-MM-DD (KST) */
  dischargeDate?: string;
  /** 官方公告日 */
  announcedAt?: string;
  /** 备注 */
  note?: string;
  /** 免服役原因（简） */
  exemptReason?: string;
  /** 免服役原因（详） */
  exemptDetail?: string;
}

/** 韩国时间转 Date */
export function kst(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

/** 团体首位入伍日 */
export const FIRST_ENLIST = '2024-09-26';
/** 团体末位退伍日 —— OT13 完整体回归 */
export const OT13_RETURN = '2028-06-10';

export const militaryRecords: MilitaryRecord[] = [
  // ─────────── 已退伍 · 光荣小兵回家 ───────────
  {
    memberId: 'jeonghan',
    cnName: '尹净汉',
    stageName: 'Jeonghan',
    koreanName: '윤정한',
    status: 'discharged',
    serviceType: '公益兵',
    serviceMonths: 21,
    enlistDate: '2024-09-26',
    dischargeDate: '2026-06-25',
    announcedAt: '2024-09-11',
    note: 'SEVENTEEN 首位履行兵役的成员。完成 3 周基础军事训练后转入社会服务机构服役，2026 年 6 月 25 日期满退伍，成为队内第一位「光荣小兵回家」的成员。'
  },

  // ─────────── 服役中 ───────────
  {
    memberId: 'wonwoo',
    cnName: '全圆佑',
    stageName: 'Wonwoo',
    koreanName: '전원우',
    status: 'serving',
    serviceType: '公益兵',
    serviceMonths: 21,
    enlistDate: '2025-04-03',
    dischargeDate: '2027-01-02',
    announcedAt: '2025-03-20',
    note: '因既往身体状况被编入公益兵。入伍前完成了 SEVENTEEN 世界巡演的既定行程。',
  },
  {
    memberId: 'woozi',
    cnName: '李知勋',
    stageName: 'Woozi',
    koreanName: '이지훈',
    status: 'serving',
    serviceType: '陆军现役',
    serviceMonths: 18,
    enlistDate: '2025-09-15',
    dischargeDate: '2027-03-14',
    announcedAt: '2025-07-08',
    note: '与 Hoshi 前后脚入伍。入伍前最后的公开行程为 HxW 小分队粉丝演唱会「WARNING」，并提前录制了大量储备内容。',
  },
  {
    memberId: 'hoshi',
    cnName: '权顺荣',
    stageName: 'Hoshi',
    koreanName: '권순영',
    status: 'serving',
    serviceType: '陆军现役',
    serviceMonths: 18,
    enlistDate: '2025-09-16',
    dischargeDate: '2027-03-15',
    announcedAt: '2025-07-08',
    note: '比 Woozi 晚一天入伍，两人退伍日期也仅差一天。入伍前与 Woozi 共同完成 HxW「WARNING」巡演收官。',
  },

  // ─────────── 即将入伍 ───────────
  {
    memberId: 'vernon',
    cnName: '崔瀚率',
    stageName: 'Vernon',
    koreanName: '최한솔',
    status: 'upcoming',
    serviceType: '公益兵',
    serviceMonths: 21,
    enlistDate: '2026-08-20',
    dischargeDate: '2028-05-19',
    announcedAt: '2026-07-27',
    note: '拥有韩美双重国籍，为保留韩国国籍主动履行国防义务。入伍前刚与 The8 完成 V8 小分队出道活动。服役开始当日不设官方行程。',
  },
  {
    memberId: 'dk',
    cnName: '李硕珉',
    stageName: 'DK',
    koreanName: '이석민',
    status: 'upcoming',
    serviceType: '陆军现役',
    serviceMonths: 18,
    enlistDate: '2026-09-08',
    dischargeDate: '2028-03-07',
    announcedAt: '2026-07-27',
    note: '以陆军现役身份入伍。入伍前将正常完成与夫胜宽组成的 DxS 小分队既定行程。',
  },
  {
    memberId: 'mingyu',
    cnName: '金珉奎',
    stageName: 'Mingyu',
    koreanName: '김민규',
    status: 'upcoming',
    serviceType: '公益兵',
    serviceMonths: 21,
    enlistDate: '2026-09-10',
    dischargeDate: '2028-06-10',
    announcedAt: '2026-08-10',
    note: '以公益兵身份服役，服役起始日与进入新兵训练营当日均不设官方活动。为 13 人中最后一位退伍的成员，其退伍日即 OT13 完整体回归之日。',
  },
  {
    memberId: 'seungkwan',
    cnName: '夫胜宽',
    stageName: 'Seungkwan',
    koreanName: '부승관',
    status: 'upcoming',
    serviceType: '军乐团',
    serviceMonths: 18,
    enlistDate: '2026-10-26',
    dischargeDate: '2028-04-25',
    announcedAt: '2026-08-10',
    note: '主动报考并通过陆军军乐团选拔，与 Dino 同日入伍、同日退伍。',
  },
  {
    memberId: 'dino',
    cnName: '李灿',
    stageName: 'Dino',
    koreanName: '이찬',
    status: 'upcoming',
    serviceType: '军乐团',
    serviceMonths: 18,
    enlistDate: '2026-10-26',
    dischargeDate: '2028-04-25',
    announcedAt: '2026-08-10',
    note: '1999 年生的忙内本可延至 2028 年才入伍，为把「军白期」压到最短而选择提前入伍，与 Seungkwan 一同加入陆军军乐团。',
  },

  // ─────────── 免服役 ───────────
  {
    memberId: 'scoups',
    cnName: '崔胜澈',
    stageName: 'S.Coups',
    koreanName: '최승철',
    status: 'exempt',
    exemptReason: '伤病免役（兵役体检 5 级）',
    exemptDetail:
      '2023 年 8 月拍摄行程中左膝前十字韧带（ACL）断裂并接受重建手术，术后经兵役体检判定为 5 级——依韩国兵役法免除现役与补充役，因此无需入伍。',
  },
  {
    memberId: 'joshua',
    cnName: '洪知秀',
    stageName: 'Joshua',
    koreanName: '홍지수',
    status: 'exempt',
    exemptReason: '美国国籍',
    exemptDetail:
      '出生并成长于美国洛杉矶的韩裔美籍人士，持美国单一国籍，非韩国公民，依法不负担韩国兵役义务。',
  },
  {
    memberId: 'jun',
    cnName: '文俊辉',
    stageName: 'Jun',
    koreanName: '문준휘',
    status: 'exempt',
    exemptReason: '中国国籍',
    exemptDetail:
      '中国广东深圳人，持中国国籍，非韩国公民，不适用韩国兵役法，无需服韩国兵役。',
  },
  {
    memberId: 'the8',
    cnName: '徐明浩',
    stageName: 'The8',
    koreanName: '서명호',
    status: 'exempt',
    exemptReason: '中国国籍',
    exemptDetail:
      '中国辽宁安山人，持中国国籍，非韩国公民，不适用韩国兵役法，无需服韩国兵役。',
  },
];

export interface MilitaryEvent {
  memberId: string;
  cnName: string;
  stageName: string;
  /** 'enlist' 入伍 | 'discharge' 退伍 */
  kind: 'enlist' | 'discharge';
  date: string;
}

/** 全部入伍 / 退伍事件，按时间升序 */
export const militaryEvents: MilitaryEvent[] = militaryRecords
  .filter((r) => r.enlistDate && r.dischargeDate)
  .flatMap((r) => [
    { memberId: r.memberId, cnName: r.cnName, stageName: r.stageName, kind: 'enlist' as const, date: r.enlistDate! },
    { memberId: r.memberId, cnName: r.cnName, stageName: r.stageName, kind: 'discharge' as const, date: r.dischargeDate! },
  ])
  .sort((a, b) => a.date.localeCompare(b.date));

/**
 * 依据「当前时间」实时推算兵役状态（与全站一致的 KST 口径）。
 *
 * 规则：入伍当天（KST 00:00 起）即归为「服役中」，退伍当天归为「已退伍」。
 * 这样无需手动改代码——成员一到入伍日就会自动从「即将入伍」转入「服役中」，
 * 退伍日再自动转入「已退伍」。
 *
 * 数据里的 `status` 仅作「官方公布时的初始分类」基线，展示一律以本函数实时结果为准。
 */
export function liveMilitaryStatus(rec: MilitaryRecord, now: number): MilitaryStatus {
  if (rec.status === 'exempt') return 'exempt';
  if (!rec.enlistDate || !rec.dischargeDate) return rec.status;
  const en = kst(rec.enlistDate).getTime();
  const dis = kst(rec.dischargeDate).getTime();
  if (now < en) return 'upcoming';
  if (now < dis) return 'serving';
  return 'discharged';
}
