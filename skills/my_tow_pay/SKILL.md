---
name: "my_tow_pay"
description: >
  双模式收款体系技能：为中小商户应用（订餐/商城/预约等）快速落地"静态收款码 + 动态在线支付"
  两套互补的收款方案。模式一（静态收款码·零成本）：先建单后支付、三重门禁确认按钮（每次随机 20~28 秒
  延迟 + 长按识别检测 + 页面可见性往返 + 45 秒防锁死逃生口），按钮状态盲化——不显示倒计时/等待提示，
  不给谎报者"等待过期"信号；积分比例随机即时立减（实付=标价−random(0.01, 标价×积分比例)），
  尾数随机防同价订单撞账。模式二（动态在线支付·虎皮椒个人聚合）：无营业执照个人微信/支付宝收款接入，
  MD5 签名、动态金额二维码、支付成功异步回调自动确认到账、验签/金额比对/幂等三重回调安全链、
  多租户各自绑定凭据、通道故障自动回退静态码。触发词：收款、支付、扫码支付、静态收款码、谎报已支付、
  虎皮椒、xunhupay、个人免签支付、支付回调、积分立减、随机尾数、支付防作弊、支付门禁。
  参考实现：dingcan_postgresql（Next.js 15 App Router + Neon PostgreSQL，2026-11 全链路实测）；
  技能自带 references/ 黄金模板（签名库/三路由/双模式弹窗/DDL/接线指南），跨项目可直接复制落地。
---

# MyTowPay: 双模式收款体系（静态收款码 + 动态在线支付）

## 0. 技能定位与选型速查

任何需要收钱的应用，先回答一个问题：**商户有没有营业执照 + 愿不愿意付通道费？**

| 场景 | 选用 | 成本 | 到账确认方式 |
|---|---|---|---|
| 个人收款码、零成本起步、有店员可对账 | 模式一：静态收款码 | 0 | 顾客自助声明 + 三重门禁 + 金额尾数对账 |
| 无执照但想全自动确认、杜绝谎报 | 模式二：虎皮椒动态支付 | 费率约 1%~2.5% | 服务端回调自动确认，顾客零操作 |
| 已有营业执照 | 直接走微信/支付宝官方 Native(扫码) 通道，费率 ~0.6%，本技能模式二的接入框架同样适用（换 SDK 即可） | — | 官方回调 |

**两条铁律（两种模式通用）：**

1. **先建单，后支付。** 订单必须先以「未支付」落库，再进入支付环节。确认按钮/回调只负责翻转支付状态。这同时消灭两个经典漏洞：顾客付了钱没点按钮→店里无订单；顾客没付钱点了按钮→订单直接带"已支付"。
2. **金额永远由服务端裁定。** 顾客实付金额 = 订单表 `final_amount`（服务端算好），任何前端传参不可信。弹窗展示金额、通道下单金额、对账基准，三者必须同源。

参考实现（本项目内，可直接对照复制）：

```
lib/xunhupay.ts                        虎皮椒签名/验签/下单客户端
app/api/pay/create/route.ts            拉起支付（幂等）
app/api/pay/notify/route.ts            支付回调（安全链）
app/api/pay/status/route.ts            前端轮询
components/PaymentModal.tsx            双模式支付弹窗（门禁/轮询/立减展示/动态码倒计时）
components/OrderingClient.tsx          先建单后支付主流程
components/OrderStatusModal.tsx        订单详情"立即结账"复用弹窗
components/admin/SettingsManagement.tsx  后台支付通道配置卡片
lib/db.ts                              createOrder 立减逻辑 + pay_records helpers
```

**本技能自带跨项目黄金模板** `references/`：xunhupay.ts、pay_create_route.ts、pay_notify_route.ts、
pay_status_route.ts、PaymentModal.tsx、ddl.sql、integration_guide.md（db 函数/立减段/settings 键/
下单状态机/验证方法论接线指南）——脱离本项目即可复制落地。

**金额同源链**：购物车标价 →（服务端 createOrder 算立减）→ 订单 final_amount →（弹窗展示）
→（通道下单金额）→（微信账单对账基准）。四者必须同源同值，任何环节金额来源不同就是 bug。

