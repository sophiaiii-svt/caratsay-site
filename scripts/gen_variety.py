# -*- coding: utf-8 -*-
"""根据两份 xlsx 生成 src/data/variety.ts。
- 去重：同档多期合并（Dingo / 克拉岛 / SNAP SHOOT / 周年特辑），重复条目只留一个
- 文档中「补充」行作为追加条目纳入（即「补充 → /」）
- year 统一为 "2015" / "2017-2024" 形式（与既有代码一致，无「年」字）
"""
from urllib.parse import quote
import re

B = "https://search.bilibili.com/all?keyword="
YT = "https://www.youtube.com/results?search_query="

def bili(name: str) -> str:
    return B + quote(name)

def yt(name: str) -> str:
    return YT + quote(name + " SEVENTEEN")

# category: official(自制/官方) | kr(韩综出演) | cn(中国·海外) | music(音乐·电台)
# 每条: id, name, year, episodes, platform, description, link, linkLabel, biliLink, biliLabel, category
E = []  # entries

def add(id, name, year, episodes, platform, desc, link, linkLabel, biliLink, biliLabel, cat):
    E.append({
        "id": id, "name": name, "year": year, "episodes": episodes, "platform": platform,
        "description": desc, "link": link, "linkLabel": linkLabel,
        "biliLink": biliLink, "biliLabel": biliLabel, "category": cat,
    })

# ---------- 自制 / 官方综艺 (official) ----------
add("going-seventeen", "Going Seventeen", "2017-2025", "300+", "YouTube / Weverse",
    "SEVENTEEN 核心自制王牌综艺，每周更新。据节目列表统计已播出 136 档正片 + 11 档特别篇，涵盖推理、游戏、旅行、情景剧、密室逃脱、TTT、Don't Lie、黑手党、Bad clue 等多种企划，是入坑必看。",
    "https://www.youtube.com/playlist?list=PLk_UrM4pYbsn-UeAA3Zj4mo4FXhSfOXWj",
    "YouTube 播放列表", "https://space.bilibili.com/218438615/lists", "B站 零站合集", "official")

add("nana-tour", "NANA TOUR with SEVENTEEN", "2024", 6, "TVING / YouTube",
    "罗英锡 PD 打造的欧洲旅行真人秀，全员意大利旅行，笑点密集、风景治愈。",
    "https://www.youtube.com/@channel_fullmoon", "YouTube 频道十五夜",
    "https://b23.tv/OY2Spze", "B站 零站中字", "official")

add("nana-bnb", "NANA BNB with SEVENTEEN", "2025", "已完结", "TVING / YouTube",
    "NANA TOUR 续作，民宿经营主题真人秀，成员们共同经营海边民宿。",
    "https://www.youtube.com/@channel_fullmoon", "YouTube 频道十五夜",
    "https://b23.tv/vU7pctO", "B站 零站中字", "official")

add("game-caterers", "出差十五夜 x SEVENTEEN", "2021-2025", "多集", "YouTube / tvN",
    "罗英锡 PD《出差十五夜》多次与 SEVENTEEN 合作（含 HYBE 篇、SVT 篇），随机舞蹈、人物 Quiz、训民正音等游戏名场面频出。",
    "https://www.youtube.com/@channel_fullmoon", "YouTube 频道十五夜",
    "https://b23.tv/cqAe3Hh", "B站 零站中字", "official")

add("noisy", "罗英锡的吵吵嚷嚷 (Noisy)", "2023-2025", "多集", "YouTube / tvN",
    "罗英锡 PD 综艺，SEVENTEEN 全员参与的游戏特辑（2023、2025 两季，另含《吵闹闹的 SEVENTEEN 寄宿屋》衍生篇），笑料不断。",
    "https://www.youtube.com/@channel_fullmoon", "YouTube 频道十五夜",
    "https://b23.tv/nwnJcvp", "B站 零站中字", "official")

add("hit-the-road", "SEVENTEEN: Hit the Road", "2020", 14, "YouTube / Weverse",
    "巡演幕后纪录片综艺，记录 ODE TO YOU 巡演期间成员们的真实故事与成长（另含《Magic Hour》巡演纪实）。",
    "https://weverse.io/seventeen", "Weverse",
    "https://www.bilibili.com/video/BV1Ee411W7sX", "B站 搬运", "official")

add("one-fine-day", "One Fine Day / 美好的一天", "2015", 8, "MBC",
    "出道初期旅行真人秀，13 名成员分组前往不同地方旅行，名场面频出。",
    "https://www.youtube.com/@pledis17", "SEVENTEEN YouTube",
    "https://b23.tv/JsThHf2", "B站 零站中字", "official")

add("in-the-soop", "In the SOOP SEVENTEEN ver.", "2021-2023", "两季", "Weverse / JTBC",
    "成员们在乡村别墅中享受治愈假期的真人秀，展现私下真实相处模式。",
    "https://weverse.io/seventeen", "Weverse",
    "https://search.bilibili.com/all?keyword=SEVENTEEN%20in%20the%20soop", "B站 搜索", "official")

