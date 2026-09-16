# 克拉SAY 云端回忆册 · Supabase 配置指南（图文步骤）

> 目标：让「克拉 SAY」里所有访客上传的照片，都能在**同一个云端相册**里被所有人浏览。
> 全程免费（Supabase 免费额度足够个人粉丝站使用）。预计耗时 10–15 分钟。

---

## 一、整体流程一览

```
1. 注册 Supabase → 新建一个项目
2. 在 Storage 里建一个「公开桶」caratsay
3. 给这个桶加一条「允许匿名上传/读取/删除」的策略（关键！否则上传会被拒）
4. 拿到 Project URL 和 anon key
5. 把密钥填进项目（.env 或直接改 config/cloud.ts）
6. 重新构建 + 部署
```

---

## 二、Step 1 — 注册并新建项目

1. 打开 https://supabase.com ，点右上角 **Start your project** / **Sign Up**（可用 GitHub 登录）。
2. 登录后进入 Dashboard，点 **New project**。
3. 填写：
   - **Name**：随便填，例如 `seventeen-caratsay`
   - **Database Password**：记下来（只是数据库密码，前端用不到，但别忘）
   - **Region**：选离你近的，例如 `Northeast Asia (Tokyo)` 或 `Singapore`
   - **Pricing Plan**：选 **Free**
4. 点 **Create new project**，等待约 1–2 分钟初始化完成。

---

## 三、Step 2 — 创建公开桶 `caratsay`

1. 进入项目后，左侧菜单点 **Storage**（图标像数据库的柱子）。
2. 点右上角 **New bucket**。
3. 填写：
   - **Name**：`caratsay`（必须和代码里一致，区分大小写）
   - ✅ 勾选 **Public bucket**（公开桶，这样上传后的图片任何人都能直接访问）
4. 点 **Create bucket**。

> ⚠️ 桶名必须叫 `caratsay`。如果改了别的名字，请同步修改 `.env` 里的 `VITE_SUPABASE_BUCKET` 或 `config/cloud.ts` 的 `FALLBACK.bucket`。

---

## 四、Step 3 — 设置权限策略（最关键的一步）

公开桶只是「能读」，但**上传（insert）和列举（list）仍需要显式授权**，否则访客上传会报 `403 / 401` 错误。下面两种方式任选其一。

### 方式 A：用 SQL 一键添加（最快，推荐）

1. 左侧菜单点 **SQL Editor**（图标 `</>`）。
2. 点 **New query**，把下面整段粘进去，点 **Run**：

```sql
-- 允许匿名读取 / 列举 回忆册里的图片
create policy "anon read caratsay"
on storage.objects for select
to anon
using ( bucket_id = 'caratsay' );

-- 允许匿名上传图片（写入）
create policy "anon insert caratsay"
on storage.objects for insert
to anon
with check ( bucket_id = 'caratsay' );

-- 允许匿名删除（文件名是随机串，只有上传者本地持有，安全）
create policy "anon delete caratsay"
on storage.objects for delete
to anon
using ( bucket_id = 'caratsay' );
```

看到 `Success. No rows returned` 即表示三条策略已生效。

### 方式 B：用界面点选添加

1. 左侧菜单点 **Storage → Policies**（在 Storage 下面）。
2. 找到 `caratsay` 桶对应的 **storage.objects** 策略区。
3. 点 **New Policy**，选 **For full customization**：
   - **Policy name**：`anon read caratsay`
   - **Allowed operation**：勾 **SELECT**
   - **Target roles**：选 `anon`
   - **Using expression**：`bucket_id = 'caratsay'`
   - 点 **Review** → **Save policy**
4. 再点 **New Policy**，同样方式加一条：
   - **Policy name**：`anon insert caratsay`
   - **Allowed operation**：勾 **INSERT**
   - **Target roles**：`anon`
   - **With check expression**：`bucket_id = 'caratsay'`
5. 再点 **New Policy** 加删除策略：
   - **Policy name**：`anon delete caratsay`
   - **Allowed operation**：勾 **DELETE**
   - **Target roles**：`anon`
   - **Using expression**：`bucket_id = 'caratsay'`

> 说明：照片文件名形如 `hoshi__1754880000000__k3f9ab.jpg`，随机串只有上传者浏览器知道，所以「允许匿名删除」不会被人误删别人的图。

---

## 五、Step 4 — 获取 Project URL 和 anon key

1. 左侧菜单最下方点 **Project Settings**（齿轮图标）。
2. 左侧点 **Data API**（在 `API` 分类下）。
3. 复制两个值：
   - **Project URL**：形如 `https://abcdefg.supabase.co` → 填 `VITE_SUPABASE_URL`
   - **anon public** 那一长串 `eyJ...` → 填 `VITE_SUPABASE_ANON_KEY`

---

## 六、Step 5 — 把密钥填进项目

任选一种：

### 方式 1：用 .env（推荐，密钥不进源码 / 不进 git）

在项目根目录 `app/` 下，把 `.env.example` 复制为 `.env` 并填入：

```bash
# app/.env
VITE_SUPABASE_URL=https://abcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...（很长）
VITE_SUPABASE_BUCKET=caratsay
```

### 方式 2：直接改代码

打开 `app/src/config/cloud.ts`，修改顶部 `FALLBACK`：

```ts
const FALLBACK = {
  url: 'https://abcdefg.supabase.co',
  anonKey: 'eyJhbGciOiJI...',
  bucket: 'caratsay',
};
```

> 判断生效：构建部署后，页面顶部状态条会显示绿色圆点 + 「🌐 云端回忆册已连接 · 共 N 张」；若仍是「💾 本地模式」，说明密钥没填对或策略没加。

---

## 七、Step 6 — 重新构建 + 部署

```bash
cd app
npm install        # 若依赖已装可跳过
npm run build      # 会读取 .env，把密钥打进 dist/
```

然后把 `app/dist` 部署到 CloudStudio（或你常用的静态托管）。
部署完成后，上传任意一张图，刷新页面（甚至换浏览器 / 换设备）应该都能看到——共享相册就通了 ✅

---

## 八、常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 上传后报 `401 / 403` | 没加 INSERT 策略 | 回到 Step 3 加 `anon insert` 策略 |
| 列表一直为空 / `云端读取失败` | 没加 SELECT 策略，或桶名拼错 | 检查策略 + 桶名是否 `caratsay` |
| 顶部显示「本地模式」 | `VITE_*` 没生效或 `.env` 不在 `app/` 下 | 确认 `.env` 位置；或改用 Step 5 方式 2 |
| 图片能上传但别人看不到 | 桶不是 Public | Storage 里把 `caratsay` 设为 Public |
| 换设备看不到自己之前传的 | 之前在「本地模式」传的，只在旧浏览器 | 用页面上的「☁️ 同步本地 N 张到云端」按钮补传 |
| 上传报 `storage/QuotaExceeded` | 免费额度用满（1GB） | 在 Storage 里手动删旧图，或升级计划 |

---

## 九、容量与费用参考（Free 计划）

- Storage：1 GB 免费（足够上万张压缩后的神图）
- 月下载流量：5 GB 免费
- 上传/读取走 anon key，不计费
- 个人粉丝站基本用不满，长期 0 成本。