---

## 1. 模式一：静态收款码（默认·零成本）

### 1.1 架构与流程

```
顾客提交购物车
   │ POST /api/orders（paymentStatus=未支付）→ 服务端计算立减后的 final_amount
   ▼
支付弹窗（展示：立减后实付金额 + 店内静态收款码图片）
   │ 顾客长按识别 → 微信收款面板（页面切后台）→ 输入金额付款 → 返回页面（切前台）
   ▼
确认按钮通过三重门禁后可点 → PATCH /api/orders/[id] {paymentStatus:'已支付'}
   ▼
订单状态弹窗 / 后台语音邮件通知
```

### 1.2 三重门禁（防误点 + 防随手谎报）

确认按钮的可点条件：

```
移动端： canConfirm = ( 随机延迟已过(20~28s) && 长按已检测 && "切出→切回"往返已发生 ) || 累计停留 ≥ 45s
桌面端： canConfirm = 随机延迟已过(20~28s)      （无切页行为，仅时间门）
```

实现要点：

- **长按检测**：在二维码容器 div 上监听 `onPointerDown/onPointerUp`，按压 ≥400ms 记为长按；`onContextMenu` 兜底（移动端长按会触发）。**不要 preventDefault**——会杀掉微信自己的"识别二维码"菜单，只做记录。
- **可见性往返**：`document.visibilitychange` — hidden 时置 `hiddenOnce=true`，再变 visible 且 `hiddenOnce` → 记为"已返回"。微信内长按识别成功、收款面板弹出时页面必切后台，付款返回时切回——这是与"真的去付款"高度相关的信号。iOS/Android 微信内置浏览器均支持。
- **逃生口必须有**：个别机型浏览器事件行为异常，真付了钱的顾客不能被困死。45 秒后无条件放行。
- **信息披露原则（门禁 UI 核心设计）**：只展示"动作做没做到"，绝不展示"还差多久、卡在哪道门"——
  - **展示**：二维码下方两步进度徽标「① 长按识别二维码 ✓ / ② 支付后返回本页 ✓」。诚实顾客当操作指引，谎报者当威慑明示。
  - **隐藏**：门禁未过时占位按钮只显示一句静态文案「请先完成二维码支付」——无倒计时数字、无脉冲动画、无"稍候即可确认"类等待提示。倒计时/等待提示等于向谎报者发"可以开抢"的发令枪（掐点干等即可）；计时阶段与动作门禁阶段共用同一文案，界面无法分辨处于哪种状态；延迟每次随机 20~28s，惯犯无法靠多次尝试摸清节奏。通过后绿色按钮「我已完成扫码支付」。
- 「稍后再付/关闭」按钮**永不延迟永不禁用**——不能把顾客锁在弹窗里。

> 局限要向商户讲明：这是启发式防线，能挡住误点和随手谎报，蓄意作弊者照做一遍动作仍可通过。硬保证靠 1.3 的金额对账或模式二。

### 1.3 积分即时立减（随机尾数·可对账）

静态码顾客要手动输金额——把这个动作变成对账证据：

```
立减上限 = (total - 会员积分抵现) × 积分比例           // 服务端 createOrder 内计算
instantRebate = random(0.01, 立减上限) 精确到分        // 随机立减，每单尾数不同
final_amount  = total - 会员积分抵现 - instantRebate
points_earned = 0                                     // 立减即积分兑现，绝不双重赠送
```

- 例：积分比例 1%（消费100得1分、1分=1元），18 元订单实付在 **17.82 ~ 17.99 间随机**（如 17.99、17.95、17.87）。顾客永远比标价付得少；每单尾数随机不重复，**两单同价订单绝不"撞尾数"**——固定公式立减（18→恒为17.82）会让同价订单对账歧义，随机尾数是关键。
- 语义提示商户：此模式下"积分比例"= 立减上限比例（0.01 ~ 上限间随机兑现），设 0 关闭。
- 数据库：orders 表加列 `instant_rebate DOUBLE PRECISION NOT NULL DEFAULT 0`（ALTER IF NOT EXISTS 幂等迁移，历史订单默认 0）。
- 订单详情/弹窗金额区显示「积分即时返 · 扫码立减 ¥0.xx」，避免顾客困惑为什么实付比标价低。