add("good-day", "Good Day (굿데이)", "2025", 8, "MBC",
    "G-Dragon 与金泰浩 PD 联合打造的音乐真人秀，夫胜宽等成员出演。",
    "https://program.imbc.com/goodday", "MBC 官网",
    "https://search.bilibili.com/all?keyword=Good%20Day%20%E5%A4%AB%E8%83%9C%E5%AE%BD", "B站 搜索", "official")

add("no-prepare", "虽然没准备什么菜", "2023-2024", "多集", "YouTube",
    "李泳知主持的网络脱口秀，多位成员出演，饮酒对谈、现场 Live 频出圈。",
    "https://www.youtube.com/@yongjimedia", "YouTube",
    "https://search.bilibili.com/all?keyword=%E8%99%BD%E7%84%B6%E6%B2%A1%E5%87%86%E5%A4%87%E4%BB%80%E4%B9%88%E8%8F%9C%20SEVENTEEN", "B站 搜索", "official")

add("seventeen-project", "SEVENTEEN PROJECT: Debut Big Plan", "2015", 7, "MBC",
    "MBC 出道生存真人秀，完整记录 13 名成员的出道选拔全过程。",
    "https://www.youtube.com/@pledis17", "SEVENTEEN YouTube",
    "https://www.bilibili.com/video/BV1vW411t7hB", "B站 搬运", "official")

add("seventeen-tv", "SEVENTEEN TV", "2013-2015", "5季", "Ustream / YouTube",
    "出道前练习生真人秀，记录 13 名成员的练习生日常、舞台测评与宿舍生活。",
    "https://www.youtube.com/@pledis17", "SEVENTEEN YouTube",
    "https://search.bilibili.com/all?keyword=SEVENTEEN%20TV%20%E7%BB%83%E4%B9%A0%E7%94%9F", "B站 搜索", "official")

# 补充（早期自制 / 官方）— 文档中「补充」行，统一纳入
add("svt-green-room", "SEVENTEEN 小绿屋", "2013-2015", "多集", "YouTube / VLIVE",
    "出道前练习生时期的官方宿舍真人秀，记录成员们早期日常与化学反应。", yt("SEVENTEEN 小绿屋"), "YouTube 搜索", bili("SEVENTEEN 小绿屋"), "B站 搜索", "official")
add("debut-mission", "出道大作战", "2015", "多集", "MBC",
    "出道前的生存企划节目，展现成员们为出道冲刺的准备过程。", yt("SEVENTEEN 出道大作战"), "YouTube 搜索", bili("SEVENTEEN 出道大作战"), "B站 搜索", "official")
add("good-life", "美好的生活 (瑞丽岛 / 日本秋田)", "2015-2016", "2季", "YouTube",
    "早期旅行综艺，成员分组前往瑞丽岛、日本秋田等地，展现青涩又真实的相处。", yt("SEVENTEEN 美好的生活"), "YouTube 搜索", bili("SEVENTEEN 美好的生活"), "B站 搜索", "official")
add("inside-seventeen", "Inside SEVENTEEN 花絮", "2016", "多集", "YouTube / VLIVE",
    "官方幕后花絮节目，记录打歌、综艺、练习之外的真实片段。", yt("Inside SEVENTEEN"), "YouTube 搜索", bili("Inside SEVENTEEN"), "B站 搜索", "official")
add("rank-by-me", "顺位由我决定", "2015", "多集", "YouTube",
    "早期成员顺位企划，由成员互评决定各种「顺位」，笑点十足。", yt("SEVENTEEN 顺位由我决定"), "YouTube 搜索", bili("SEVENTEEN 顺位由我决定"), "B站 搜索", "official")
add("svt-club", "SVT Club / SVT School", "2018", "多集", "YouTube / VLIVE",
    "官方粉丝向节目，成员以「社团 / 校园」为主题与克拉互动。", yt("SVT Club SEVENTEEN"), "YouTube 搜索", bili("SVT Club SEVENTEEN"), "B站 搜索", "official")
add("find-my-island", "我朋友的岛在哪", "2018", "多集", "YouTube",
    "李硕珉（DK）主持，成员互相寻找对方「岛屿」的轻松游戏企划。", yt("SEVENTEEN 我朋友的岛在哪"), "YouTube 搜索", bili("SEVENTEEN 我朋友的岛在哪"), "B站 搜索", "official")
add("ramen-challenge", "网红拉面挑战记", "2017", "多集", "YouTube",
    "成员挑战复刻各种网红拉面的美食企划。", yt("SEVENTEEN 网红拉面挑战记"), "YouTube 搜索", bili("SEVENTEEN 网红拉面挑战记"), "B站 搜索", "official")
