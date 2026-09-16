import type { ContentSource, OfficialAccount, MiniteenItem, MaterialItem } from '@/types';

// 团体官方账号
export const officialAccounts: OfficialAccount[] = [
  { platform: 'Instagram', handle: '@saythename_17', url: 'https://www.instagram.com/saythename_17', icon: '📷' },
  { platform: 'X / Twitter', handle: '@pledis_17', url: 'https://twitter.com/pledis_17', icon: '𝕏' },
  { platform: 'TikTok', handle: '@seventeen17_official', url: 'https://www.tiktok.com/@seventeen17_official', icon: '🎵' },
  { platform: 'YouTube', handle: 'SEVENTEEN', url: 'https://www.youtube.com/@pledis17', icon: '▶️' },
  { platform: 'Weverse', handle: 'SEVENTEEN', url: 'https://weverse.io/seventeen', icon: '💬' },
  { platform: 'Weibo', handle: '@pledis17', url: 'https://weibo.com/pledis17', icon: '🌐' },
  { platform: 'BiliBili', handle: 'SEVENTEEN', url: 'https://b23.tv/8xshukk', icon: '📺' },
  { platform: '抖音 Douyin', handle: 'SEVENTEEN_OFFICIAL', url: 'https://www.douyin.com/user/SEVENTEEN_OFFICIAL', icon: '🎬' },
];

// 旧版物料区数据保留（供后续扩展使用）
export const wvsContent: ContentSource[] = [
  { platform: 'wvs', title: 'SEVENTEEN Weverse 官方社区', url: 'https://weverse.io/seventeen', description: 'SEVENTEEN官方粉丝社区，成员日常更新、幕后花絮、Weverse Live直播' },
];

export const tiktokContent: ContentSource[] = [
  { platform: 'tiktok', title: 'SEVENTEEN TikTok 官方', url: 'https://www.tiktok.com/@seventeen17_official', description: 'SEVENTEEN官方TikTok，舞蹈挑战、幕后花絮、短视频' },
];

export const instagramContent: ContentSource[] = [
  { platform: 'instagram', title: 'SEVENTEEN Instagram 官方', url: 'https://www.instagram.com/saythename_17', description: 'SEVENTEEN官方Instagram，回归概念照、日常、官方花絮照' },
];

export const twitterContent: ContentSource[] = [
  { platform: 'twitter', title: 'SEVENTEEN X 官方: @pledis_17', url: 'https://twitter.com/pledis_17', description: 'SEVENTEEN官方X/Twitter，回归预告、日程、官方照' },
];

export const groupContent: ContentSource[] = [
  { platform: 'group', title: 'SEVENTEEN Official YouTube', url: 'https://www.youtube.com/@pledis17', description: '官方YouTube频道，MV、幕后花絮、综艺剪辑、直播回放' },
];

export const fansiteGuide = {
  title: '站姐 / Fansite 审图整理指南',
  description: '以下为各成员知名站姐资源汇总。站姐审图可在X/Twitter搜索对应话题标签查找。',
  note: '⚠️ 站姐照片版权归原作者所有，请尊重站姐劳动成果，勿盗图、二改。分享时请保留水印并标注出处。',
  platforms: [
    { name: 'X (Twitter)', description: '搜索 "#成员名 #세븐틴" 或 "#SVT_成员名" 可找到大量站姐更新', url: 'https://twitter.com' },
    { name: 'Weibo', description: '微博超话 "SEVENTEEN超话" 和各成员个人超话有大量站姐搬运', url: 'https://weibo.com' },
    { name: 'Instagram', description: '搜索 "seventeen_members名_fansite" 可找到站姐IG账号', url: 'https://www.instagram.com' },
    { name: '小红书', description: '小红书搜索成员名可找到大量站姐图搬运和整理帖', url: 'https://www.xiaohongshu.com' },
  ],
};