### 1.4 弹窗提示语（按端自适应）

手机端顾客**无法扫自己的屏幕**（识别语义）；电脑端二维码是给顾客手机扫的（扫描语义 + 写明精确金额）：

- 手机端 ✅「请您识别上面二维码，如实支付显示金额」／❌「请打开手机扫一扫完成支付」（手机端无法执行）
- 电脑端 ✅「请用手机「扫一扫」上方二维码，如实输入金额 **¥17.93** 完成支付」——把带随机尾数的实付金额写进提示，顾客照抄即与订单/账单对上

---

## 2. 模式二：动态在线支付（虎皮椒 XunhuPay）

### 2.1 接入前提（个人无营业执照）

- 注册 admin.xunhupay.com（正式平台）/ admin.dpweixin.com（备用平台），实名签约个人微信/支付宝收款。
- 商户后台「支付渠道管理」取 **appid + appsecret**（复制勿带空格）。
- 资金直达个人微信/支付宝（官方清算），费率约 1%~2.5% 以签约页为准。
- 运营主体：重庆直数电子科技有限公司（渝 B2-20240653，支付协会备案），同类个人聚合中资质较全。
- **回调地址必须公网可达**：Render/Vercel 公网部署天然满足；本机 Docker 用 cpolar 隧道（免费版域名会变，变更后同步改配置）。

### 2.2 API 要点（文档 xunhupay.com/doc/api/pay.html）

| 项 | 值 |
|---|---|
| 下单网关 | `POST https://api.xunhupay.com/payment/do.html`（备用 `api.dpweixin.com`），JSON 传参 |
| 必填参数 | version=1.1, appid, trade_order_id(≤32位, 字符集0-9A-Za-z_-), total_fee(元), title(≤42汉字,禁%和emoji), time(秒), notify_url, nonce_str, hash |
| 返回 | errcode=0 + `url`(手机端跳转链接,自动识别微信/支付宝) + `url_qrcode`(PC二维码图,**有效期仅5分钟**) |
| 回调 | POST form 到 notify_url：trade_order_id, total_fee, transaction_id, status(**OD**=已支付,CD/RD/UD=退款类), hash |
| 应答 | 必须返回纯文本 `success`，否则重试 6 次 |
| ⚠ 禁忌 | 不能先展示 url_qrcode 再跳 url（文档明确禁止），两者按端二选一 |

**签名算法**（官方 PHP generate_xh_hash 的 TS 等价）：

```ts
import { createHash } from 'crypto';
export function xunhuSign(params: Record<string, string|number|undefined|null>, secret: string): string {
  const base = Object.keys(params)
    .filter(k => k !== 'hash' && params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort()                                            // ASCII 字典序
    .map(k => `${k}=${params[k]}`).join('&') + secret;  // 值不 URL 编码，末尾直拼 secret 无连接符
  return createHash('md5').update(base, 'utf8').digest('hex');  // 32位小写
}
```

验签用同一算法重算比对（`timingSafeEqual`），回传的 hash 本身不参与签名。

- 主动查单兜底（可选扩展）：虎皮椒另有订单查询接口（文档 search.html 页），回调万一丢失可按 trade_order_id 主动查单补状态——对账型商户值得加。

### 2.3 三个接口 + 一张表

**POST /api/pay/create {orderId}**（幂等拉起）
- 校验：租户通道 ready → 订单存在 → 未支付 → 金额>0（0元单/已付单特殊返回）。
- 金额取**服务端订单** final_amount，绝不收客户端传参。
- 幂等：该订单 3.5 分钟内已有 pending 支付记录 → 直接复用返回（防双击重复下单到通道）。
- 商户单号：`{orderId}-{6位hex随机}`（orderId 已内嵌租户前缀，防跨店撞号）。
- 失败返回 `fallback:'static'` → 前端自动回退静态码弹窗。