add("if-seventeen", "If SEVENTEEN", "2020", "多集", "YouTube / VLIVE",
    "情境剧式官方节目，以「如果 SEVENTEEN 是……」展开各种脑洞设定。", yt("If SEVENTEEN"), "YouTube 搜索", bili("If SEVENTEEN"), "B站 搜索", "official")
add("svt-dayoff", "SVT 休息日 (第一季 / 第二季)", "2019-2020", "两季", "YouTube / VLIVE",
    "记录成员休息日私下的 vlog 式官方节目。", yt("SVT 休息日"), "YouTube 搜索", bili("SVT 休息日 SEVENTEEN"), "B站 搜索", "official")
add("svt-school-series", "SVT 幼儿园 / 小学 / 中学 / 私塾", "2018-2019", "多集", "YouTube / VLIVE",
    "成员化身幼儿园老师、小学生、私塾讲师的系列情景企划，反差萌名场面多。", yt("SVT 幼儿园 SEVENTEEN"), "YouTube 搜索", bili("SVT 幼儿园 SEVENTEEN"), "B站 搜索", "official")
add("svt-trainee-memoir", "SVT 练习生回忆录", "2017", "多集", "YouTube",
    "回顾练习生时期的访谈式官方节目。", yt("SVT 练习生回忆录"), "YouTube 搜索", bili("SVT 练习生回忆录"), "B站 搜索", "official")
add("svt-radio", "SVT 电台", "2019", "多集", "YouTube / VLIVE",
    "成员自主主持的官方电台节目，闲聊与点歌并存。", yt("SVT 电台 SEVENTEEN"), "YouTube 搜索", bili("SVT 电台 SEVENTEEN"), "B站 搜索", "official")
add("anniversary-special", "SEVENTEEN 周年纪念特辑 (1-7 周年)", "2018-2024", "多档", "YouTube / VLIVE",
    "历年周年粉丝派对特辑（一周年生日派对、二周年全力、四周年鸡尾酒派对、闪耀五周年、七周年 chapter7 等），成员与克拉同庆的特别企划。", yt("SEVENTEEN 周年特辑"), "YouTube 搜索", bili("SEVENTEEN 周年特辑"), "B站 搜索", "official")

# ---------- 韩国综艺出演 (kr) ----------
add("knowing-bros", "认识的哥哥 - SEVENTEEN 特辑", "2017-2024", "多次出演", "JTBC",
    "SEVENTEEN 多次以团体形式出演，与哥哥们分享趣事、展示才艺与随机舞蹈。",
    "https://tv.jtbc.co.kr/kb", "JTBC 官网", "https://www.bilibili.com/video/BV1zz4y1o7q8/", "B站 搬运", "kr")
add("amazing-saturday", "惊人的星期六", "2018-2025", "多次出演", "tvN",
    "听音辨曲美食综艺，SEVENTEEN 多批成员出演，展现音感与综艺感。",
    "https://program.tving.com/tvn/amazingsaturday", "tvN 官网", "https://b23.tv/EwykMBd", "B站 合集", "kr")
add("running-man", "Running Man", "2019-2020", "多次出演", "SBS",
    "国民级户外游戏综艺，SEVENTEEN 团体及小分队多次出演。",
    "https://programs.sbs.co.kr/enter/runningman", "SBS 官网", bili("SEVENTEEN Running Man"), "B站 搜索", "kr")
add("superman-return", "超人回来了", "2019", "出演", "KBS",
    "KBS 亲子综艺，成员以「混沌」等身份参与录制，展现反差亲和力。",
    "https://www.kbs.co.kr/enter/superman/", "KBS 官网", bili("SEVENTEEN 超人回来了"), "B站 搜索", "kr")
add("radio-star", "黄金渔场 Radio Star", "2019-2020", "多次出演", "MBC",
    "MBC 脱口秀，成员单人及团体多次做客，爆料与名场面频出。",
    "https://www.imbc.com/enter/radio/", "MBC 官网", bili("SEVENTEEN Radio Star"), "B站 搜索", "kr")
add("omniscient", "全知干预视角", "2019", "出演", "MBC",
    "经纪人视角观察艺人日常的综艺，SEVENTEEN 成员出演展现私下状态。",
    "https://www.imbc.com/enter/omniscient", "MBC 官网", bili("SEVENTEEN 全知干预视角"), "B站 搜索", "kr")
add("masked-singer", "蒙面歌王", "2016-2018", "出演", "MBC",
    "MBC 听音乐猜歌手综艺，成员以蒙面身份展现 vocal 实力。",
    "https://www.imbc.com/enter/maskedsinger", "MBC 官网", bili("SEVENTEEN 蒙面歌王"), "B站 搜索", "kr")
add("immortal-songs", "不朽的名曲", "2017", "出演", "KBS",
    "KBS 传承歌曲竞演，SEVENTEEN 演绎前辈名曲。",
    "https://www.kbs.co.kr/enter/immortal/", "KBS 官网", bili("SEVENTEEN 不朽的名曲"), "B站 搜索", "kr")