// MINITEEN 官方角色与周边
export const miniteenItems: MiniteenItem[] = [
  // 13 个角色
  {
    id: 'mt-scoups',
    title: 'S.Coups',
    category: 'character',
    memberId: 'scoups',
    description: '白色兔子，队长代表',
    characterName: 'CHOITCHERRY（崔樱桃）',
    characterSpecies: '兔子',
    characterMbti: 'ISFJ',
    characterResidence: '江南某处 / 龙山某处',
    characterFavoriteFood: '香煎三文鱼排、生拌牛肉',
    characterFavoriteSong: 'K-pop（喜欢所有偶像）',
    characterHobby: '躺一整天',
    characterDislikes: '成为焦点',
    characterSpecial: '不喜欢成为焦点，很容易害羞。有着锐利的眉毛和眼睛、樱桃形状的尾巴，虽然害羞但内心充满热情，也拥有很多隐藏肌肉。',
    characterIntro: 'CHOITCHERRY（崔樱桃）是一只白色兔子，对应 S.Coups 的队长身份。有着锐利的眉毛和眼睛，樱桃形状的尾巴。性格害羞但内心充满热情，是 13 个角色中的队长担当。虽然不喜欢成为焦点，但其实拥有很多隐藏的肌肉，是一个「害羞但强壮」的兔子。',
  },
  {
    id: 'mt-jeonghan',
    title: 'Jeonghan',
    category: 'character',
    memberId: 'jeonghan',
    description: '穿粉色兔子头套的花栗鼠，天使担当',
    characterName: 'JJONGTORAM（囧兔拉）',
    characterSpecies: '兔花栗鼠（花栗鼠穿兔子头套）',
    characterMbti: 'LOVE',
    characterResidence: '清潭洞 240208-1004',
    characterFavoriteFood: '部队锅',
    characterFavoriteSong: 'Acoustic Music',
    characterHobby: '兜风、看海、收集毯子',
    characterDislikes: '无',
    characterSpecial: '耳朵从 0% 到 100% 代表能量和情绪，累的时候耳朵会垂下来，睡一觉就能充电。收集的毯子拥有超能力，偶尔会围着毯子飞翔。性格温柔又好胜，喜欢打赌且不想输。',
    characterIntro: 'JJONGTORAM（囧兔拉）是一只住在松鼠身体里的粉色兔子头套角色，对应 Jeonghan「天使」的昵称。耳朵会根据情绪和能量变化形态，累的时候垂下、开心时竖起。收集的毯子拥有超能力，可以围着毯子飞翔。性格温柔又好胜，喜欢打赌。',
  },
  {
    id: 'mt-joshua',
    title: 'Joshua',
    category: 'character',
    memberId: 'joshua',
    description: '温柔的小鹿，绅士主唱',
    characterName: 'SHUASUMI（刷小鹿）',
    characterSpecies: '鹿',
    characterMbti: 'ENFJ',
    characterResidence: '苏格兰森林',
    characterFavoriteFood: '牛排、柳橙、香草冰淇淋',
    characterFavoriteSong: 'Jazz、R&B',
    characterHobby: '调香水、烹饪、散步、游泳、冲浪、滑雪',
    characterDislikes: '虫子、变脏、泥巴、灰尘、负面想法',
    characterSpecial: '一天洗三次澡，非常喜欢收集香水，即使不是故意的也会买一两瓶。喜欢烹饪但讨厌洗碗，所以烹饪前会犹豫很久。在美味的食物面前把持不住。',
    characterIntro: 'SHUASUMI（刷小鹿）是一只温柔的小鹿，居住在苏格兰森林。对应 Joshua 在美国洛杉矶的成长背景，性格绅士又爱干净。一天洗三次澡，热爱收集香水。喜欢烹饪但讨厌洗碗，喜欢冲浪和滑雪等多种运动。MBTI 为 ENFJ。',
  },
  {
    id: 'mt-jun',
    title: 'Jun',
    category: 'character',
    memberId: 'jun',
    description: '三只猫咪，中国成员代表',
    characterName: 'OPEN CLOSE LOCK（O.C.L / 开关锁）',
    characterSpecies: '三只猫（Open白猫 / Close黑猫 / Lock灰猫）',
    characterMbti: '未公开',
    characterResidence: '猫咪森林 / 猫咪湖 / 猫咪山',
    characterFavoriteFood: '橘子（Open）、柠檬（Close）、桃子（Lock）',
    characterFavoriteSong: 'Very Nice（Open）、Fallin\' Flower（Close）、Our Dawn Is Hotter Than Day（Lock）',
    characterHobby: '运动（Open）、读书小说（Close）、在山上吃火锅（Lock）',
    characterDislikes: '无',
    characterSpecial: '三只猫各有超能力：Open 可瞬间移动，Close 可暂停时间，Lock 拥有专属空间（被允许才能进出）。性格分别为开朗、安静、亲切。最好的朋友是 SEVENTEEN JUN，总是黏在一起，喜欢玩门。',
    characterIntro: 'O.C.L（开关锁）是三只猫咪的组合 — Open（白猫·开朗）、Close（黑猫·安静）、Lock（灰猫·亲切），对应 Jun 的多面性。Open 能瞬间移动，Close 能暂停时间，Lock 能拥有只属于他的世界。名字来源于韩语「문열어(开门)/문닫아(关门)/문잠가(锁门)」。',
  },
  {
    id: 'mt-hoshi',
    title: 'Hoshi',
    category: 'character',
    memberId: 'hoshi',
    description: '老虎形象，十点十分',
    characterName: 'TAMTAM（眈眈）',
    characterSpecies: '老虎',
    characterMbti: 'INFP',
    characterResidence: '虎穴',
    characterFavoriteFood: 'CARAT 的爱、辛奇（泡菜）',
    characterFavoriteSong: 'Tiger Power',
    characterHobby: '玩一二三木头人、无穷花开了',
    characterDislikes: '无',
    characterSpecial: '有可爱的小肚子，能带来好运、招福。不怕仓鼠，也不怎么想到它们。喜欢滚来滚去，经常想着 CARAT。',
    characterIntro: 'TAMTAM（眈眈）是一只充满活力的老虎，对应 Hoshi 的「虎」昵称和 10:10 手势。性格热情似火，有着可爱的肚子，能带来好运。喜欢玩一二三木头人，最爱 CARAT 的爱和辛奇。MBTI 为 INFP，虽然外表是猛虎但内心柔软。',
  },
  {
    id: 'mt-wonwoo',
    title: 'Wonwoo',
    category: 'character',
    memberId: 'wonwoo',
    description: '紫色狐狸，低音炮',
    characterName: 'FOXDUNGEE（狐袋子）',
    characterSpecies: '狐狸（紫色）',
    characterMbti: 'ROCK',
    characterResidence: '宽敞的房子',
    characterFavoriteFood: '辣炒年糕',
    characterFavoriteSong: '摇滚乐',
    characterHobby: '拍照、玩游戏',
    characterDislikes: '无',
    characterSpecial: '拥有六条尾巴，充满好奇心。耳朵会在竞争或产生兴趣时竖起来。也喜欢旅行和唱歌。',
    characterIntro: 'FOXDUNGEE（狐袋子）是一只紫色的狐狸，对应 Wonwoo 的知性形象。拥有六条尾巴，充满好奇心。耳朵会在竞争或产生兴趣时竖起来。喜欢摄影、玩游戏、旅行和唱歌。MBTI 为 ROCK，性格安静内敛但内心炽热。',
  },
  {
    id: 'mt-woozi',
    title: 'Woozi',
    category: 'character',
    memberId: 'woozi',
    description: '饭团形象，制作人',
    characterName: 'PPYOPULI（小饭粒）',
    characterSpecies: '饭团',
    characterMbti: 'INFJ',
    characterResidence: '电饭煲',
    characterFavoriteFood: '紫菜',
    characterFavoriteSong: '舞曲（但不喜欢太活跃）',
    characterHobby: '染头发',
    characterDislikes: '充满活力的事情',
    characterSpecial: '饭粒颜色会随情绪变化，可以寄生于其他角色。非常有行动力，但有很多矛盾——被描述为「不可预测的角色」，有很多性格面向，私下会像胶水一样黏人。',
    characterIntro: 'PPYOPULI（小饭粒）是一个白色饭团形象，对应 Woozi 作为 SEVENTEEN 制作核心的身份。饭粒颜色会随情绪变化，非常有行动力。性格充满矛盾——喜欢舞曲但不喜欢太活跃，被描述为「不可预测的角色」。私下会像胶水一样黏人。MBTI 为 INFJ。',
  },
  {
    id: 'mt-the8',
    title: 'The8',
    category: 'character',
    memberId: 'the8',
    description: '青蛙形象，武术主舞',
    characterName: 'THEpalee（帕哩）',
    characterSpecies: '青蛙',
    characterMbti: 'IIFF',
    characterResidence: '下雨的地方',
    characterFavoriteFood: '中国菜',
    characterFavoriteSong: 'Ribbit ribbit（呱呱）',
    characterHobby: '赏雨、茶道、画画、冥想',
    characterDislikes: '太吵的环境、太冷的天气',
    characterSpecial: '喜欢下雨天、喝茶、画画、冥想和安静的氛围。不喜欢太吵或太冷的环境。如果给予爱的话，就会变成王子或公主。',
    characterIntro: 'THEpalee（帕哩）是一只绿色的青蛙，对应 The8 的代表色和禅意性格。喜欢下雨天、喝茶、画画和冥想，不喜欢太吵或太冷的环境。MBTI 为 IIFF，性格温和有礼，可以成为「爱的王子或公主」。来自中国辽宁，擅长 B-boy 和武术。',
  },
  {
    id: 'mt-mingyu',
    title: 'Mingyu',
    category: 'character',
    memberId: 'mingyu',
    description: '土豆形象，身高担当',
    characterName: 'KIMJA（金土豆）',
    characterSpecies: '土豆',
    characterMbti: 'ENFJ',
    characterResidence: '厨房',
    characterFavoriteFood: '薯片（洋芋片）',
    characterFavoriteSong: '乡村音乐',
    characterHobby: '吃薯片、用松露油洗澡、桑拿、泡澡、开车、运动',
    characterDislikes: '地瓜（视为竞争对手）',
    characterSpecial: '比想象中更大，是土豆们的领袖，有很强的责任感。爱闹别扭但消气也快，能吃，非常爱干净。视地瓜为竞争对手。',
    characterIntro: 'KIMJA（金土豆）是一颗圆滚滚的土豆，对应 Mingyu 的可爱反差萌。虽然是土豆形象但实际身高 187cm，是队内最高成员。比想象中更大，是土豆们的领袖，有很强的责任感。视地瓜为竞争对手，喜欢吃薯片、用松露油洗澡。MBTI 为 ENFJ。',
  },
  {
    id: 'mt-dk',
    title: 'DK',
    category: 'character',
    memberId: 'dk',
    description: '狗狗形象，主唱',
    characterName: 'DOA（DOA DOA）',
    characterSpecies: '狗',
    characterMbti: '未公开',
    characterResidence: 'DK哥的心里',
    characterFavoriteFood: '披萨',
    characterFavoriteSong: 'HUG（因为喜欢拥抱）',
    characterHobby: '吃一盘披萨',
    characterDislikes: '香菜、芹菜、茄子',
    characterSpecial: '性格很乖巧，但充满了比格犬般的魅力。看到吃的会疯狂，偶尔会咬主人。喜欢 DK 哥、DK 哥喜欢的克拉们和披萨。睡前不道「晚安」就会咬人；睡前道一声「道啊嘿」的话，会做出旋转披萨的动作。',
    characterIntro: 'DOA 是一只活泼的小狗，对应 DK 阳光开朗的性格。有着大大的笑容和充满力量的嗓音。性格可爱温柔但搞怪，为食物疯狂，能吃掉一整张披萨。对它说「Doahae」会假装转披萨。讨厌香菜、芹菜和茄子。是 Vocal 队的主唱。',
  },
  {
    id: 'mt-seungkwan',
    title: 'Seungkwan',
    category: 'character',
    memberId: 'seungkwan',
    description: '橘子形象，济州岛甜橘',
    characterName: 'BBOOGYULI（夫小橘）',
    characterSpecies: '橘子',
    characterMbti: '未公开',
    characterResidence: '济州市论岘洞',
    characterFavoriteFood: '天惠香、甜辣鸡块、咖啡',
    characterFavoriteSong: 'K-pop',
    characterHobby: '打羽毛球',
    characterDislikes: '黄瓜、番茄、不笑它的笑话',
    characterSpecial: '性格有点可爱，越看越可爱。喜欢欺骗日吃好吃的、吃天惠香、吃甜辣鸡块、打羽毛球。被夸奖会害羞，喜欢牵手，眼眸像 CARAT 般闪耀。讨厌黄瓜、番茄和不笑它笑话的人。',
    characterIntro: 'BBOOGYULI（夫小橘）是一个来自济州岛的橘子，对应 Seungkwan 的故乡济州岛。性格活泼搞怪，越看越可爱。被夸奖会害羞，喜欢牵手，眼睛像钻石一样闪亮。讨厌黄瓜、番茄和不笑它笑话的人。喜欢打羽毛球和刮痧。是 BSS 小分队成员。',
  },
  {
    id: 'mt-vernon',
    title: 'Vernon',
    category: 'character',
    memberId: 'vernon',
    description: '戴北极熊头套的人，混血 Rapper',
    characterName: 'NONVER（哝啵）',
    characterSpecies: '人（戴北极熊头套）',
    characterMbti: '拒绝非科学性性格测试',
    characterResidence: '首尔',
    characterFavoriteFood: '番茄炖蛋（Shakshuka）',
    characterFavoriteSong: '各种类型（太多了）',
    characterHobby: '自由玩耍',
    characterDislikes: '睡眠不足',
    characterSpecial: '喜欢闲暇时间。肤色会随情绪变化，性格慵懒神秘，看似冷漠但什么都知道。懂得「睡好玩好」的生活哲学。',
    characterIntro: 'NONVER（哝啵）是一个戴着北极熊头套的角色，对应 Vernon 的混血背景和独特气质。肤色会随情绪变化，性格慵懒随性，看似冷漠但什么都知道。喜欢自由玩耍，讨厌睡眠不足。懂得「睡好玩好」的生活哲学。出生于纽约，精通英语与韩语。',
  },
  {
    id: 'mt-dino',
    title: 'Dino',
    category: 'character',
    memberId: 'dino',
    description: '水獭形象，忙内主舞',
    characterName: 'CHANDALEE（灿獭哩）',
    characterSpecies: '水獭',
    characterMbti: 'INFJ',
    characterResidence: '水獭王国',
    characterFavoriteFood: '脊骨土豆汤',
    characterFavoriteSong: 'R&B',
    characterHobby: '运动、锻炼',
    characterDislikes: '无',
    characterSpecial: '性格爱笑、喜欢交友、充满自信。对音乐有野心，笑得很多，喜欢人。会指导水獭百姓们，想要领导水獭子民。',
    characterIntro: 'CHANDALEE（灿獭哩）是一只可爱的水獭，对应 Dino 作为忙内的活泼形象。充满自信，对音乐有野心。笑得很多，喜欢人。想要领导水獭子民。MBTI 为 INFJ，父亲是舞蹈家，被称为「K-pop 的未来」。是 Performance 队的主舞和忙内。',
  },
  // 周边系列
  { id: 'mt-ice-cream', title: 'MINITEEN Ice Cream', category: 'merch', description: 'MINITEEN 夏日冰淇淋系列周边', link: 'https://weverse.io/seventeen/shop' },
  { id: 'mt-holiday',   title: 'MINITEEN HOLIDAY',   category: 'merch', description: 'MINITEEN 假日系列周边', link: 'https://weverse.io/seventeen/shop' },
  { id: 'mt-carat-bong',title: 'MINITEEN 应援棒',    category: 'merch', description: 'MINITEEN 主题应援棒 / CARAT BONG 配件', link: 'https://weverse.io/seventeen/shop' },
  { id: 'mt-house-party',title:'MINITEEN HOUSE PARTY',category: 'merch', description: 'MINITEEN HOUSE PARTY 系列官方周边', link: 'https://weverse.io/seventeen/shop' },
];