**POST /api/pay/notify**（回调安全链，顺序固定）
```
解析 form → trade_order_id 定位 pay_records 记录 → 记录反查租户 → 该租户 secret 验签
→ status 必须 OD → 金额与记录比对(误差<0.005, 防改价) → markPayRecordPaid 幂等入账
（仅 pending→paid 首次转换）→ updateOrderPayment(订单置已支付+送积分) → 限时3.5s发确认邮件
→ 返回纯文本 'success'
```
- 邮件/打印等旁路动作失败**绝不阻塞 success 应答**（否则被重试 6 次骚扰）。
- 回调原文 JSON 完整落库——对账与纠纷唯一证据。

**GET /api/pay/status?orderId**（前端 2.5s 轮询）→ 返回 paymentStatus，到账后弹窗自动变绿关闭，顾客零操作。

**pay_records 表**：

```sql
CREATE TABLE IF NOT EXISTS pay_records (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  order_id TEXT NOT NULL,
  trade_order_id TEXT NOT NULL UNIQUE,   -- 虎皮椒商户单号，全局唯一
  gateway TEXT NOT NULL DEFAULT 'xunhupay',
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired
  transaction_id TEXT DEFAULT '',          -- 通道交易号
  url TEXT DEFAULT '', url_qrcode TEXT DEFAULT '',
  callback_raw TEXT DEFAULT '',            -- 回调原文（证据）
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pay_records_tenant_order ON pay_records (tenant_id, order_id);
```

### 2.4 前端双端适配

- **手机端**（主场景，顾客在微信内 H5）：大按钮「立即支付 ¥xx」→ `window.location.href = url`（自动拉起微信/支付宝，金额已带上）。支付完返回页面，轮询自动确认。
- **PC 端**：展示 `url_qrcode` `<img>`（原生 img，勿用 next/image 域名白名单会挡）+ 5 分钟倒计时 + 过期「刷新二维码」（重调 create，服务端幂等）。
- 到账后弹窗变「✓ 支付成功，已自动确认到账」1.2s → 自动关闭进入订单状态页。

### 2.5 多租户与配置管理

settings 键（每租户独立）：

| key | 说明 | 下发前端 |
|---|---|---|
| pay_mode | 'static' \| 'xunhupay'，默认 static（零行为变化） | ✅ |
| xhu_appid | 虎皮椒 APPID | ✅（非密钥） |
| xhu_secret | **密钥，仅服务端** | ❌ 只回 `xhu_secret_configured` 0/1 标志 |
| xhu_gateway | 正式/备用平台可切换 | ✅ |
| pay_notify_base | 公网回调基址（不带尾斜杠） | ✅ |

- 后端 `getPayChannelConfig(tenant)` 服务端专用读全量（含 secret）；`getSettings()` 公开接口只回标志位与合成位 `pay_channel_ready`（mode=xunhupay 且三要素齐全）。
- 后台配置卡片：模式二选一 + 凭据表单（secret 留空=保留已存值）+ 启用须知（费率/回退语义/0.01元验证建议）。
- 回调定位租户：靠 trade_order_id → pay_records.tenant_id 反查（回调请求本身不带可靠租户参数），验签密钥随之确定——**先定位记录，再验签**。

### 2.6 回退链（营业永不断）

```
pay_mode=static（默认） ──完全静态码模式
pay_mode=xunhupay 但凭据不全 → pay_channel_ready=0 → 前端仍走静态码
xunhupay 下单时网关失败/超时 → create 返回 fallback:'static' → 该单自动回退静态码确认流程
备用平台维护 → 后台一键切换 xhu_gateway
```

---

## 3. 新项目落地八步（实施顺序）