add("weekly-idol", "一周的偶像 (Weekly Idol)", "2015-2017", "多次出演", "MBC Every1",
    "经典偶像综艺，SEVENTEEN 出道初期多次出演，随机舞蹈名场面起源之一。",
    "https://www.mbcevery1.com", "MBC Every1", bili("SEVENTEEN 一周的偶像"), "B站 搜索", "kr")
add("idol-room", "Idol Room", "2018-2020", "多次出演", "JTBC",
    "JTBC 偶像谈话综艺，SEVENTEEN 团体及小分队多次做客。",
    "https://tv.jtbc.co.kr/idolroom", "JTBC 官网", bili("SEVENTEEN Idol Room"), "B站 搜索", "kr")
add("phonics", "看见你的声音", "2019", "出演", "Mnet",
    "Mnet 听音辨音综艺，成员挑战从声音猜出隐藏歌手。",
    "https://www.mnet.com", "Mnet", bili("SEVENTEEN 看见你的声音"), "B站 搜索", "kr")
add("school-attack", "校园突袭", "2016", "出演", "KBS",
    "KBS 校园突击探访综艺，SEVENTEEN 走进高中与学生互动。",
    "https://www.kbs.co.kr/enter/school/", "KBS 官网", bili("SEVENTEEN 校园突袭"), "B站 搜索", "kr")
add("battle-trip", "Battle Trip", "2018-2019", "出演", "KBS",
    "KBS 旅行对决综艺，成员组队推荐旅行地并 PK。",
    "https://www.kbs.co.kr/enter/battletrip", "KBS 官网", bili("SEVENTEEN Battle Trip"), "B站 搜索", "kr")
add("civilization-express", "文明特快", "2020-2022", "多次出演", "JTBC",
    "JTBC 历史quiz综艺，成员搭档出演，知识量与笑点并存。",
    "https://tv.jtbc.co.kr/civil", "JTBC 官网", bili("SEVENTEEN 文明特快"), "B站 搜索", "kr")
add("player", "Player", "2019", "出演", "tvN",
    "tvN 运动才艺综艺，成员展示运动与游戏实力。",
    "https://program.tving.com/tvn/player", "tvN 官网", bili("SEVENTEEN Player"), "B站 搜索", "kr")
add("quiet-ish-life", "机智的隔离生活", "2021", "出演", "tvN",
    "疫情居家主题综艺，成员参与录制宅家日常。",
    "https://program.tving.com/tvn/quiet", "tvN 官网", bili("SEVENTEEN 机智的隔离生活"), "B站 搜索", "kr")
add("ghost-war", "夺智的鬼怪", "2022", "出演", "tvN",
    "tvN 推理游戏综艺，成员组队破解谜题。",
    "https://program.tving.com/tvn/ghost", "tvN 官网", bili("SEVENTEEN 夺智的鬼怪"), "B站 搜索", "kr")
add("carat-island", "克拉岛情景剧", "2021-2025", "多季", "Weverse",
    "Weverse 官方粉丝演唱会前导情景剧，成员以角色扮演为演唱会预热。",
    "https://weverse.io/seventeen", "Weverse", bili("SEVENTEEN 克拉岛情景剧"), "B站 搜索", "kr")
add("snap-shoot", "SNAP SHOOT", "2021-2024", "多季", "Weverse",
    "Weverse 官方幕后纪录片，记录专辑制作、练习、行程的真实片段。",
    "https://weverse.io/seventeen", "Weverse", bili("SEVENTEEN SNAP SHOOT"), "B站 搜索", "kr")
add("wooden-statue", "SEVENTEEN 的一二三木头人", "2021", "出演", "KakaoTV",
    "KakaoTV 宅家游戏综艺，成员参与录制。",
    yt("SEVENTEEN 一二三木头人"), "YouTube 搜索", bili("SEVENTEEN 一二三木头人"), "B站 搜索", "kr")
add("two-men-show", "两个男人 Show", "2016", "出演", "SBS",
    "SBS 双人谈话综艺，成员出演。",
    yt("SEVENTEEN 两个男人Show"), "YouTube 搜索", bili("SEVENTEEN 两个男人Show"), "B站 搜索", "kr")
add("unexpected-q", "意外的 Q", "2018", "出演", "MBC",
    "MBC 问答综艺，成员出演。",
    yt("SEVENTEEN 意外的Q"), "YouTube 搜索", bili("SEVENTEEN 意外的Q"), "B站 搜索", "kr")
add("coin-noraebang", "硬币练歌房", "2018", "出演", "MBC",
    "MBC 投币练歌房音感综艺，成员出演。",
    yt("SEVENTEEN 硬币练歌房"), "YouTube 搜索", bili("SEVENTEEN 硬币练歌房"), "B站 搜索", "kr")