// 物料区：按成员分类的资讯、站姐图、官方物料等
export const materialItems: MaterialItem[] = [
  // S.Coups
  { id: 'mat-scoups-ig', memberId: 'scoups', title: '个人 Instagram', category: 'official', description: '@sound_of_coups 日常与幕后照片', url: 'https://www.instagram.com/sound_of_coups', tags: ['官方', 'SNS'] },
  { id: 'mat-scoups-fansite', memberId: 'scoups', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #에스쿱스 #세븐틴 查看最新站姐图', url: 'https://twitter.com/search?q=%23%EC%97%90%EC%8A%A4%EC%BF%B1%EC%8A%A4%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-scoups-video', memberId: 'scoups', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 S.Coups fancam 直拍合集', url: 'https://www.youtube.com/results?search_query=S.Coups+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-scoups-info', memberId: 'scoups', title: '成员资讯整理', category: 'info', description: 'NamuWiki / Kpop Wiki 成员资料页', url: 'https://namu.wiki/w/S.COUPS', tags: ['资讯'] },

  // Jeonghan
  { id: 'mat-jeonghan-ig', memberId: 'jeonghan', title: '个人 Instagram', category: 'official', description: '@jeonghaniyoo_n 个人账号更新', url: 'https://www.instagram.com/jeonghaniyoo_n', tags: ['官方', 'SNS'] },
  { id: 'mat-jeonghan-fansite', memberId: 'jeonghan', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #정한 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%A0%95%ED%95%9C%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-jeonghan-video', memberId: 'jeonghan', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Jeonghan fancam', url: 'https://www.youtube.com/results?search_query=Jeonghan+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-jeonghan-info', memberId: 'jeonghan', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EC%A0%95%ED%95%9C(SEVENTEEN)', tags: ['资讯'] },

  // Joshua
  { id: 'mat-joshua-ig', memberId: 'joshua', title: '个人 Instagram', category: 'official', description: '@joshu_acoustic 个人账号更新', url: 'https://www.instagram.com/joshu_acoustic', tags: ['官方', 'SNS'] },
  { id: 'mat-joshua-xhs', memberId: 'joshua', title: '小红书', category: 'official', description: '@joshu_acoustic 个人账号更新', url: 'https://xhslink.cn/m/2Xi2ajtjC1t', tags: ['官方', 'SNS'] },
  { id: 'mat-joshua-fansite', memberId: 'joshua', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #조슈아 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%A1%B0%EC%8A%88%EC%95%84%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-joshua-video', memberId: 'joshua', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Joshua fancam', url: 'https://www.youtube.com/results?search_query=Joshua+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-joshua-info', memberId: 'joshua', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EC%A1%B0%EC%8A%88%EC%95%84(SEVENTEEN)', tags: ['资讯'] },

  // Jun
  { id: 'mat-jun-ig', memberId: 'jun', title: '个人 Instagram', category: 'official', description: '@junhui_moon 个人账号更新', url: 'https://www.instagram.com/junhui_moon', tags: ['官方', 'SNS'] },
  { id: 'mat-jun-weibo', memberId: 'jun', title: '微博主页', category: 'official', description: '微博 @SEVENTEEN-Jun 文俊辉官方微博', url: 'https://weibo.com/seventeenjun', tags: ['官方', 'SNS'] },
  { id: 'mat-jun-fansite', memberId: 'jun', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #준 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%A4%80%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-jun-video', memberId: 'jun', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Jun SEVENTEEN fancam', url: 'https://www.youtube.com/results?search_query=Jun+SEVENTEEN+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-jun-info', memberId: 'jun', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EB%AC%B8%EC%A4%80%ED%9C%98', tags: ['资讯'] },

  // Hoshi
  { id: 'mat-hoshi-ig', memberId: 'hoshi', title: '个人 Instagram', category: 'official', description: '@ho5hi_kwon 老虎日常', url: 'https://www.instagram.com/ho5hi_kwon', tags: ['官方', 'SNS'] },
  { id: 'mat-hoshi-fansite', memberId: 'hoshi', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #호시 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%ED%98%B8%EC%8B%9C%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-hoshi-video', memberId: 'hoshi', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Hoshi fancam', url: 'https://www.youtube.com/results?search_query=Hoshi+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-hoshi-info', memberId: 'hoshi', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%ED%98%B8%EC%8B%9C(SEVENTEEN)', tags: ['资讯'] },

  // Wonwoo
  { id: 'mat-wonwoo-ig', memberId: 'wonwoo', title: '个人 Instagram', category: 'official', description: '@everyone_woo 摄影与生活分享', url: 'https://www.instagram.com/everyone_woo', tags: ['官方', 'SNS'] },
  { id: 'mat-wonwoo-fansite', memberId: 'wonwoo', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #원우 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%9B%90%EC%9A%B0%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-wonwoo-video', memberId: 'wonwoo', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Wonwoo fancam', url: 'https://www.youtube.com/results?search_query=Wonwoo+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-wonwoo-info', memberId: 'wonwoo', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EC%A0%84%EC%9B%90%EC%9A%B0(SEVENTEEN)', tags: ['资讯'] },

  // Woozi
  { id: 'mat-woozi-ig', memberId: 'woozi', title: '个人 Instagram', category: 'official', description: '@woozi_universefactory 制作人日常', url: 'https://www.instagram.com/woozi_universefactory', tags: ['官方', 'SNS'] },
  { id: 'mat-woozi-fansite', memberId: 'woozi', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #우지 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%9A%B0%EC%A7%80%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-woozi-video', memberId: 'woozi', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Woozi fancam', url: 'https://www.youtube.com/results?search_query=Woozi+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-woozi-info', memberId: 'woozi', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EC%9A%B0%EC%A7%80(SEVENTEEN)', tags: ['资讯'] },

  // The8
  { id: 'mat-the8-ig', memberId: 'the8', title: '个人 Instagram', category: 'official', description: '@xuminghao_o 个人账号更新', url: 'https://www.instagram.com/xuminghao_o', tags: ['官方', 'SNS'] },
  { id: 'mat-the8-weibo', memberId: 'the8', title: '微博主页', category: 'official', description: '@徐明浩_The8 官方微博', url: 'https://weibo.com/u/6554599420', tags: ['官方', 'SNS'] },
  { id: 'mat-the8-fansite', memberId: 'the8', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #디에잇 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EB%94%94%EC%97%90%EC%9E%87%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-the8-video', memberId: 'the8', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 The8 fancam', url: 'https://www.youtube.com/results?search_query=The8+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-the8-info', memberId: 'the8', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%ED%99%8D%ED%95%98%EC%98%A4', tags: ['资讯'] },

  // Mingyu
  { id: 'mat-mingyu-ig', memberId: 'mingyu', title: '个人 Instagram', category: 'official', description: '@min9yu_k 摄影与生活', url: 'https://www.instagram.com/min9yu_k', tags: ['官方', 'SNS'] },
  { id: 'mat-mingyu-fansite', memberId: 'mingyu', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #민규 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EB%AF%BC%EA%B7%9C%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-mingyu-video', memberId: 'mingyu', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Mingyu fancam', url: 'https://www.youtube.com/results?search_query=Mingyu+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-mingyu-info', memberId: 'mingyu', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EA%B9%80%EB%AF%BC%EA%B7%9C(SEVENTEEN)', tags: ['资讯'] },

  // DK
  { id: 'mat-dk-ig', memberId: 'dk', title: '个人 Instagram', category: 'official', description: '@dk_is_dokyeom 生活与音乐分享', url: 'https://www.instagram.com/dk_is_dokyeom', tags: ['官方', 'SNS'] },
  { id: 'mat-dk-fansite', memberId: 'dk', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #도겸 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EB%8F%84%EA%B2%B8%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-dk-video', memberId: 'dk', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 DK SEVENTEEN fancam', url: 'https://www.youtube.com/results?search_query=DK+SEVENTEEN+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-dk-info', memberId: 'dk', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EB%8F%84%EA%B2%B8(SEVENTEEN)', tags: ['资讯'] },

  // Seungkwan
  { id: 'mat-seungkwan-ig', memberId: 'seungkwan', title: '个人 Instagram', category: 'official', description: '@pledis_boos 综艺与日常', url: 'https://www.instagram.com/pledis_boos', tags: ['官方', 'SNS'] },
  { id: 'mat-seungkwan-fansite', memberId: 'seungkwan', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #승관 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EC%8A%B9%EA%B4%80%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-seungkwan-video', memberId: 'seungkwan', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Seungkwan fancam', url: 'https://www.youtube.com/results?search_query=Seungkwan+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-seungkwan-info', memberId: 'seungkwan', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EB%B6%80%EC%8A%B9%EA%B4%80', tags: ['资讯'] },

  // Vernon
  { id: 'mat-vernon-ig', memberId: 'vernon', title: '个人 Instagram', category: 'official', description: '@vernonline 音乐与生活', url: 'https://www.instagram.com/vernonline', tags: ['官方', 'SNS'] },
  { id: 'mat-vernon-fansite', memberId: 'vernon', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #버논 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EB%B2%84%EB%85%BC%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-vernon-video', memberId: 'vernon', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Vernon fancam', url: 'https://www.youtube.com/results?search_query=Vernon+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-vernon-info', memberId: 'vernon', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EB%B2%84%EB%85%BC(SEVENTEEN)', tags: ['资讯'] },

  // Dino
  { id: 'mat-dino-ig', memberId: 'dino', title: '个人 Instagram', category: 'official', description: '@feat.dino 忙内舞蹈日常', url: 'https://www.instagram.com/feat.dino', tags: ['官方', 'SNS'] },
  { id: 'mat-dino-fansite', memberId: 'dino', title: '站姐图搜索', category: 'fansite', description: 'Twitter 搜索 #디노 #세븐틴 查看站姐图', url: 'https://twitter.com/search?q=%23%EB%94%94%EB%85%B8%20%23%EC%84%B8%EB%B8%90%ED%8B%B4', tags: ['站姐', 'Twitter'] },
  { id: 'mat-dino-video', memberId: 'dino', title: '直拍/舞台合集', category: 'video', description: 'YouTube 搜索 Dino fancam', url: 'https://www.youtube.com/results?search_query=Dino+SEVENTEEN+fancam', tags: ['视频', '直拍'] },
  { id: 'mat-dino-info', memberId: 'dino', title: '成员资讯整理', category: 'info', description: 'NamuWiki 成员资料页', url: 'https://namu.wiki/w/%EB%94%94%EB%85%B8(SEVENTEEN)', tags: ['资讯'] },
];