1. **DDL**：pay_records 表 + orders.instant_rebate 列（`references/ddl.sql`，幂等，可直接真实库执行）。
2. **settings 键**：pay_mode/xhu_appid/xhu_secret/xhu_gateway/pay_notify_base + getSettings 解析（含 pay_channel_ready 合成位；secret 只存服务端）。
3. **通道库**：`references/xunhupay.ts` 原样拷入 lib/（仅依赖 node:crypto，零第三方依赖）。
4. **支付三路由**：create/notify/status（`references/` 下模板，改 import 路径即用）。
5. **createOrder 立减段**：随机立减 + points_earned=0（摘录见 integration_guide.md §2）。
6. **支付弹窗**：`references/PaymentModal.tsx`（双模式一体：门禁/轮询/立减展示/动态码倒计时/过期刷新）。
7. **下单流程改造**：先建单（未支付）→弹窗→确认仅翻转状态；订单详情"立即结账"复用同一弹窗（状态机见 integration_guide.md §4）。
8. **后台配置卡**：模式二选一 + 凭据表单（secret 留空=保留）+ 回调基址 + 启用须知。

### 上线验证清单

- **静态模式**：下单 → 实付为随机尾数（18 元 × 1% 应落在 17.82~17.99，且**连下两单尾数不同**）→ 手机微信内长按识别 → 两徽标 ✓ → 占位按钮无倒计时 → 门禁过后变绿确认 → 后台已支付、instant_rebate 有值、points_earned=0。
- **电脑端**：提示语为"手机扫一扫 + 精确金额"，不出现"识别二维码"。
- **回归**：餐后结账路径不弹支付窗；积分抵现订单立减基数正确（18 元抵 5 分 → 实付 12.87~12.99）。
- **动态模式**：后台配三要素 → 0.01 元真实支付全链路（拉起→付款→回调→自动确认→邮件）→ 伪造回调（错 hash）被拒 → 重复回调幂等 → 金额篡改被拒 → 网关断网自动回退静态码。

### 工程验证方法论（无本地构建环境时）

tsc strict + 桩模块全量类型检查；签名与官方 PHP 参考的 Python 移植逐向量对拍（含中文值/空值过滤/hash 排除）；DDL 与状态机在真实库临时租户冒烟后清理；弹窗早退后 hook 数静态自检为 0。详见 integration_guide.md §5。

## 4. 踩坑记录（血泪）

- **弹窗组件 Hooks 顺序红线**：PaymentModal 这类 `if (!isOpen) return null` 早退的组件，所有 hook（useState/useMemo/useEffect）必须全部位于早退**之前**——把一个 useMemo 放到早退后面，弹窗关闭→打开两态 hook 数量不一致，首次打开即 React #310 "Rendered more hooks" 白屏崩溃（编译期查不出，只能在渲染时炸）。修完可用脚本静态自检：早退之后 `React.useXxx` 出现次数必须为 0。
- `import crypto from 'crypto'` 在部分编译配置下报"no default export"——统一用命名导入 `import { createHash } from 'crypto'`。
- HTTP 直连部署（Docker 端口映射/内网 IP 访问）登录 cookie 必须 `secure:false`；`NODE_ENV=production` 自动带 Secure 会让局域网 IP 访问"登录成功却无权限"（浏览器静默丢弃 Set-Cookie），localhost 正常极具迷惑性。
- 虎皮椒 url_qrcode 仅 5 分钟有效，PC 端必须做倒计时+过期刷新；复用窗口取 3.5 分钟留安全余量。
- 微信内置浏览器 visibilitychange 可用，但个别安卓 webview 行为异常——必须留逃生口。
- next/image 显示外部二维码图会被 remotePatterns 拦——用原生 `<img>`。
- 通道下单 fetch 必须带 AbortController 超时（10s），网关抖动时及时回退静态码。
- Node 测试脚本模块解析按**脚本所在路径**而非 cwd——脚本要放在 node_modules 同目录下跑。
- 回调应答是纯文本 'success'，不是 JSON——返回 `NextResponse('success')` 而非 `.json()`。

## 5. 与其他技能的协同

- 多租户架构（每分店独立收款凭据、行级隔离）：配合 `mymultenant` 技能。
- 本机 Docker 回调需要公网地址：配合 `mycpolar` 内网穿透技能。
- 海外图片裂图（若静态收款码存 Cloudinary）：配合 `myrepairpic`。