add("talk-show", "全民脱口秀 (你好)", "2018", "出演", "KBS",
    "KBS 脱口秀，成员出演分享故事。",
    "https://www.kbs.co.kr/enter/hello", "KBS 官网", bili("SEVENTEEN 全民脱口秀"), "B站 搜索", "kr")
add("enter-research", "艺能研究所", "2018", "出演", "tvN",
    "tvN 综艺观察节目，成员出演。",
    "https://program.tving.com/tvn/enter", "tvN 官网", bili("SEVENTEEN 艺能研究所"), "B站 搜索", "kr")
add("after-mom-sleeps", "妈妈睡着后", "2017", "出演", "OLLEH tv",
    "OLLEH tv 深夜闲聊综艺，成员出演。",
    yt("SEVENTEEN 妈妈睡着后"), "YouTube 搜索", bili("SEVENTEEN 妈妈睡着后"), "B站 搜索", "kr")
add("ask-in-box", "Ask in a Box", "2017", "出演", "YouTube",
    "问答箱形式粉丝互动节目，成员出演。",
    yt("SEVENTEEN Ask in a Box"), "YouTube 搜索", bili("SEVENTEEN Ask in a Box"), "B站 搜索", "kr")
add("300x2", "300x2", "2019", "出演", "Mnet",
    "Mnet 体能/游戏挑战综艺，成员出演。",
    "https://www.mnet.com", "Mnet", bili("SEVENTEEN 300x2"), "B站 搜索", "kr")
add("svt-lie-down", "SEVENTEEN 的躺放", "2019", "出演", "Naver TV",
    "Naver 躺平闲聊综艺，成员出演。",
    yt("SEVENTEEN 躺放"), "YouTube 搜索", bili("SEVENTEEN 躺放"), "B站 搜索", "kr")
add("cute-handsome", "可爱+帅气小十七", "2019", "出演", "Dingo Music",
    "Dingo Music 企划，放大成员可爱与帅气的反差。",
    yt("SEVENTEEN 可爱帅气小十七"), "YouTube 搜索", bili("SEVENTEEN 可爱帅气小十七"), "B站 搜索", "kr")
add("quiz-idol", "Quiz 上的 Idol", "2020", "出演", "MBC",
    "MBC 答题综艺，成员出演。",
    yt("SEVENTEEN Quiz上的Idol"), "YouTube 搜索", bili("SEVENTEEN Quiz上的Idol"), "B站 搜索", "kr")
add("oh-my-partner", "Oh! 我的搭档", "2020", "出演", "MBN",
    "MBN 搭档默契综艺，成员出演。",
    yt("SEVENTEEN Oh 我的搭档"), "YouTube 搜索", bili("SEVENTEEN Oh 我的搭档"), "B站 搜索", "kr")
add("salon-drip2", "Salon Drip 2", "2023-2025", "多次出演", "Weverse",
    "Weverse 访谈综艺，成员单人及小分队多次做客。",
    "https://weverse.io/seventeen", "Weverse", bili("SEVENTEEN Salon Drip 2"), "B站 搜索", "kr")
add("hal-myungsoo", "hal 明秀", "2022-2024", "出演", "YouTube",
    "李阐浩（明秀）主持的访谈综艺，成员出演。",
    yt("SEVENTEEN hal明秀"), "YouTube 搜索", bili("SEVENTEEN hal明秀"), "B站 搜索", "kr")
add("idol-athletics", "STAR 偶像运动会", "2024", "出演", "MBC",
    "MBC 偶像运动会，SEVENTEEN 组队参赛。",
    "https://www.imbc.com/enter/athletics", "MBC 官网", bili("SEVENTEEN 偶像运动会"), "B站 搜索", "kr")
add("graceful-brother", "报恩的神", "2024", "出演", "Channel A",
    "Channel A 温情综艺，成员出演回馈恩人。",
    yt("SEVENTEEN 报恩的神"), "YouTube 搜索", bili("SEVENTEEN 报恩的神"), "B站 搜索", "kr")
add("sound-cloud", "声破天 (Sound Cloud)", "2024", "出演", "Coupang Play",
    "Coupang Play 音乐脱口秀，成员出演。",
    yt("SEVENTEEN 声破天"), "YouTube 搜索", bili("SEVENTEEN 声破天"), "B站 搜索", "kr")
add("midnight-hotter", "SEVENTEEN 凌晨比白天更火热", "2021", "多集", "Weverse / VLIVE",
    "凌晨时段直播综艺，成员深夜闲聊、游戏、Live 频出。",
    yt("SEVENTEEN 凌晨比白天更火热"), "YouTube 搜索", bili("SEVENTEEN 凌晨比白天更火热"), "B站 搜索", "kr")
add("family-teen", "家族 teen 度过中秋的办法", "2021", "出演", "MBC",
    "MBC 中秋特辑，成员出演。",
    yt("SEVENTEEN 家族teen"), "YouTube 搜索", bili("SEVENTEEN 家族teen"), "B站 搜索", "kr")
add("after-school-club", "After School Club", "2015", "出演", "Arirang TV",
    "Arirang 英文偶像电台，出道初期成员出演。",
    yt("SEVENTEEN After School Club"), "YouTube 搜索", bili("SEVENTEEN After School Club"), "B站 搜索", "kr")
add("boss-watching", "社长在看 (The Boss is Watching)", "2016", "出演", "JTBC",
    "JTBC 职场观察综艺，成员出演。",
    "https://tv.jtbc.co.kr/boss", "JTBC 官网", bili("SEVENTEEN 社长在看"), "B站 搜索", "kr")
add("my-little-tv", "我的小电视 (My Little Television)", "2016", "出演", "MBC",
    "MBC 直播个人放送综艺，成员出演。",
    "https://www.imbc.com/enter/mylittle", "MBC 官网", bili("SEVENTEEN 我的小电视"), "B站 搜索", "kr")
add("star-show-360", "Star Show 360", "2016", "出演", "MBC",
    "MBC 360 度偶像综艺，成员出演。",
    "https://www.imbc.com/enter/starshow", "MBC 官网", bili("SEVENTEEN Star Show 360"), "B站 搜索", "kr")
add("space-shower", "Space Shower TV / M-ON! TV", "2018", "出演", "日本音乐台",
    "日本音乐频道专访/打歌出演，SEVENTEEN 日本活动相关。",
    yt("SEVENTEEN Space Shower"), "YouTube 搜索", bili("SEVENTEEN Space Shower"), "B站 搜索", "kr")
add("iqiyi-fanfest", "爱奇艺粉丝嘉年华", "2018", "出演", "爱奇艺",
    "爱奇艺粉丝嘉年华，SEVENTEEN 中国活动出演。",
    yt("SEVENTEEN 爱奇艺粉丝嘉年华"), "YouTube 搜索", bili("SEVENTEEN 爱奇艺粉丝嘉年华"), "B站 搜索", "kr")
add("mbc-bif-live", "MBC X Bif Live", "2017", "出演", "MBC",
    "MBC 直播音乐节目，成员出演。",
    "https://www.imbc.com/enter/bif", "MBC 官网", bili("SEVENTEEN Bif Live"), "B站 搜索", "kr")
add("ean-pd", "EAN PD 粉丝制作人", "2017", "出演", "YouTube",
    "粉丝制作人企划综艺，成员出演。",
    yt("SEVENTEEN EAN PD"), "YouTube 搜索", bili("SEVENTEEN EAN PD"), "B站 搜索", "kr")
add("dog-show", "姜亨希的狗狗秀", "2018", "出演", "YouTube",
    "宠物主题综艺，成员出演。",
    yt("SEVENTEEN 狗狗秀"), "YouTube 搜索", bili("SEVENTEEN 狗狗秀"), "B站 搜索", "kr")

# Dingo Music 系列合并（多期去重）
add("dingo-music", "Dingo Music SEVENTEEN 企划", "2017-2024", "多期", "Dingo Music / YouTube",
    "Dingo Music 与 SEVENTEEN 的系列合作，包含《奇怪的寿司店》《花样实习生》《济州岛游记》《未来日记》《无厘头提问》《黑手党舞蹈》《可爱+帅气小十七》《AMIGO TV》等爆款企划。",
    "https://www.youtube.com/@dingomusic", "Dingo Music", bili("SEVENTEEN Dingo Music"), "B站 搜索", "kr")

# ---------- 中国 / 海外综艺 (cn) ----------
add("happiness", "快乐大本营", "2016-2019", "多次出演", "湖南卫视",
    "湖南卫视国民综艺，SEVENTEEN 多次出演，早期打开中国认知度的关键舞台。",
    yt("SEVENTEEN 快乐大本营"), "YouTube 搜索", bili("SEVENTEEN 快乐大本营"), "B站 搜索", "cn")
add("hello-saturday", "你好星期六", "2022", "出演", "湖南卫视",
    "湖南卫视周播综艺（原快乐大本营接档），成员出演。",
    yt("SEVENTEEN 你好星期六"), "YouTube 搜索", bili("SEVENTEEN 你好星期六"), "B站 搜索", "cn")
add("youth-with-you", "青春有你 1", "2019", "导师", "爱奇艺",
    "爱奇艺选秀，部分成员担任舞蹈导师。",
    yt("SEVENTEEN 青春有你"), "YouTube 搜索", bili("SEVENTEEN 青春有你"), "B站 搜索", "cn")
add("chuang-asia", "创造营亚洲 2", "2024", "导师", "腾讯视频",
    "腾讯视频国际选秀，成员担任导师。",
    yt("SEVENTEEN 创造营亚洲"), "YouTube 搜索", bili("SEVENTEEN 创造营亚洲"), "B站 搜索", "cn")
add("youth-4", "青春环游记 4", "2023", "出演", "浙江卫视",
    "浙江卫视旅行综艺，成员出演。",
    yt("SEVENTEEN 青春环游记4"), "YouTube 搜索", bili("SEVENTEEN 青春环游记4"), "B站 搜索", "cn")
add("youth-5", "青春环游记 5", "2024", "出演", "浙江卫视",
    "浙江卫视旅行综艺第五季，成员出演。",
    yt("SEVENTEEN 青春环游记5"), "YouTube 搜索", bili("SEVENTEEN 青春环游记5"), "B站 搜索", "cn")
add("msttt", "密室大逃脱 5", "2023", "出演", "芒果TV",
    "芒果TV 实景解密综艺，成员出演。",
    yt("SEVENTEEN 密室大逃脱"), "YouTube 搜索", bili("SEVENTEEN 密室大逃脱"), "B站 搜索", "cn")
add("mentan", "萌探探探案", "2021", "出演", "爱奇艺",
    "爱奇艺剧本杀综艺，成员出演。",
    yt("SEVENTEEN 萌探探探案"), "YouTube 搜索", bili("SEVENTEEN 萌探探探案"), "B站 搜索", "cn")
add("tyzj", "潮音战纪", "2018", "出演", "广东卫视",
    "广东卫视音乐竞演，成员出演。",
    yt("SEVENTEEN 潮音战纪"), "YouTube 搜索", bili("SEVENTEEN 潮音战纪"), "B站 搜索", "cn")
add("supernova", "超新星运动会", "2020", "出演", "腾讯视频",
    "腾讯视频跨界运动会，成员参赛。",
    yt("SEVENTEEN 超新星运动会"), "YouTube 搜索", bili("SEVENTEEN 超新星运动会"), "B站 搜索", "cn")
add("taste-good", "听说很好吃", "2021", "出演", "安徽卫视",
    "安徽卫视美食综艺，成员出演。",
    yt("SEVENTEEN 听说很好吃"), "YouTube 搜索", bili("SEVENTEEN 听说很好吃"), "B站 搜索", "cn")
add("paris-partner", "巴黎合伙人", "2024", "出演", "芒果TV",
    "芒果TV 中法文化交流综艺，成员出演。",
    yt("SEVENTEEN 巴黎合伙人"), "YouTube 搜索", bili("SEVENTEEN 巴黎合伙人"), "B站 搜索", "cn")
add("youni", "由你音乐榜", "2020", "出演", "腾讯视频",
    "腾讯视频音源榜单节目，成员出演。",
    yt("SEVENTEEN 由你音乐榜"), "YouTube 搜索", bili("SEVENTEEN 由你音乐榜"), "B站 搜索", "cn")
add("music-billboard-cn", "中国音乐公告牌", "2017", "出演", " Billboard China",
    "Billboard China 打歌/访谈节目，成员出演。",
    yt("SEVENTEEN 中国音乐公告牌"), "YouTube 搜索", bili("SEVENTEEN 中国音乐公告牌"), "B站 搜索", "cn")
add("i-love-idol", "我爱偶像", "2016", "出演", "台视",
    "台湾偶像综艺，成员出演。",
    yt("SEVENTEEN 我爱偶像"), "YouTube 搜索", bili("SEVENTEEN 我爱偶像"), "B站 搜索", "cn")
add("little-teacher", "小学生老师", "2020", "出演", "EBS",
    "EBS 教育综艺，成员出演。",
    yt("SEVENTEEN 小学生老师"), "YouTube 搜索", bili("SEVENTEEN 小学生老师"), "B站 搜索", "cn")
add("house-voice", "家大声", "2021", "出演", "tvN",
    "tvN 家庭音乐综艺，BSS（夫硕顺）出演。",
    yt("SEVENTEEN 家大声"), "YouTube 搜索", bili("SEVENTEEN 家大声 BSS"), "B站 搜索", "cn")
add("sana-fridge", "SANA 的冰箱采访", "2021", "出演", "YouTube",
    "TWICE SANA 主持的采访企划，成员做客。",
    yt("SEVENTEEN SANA 冰箱采访"), "YouTube 搜索", bili("SEVENTEEN SANA 冰箱采访"), "B站 搜索", "cn")

# ---------- 音乐 / 电台 (music) ----------
add("killing-voice", "Killing Voice", "2023", "出演", "Dingo Music / YouTube",
    "Dingo Music 现场 vocal 企划，SEVENTEEN 展现稳定 live 实力。",
    "https://www.youtube.com/@dingomusic", "Dingo Music", bili("SEVENTEEN Killing Voice"), "B站 搜索", "music")
add("amigo-tv", "AMIGO TV SEVENTEEN 篇", "2017", "出演", "Dingo Music / YouTube",
    "Dingo Music 成员友好互动企划。",
    "https://www.youtube.com/@dingomusic", "Dingo Music", bili("SEVENTEEN AMIGO TV"), "B站 搜索", "music")

# ---------- Going Seventeen 分集展开 ----------
# 根据用户提供的《Going Seventeen 节目列表.xlsx》，把每一期/每组集数生成独立条目，
# 保留上方的总览条目。link/biliLink 先用搜索链接占位，方便后续替换成精确跳转链接。
def expand_going_seventeen():
    import openpyxl
    path = r"C:\Users\EDY\Documents\xwechat_files\wxid_d2tswczcilzq12_ccac\temp\RWTemp\2026-09\2f6b875213ac3f03c98bae6fec0cddfc\Going_Seventeen_节目列表.xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Going Seventeen 节目列表"]
    existing_ids = set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        idx, year_raw, ep_raw, theme, watched = row[:5]
        if not year_raw or not ep_raw:
            continue
        year = str(int(year_raw)) if isinstance(year_raw, (int, float)) else str(year_raw).strip()
        ep = str(ep_raw).strip()
        theme = (theme or "").strip()
        if not theme:
            theme = "（暂无主题）"
        # 生成 id slug：EP 1 -> ep01，EP 6.7 -> ep06-07，EP 18~20 -> ep18-20，特别篇 -> special-<主题>
        if "特别篇" in ep:
            slug_theme = re.sub(r"[^\w\s-]", "", theme).strip().replace(" ", "-")[:24]
            ep_slug = f"special-{slug_theme}"
        else:
            ep_norm = ep.lower().replace(" ", "").replace("ep", "").replace(".", "-").replace("~", "-")
            parts = [p.zfill(2) if p.isdigit() else p for p in ep_norm.split("-")]
            ep_slug = "ep" + "-".join(parts)
        eid = f"going-seventeen-{year}-{ep_slug}"
        if eid in existing_ids:
            for suffix in range(2, 99):
                eid2 = f"{eid}-{suffix}"
                if eid2 not in existing_ids:
                    eid = eid2
                    break
        existing_ids.add(eid)
        name = f"Going Seventeen {year} {ep}"
        q = f"Going Seventeen {ep} {theme}"
        add(eid, name, year, ep, "YouTube / Weverse", theme,
            "https://www.youtube.com/results?search_query=going+seventeen", "YouTube", bili(q), "B站 搜索", "official")

expand_going_seventeen()

# ---------- 零站 B站链接统一换成 B站搜索（用户要求：b站零站全部换成b站搜索） ----------
for e in E:
    if "b23.tv" in e["biliLink"] or "218438615" in e["biliLink"]:
        e["biliLink"] = bili(e["name"])
        e["biliLabel"] = "B站 搜索"

# ---------- 去重校验（同名只留一条） ----------
seen = {}
deduped = []
for e in E:
    key = e["name"].strip().lower()
    if key in seen:
        continue
    seen[key] = True
    deduped.append(e)

# 分组顺序
order = {"official": 0, "kr": 1, "cn": 2, "music": 3}
deduped.sort(key=lambda x: (order[x["category"]], x["year"]))

lines = []
lines.append("import type { VarietyShow } from '@/types';")
lines.append("")
lines.append("export const varietyShows: VarietyShow[] = [")
cat_label = {"official": "自制 / 官方综艺", "kr": "韩国综艺出演", "cn": "中国 / 海外综艺", "music": "音乐 / 电台节目"}
last_cat = None
for e in deduped:
    if e["category"] != last_cat:
        lines.append(f"  // {cat_label[e['category']]}")
        last_cat = e["category"]
    ep = e["episodes"]
    ep_s = f"'{ep}'" if isinstance(ep, str) else str(ep)
    desc = e["description"].replace("\\", "\\\\").replace("'", "\\'")
    link = e["link"].replace("'", "\\'")
    linkLabel = e["linkLabel"].replace("'", "\\'")
    bili = e["biliLink"].replace("'", "\\'")
    biliLabel = e["biliLabel"].replace("'", "\\'")
    block = [
        "  {",
        f"    id: '{e['id']}',",
        f"    name: '{e['name']}',",
        f"    year: '{e['year']}',",
        f"    episodes: {ep_s},",
        f"    platform: '{e['platform']}',",
        f"    description: '{desc}',",
        f"    link: '{link}',",
        f"    linkLabel: '{linkLabel}',",
        f"    biliLink: '{bili}',",
        f"    biliLabel: '{biliLabel}',",
        f"    category: '{e['category']}',",
        "  },",
    ]
    lines.extend(block)
lines.append("];")
lines.append("")

out = "C:/Users/EDY/WorkBuddy/2026-07-28-16-16-02/app/src/data/variety.ts"
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"生成完成：共 {len(deduped)} 条（去重后），分组统计：")
from collections import Counter
c = Counter(e["category"] for e in deduped)
for k, v in c.items():
    print(f"  {cat_label[k]}: {v}")
