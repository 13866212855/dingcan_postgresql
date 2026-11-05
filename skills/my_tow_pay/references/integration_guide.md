# MyTowPay 接线指南（integration guide）

本目录其余文件是经过全链路实测的"黄金模板"（虎皮椒库 / 三个 API 路由 / 双模式弹窗 / DDL）。
本指南补齐它们之间的**接线层**：db 函数、createOrder 立减段、settings 键处理、下单流程状态机、验证方法论。
模板 import 均为 `@/lib/...` / `@/components/...` 形式，拷入新项目后改路径即用。

## 1. db 层：pay_records 五个函数 + 通道配置读取

```ts
// ---- 通道配置（服务端专用，secret 绝不经 API 下发前端）----
export interface PayChannelConfig {
  mode: 'static' | 'xunhupay';
  appid: string; secret: string;
  gateway: string;                     // 默认 https://api.xunhupay.com/payment/do.html
  notifyBase: string;                  // 公网回调基址，去尾部斜杠
  ready: boolean;                      // mode==='xunhupay' && appid && secret && notifyBase
}
export async function getPayChannelConfig(tenantId): Promise<PayChannelConfig> {
  // SELECT key,value FROM settings WHERE tenant_id=$1 AND key IN
  // ('pay_mode','xhu_appid','xhu_secret','xhu_gateway') + 单查 pay_notify_base
}

// ---- 支付记录 ----
createPayRecord({tenantId, orderId, tradeOrderId, amount, url, urlQrcode})   // 每次向通道下单落一行
getReusablePendingPayRecord(tenantId, orderId, withinMs=210000)              // 幂等复用：3.5分钟内 pending 记录
findPayRecordByTradeOrderId(tradeOrderId)                                    // 回调定位：单号→记录→租户
markPayRecordPaid(tradeOrderId, transactionId, callbackRaw)                  // 幂等：仅 pending→paid 返回 firstTime=true
```

关键语义：

- **先定位记录，再验签**——回调请求本身不带可靠租户参数，靠 trade_order_id 反查 pay_records.tenant_id 得到验签密钥。
- `markPayRecordPaid` 用 `UPDATE ... WHERE status='pending' RETURNING *` 的受影响行数判"首次到账"，天然幂等。
- `callback_raw` 完整存回调原文——对账与纠纷的唯一证据。

## 2. createOrder 立减段（模式一核心，插入在 final_amount 计算处）

```ts
const dynamicPayActive = settings.pay_mode === 'xunhupay' && settings.pay_channel_ready === 1;
const rebateCeiling = dynamicPayActive
  ? 0
  : Math.round((total - pointsDiscount) * pointsRatio * 100) / 100;   // 立减上限=原固定公式
const instantRebate =
  rebateCeiling >= 0.01
    ? Math.round((0.01 + Math.random() * (rebateCeiling - 0.01)) * 100) / 100   // 随机分位
    : 0;
const finalAmount = Math.max(0, Math.round((total - pointsDiscount - instantRebate) * 100) / 100);
const pointsEarned = instantRebate > 0 ? 0 : Math.round(finalAmount * pointsRatio * 100) / 100;
// INSERT orders 时带上 instant_rebate 列
```

边界行为（实测）：上限<0.01 → 不立减；上限=0.01 → 恒 0.01；动态模式 → 0（走回调送积分）；
18元×1% → 实付 17.82~17.99 共 18 种；两单同价撞尾数概率从固定立减的 100% 降至 ~5.7%。

## 3. settings 键处理

- getSettings（公开接口）新增返回：`pay_mode`、`xhu_appid`、`xhu_gateway`、`pay_notify_base`、
  `xhu_secret_configured`(0/1 探测标志)、`pay_channel_ready`(合成位)。**永远不返回 xhu_secret 明文**。
- settings POST 新增写入：五个键；`xhu_secret` 仅在管理员输入非空新值时覆盖（留空=保留已存值）。
- 后台配置卡：模式二选一大按钮 + appid/secret(密码框)/网关(正式·备选)/回调基址 + 启用须知。

## 4. 下单流程状态机（前端）

```
handleStartCheckout(orderData):
  匿名拦截（无姓名/手机号）→ 暂存 orderData → 弹「下单登记」窗（姓名+手机必填，
    地址外卖必填/堂食选填，POST /api/users 保存）→ 保存成功后继续
  餐后结账堂食 → executeSubmitOrder('未支付') → 订单状态弹窗（不弹支付）
  动态通道就绪 → executeSubmitOrder('未支付', {deferSuccessUi:true})   ← 先建单（回调挂单必须）
              → POST /api/pay/create → 弹动态弹窗（轮询到账自动确认）
  静态码模式  → 前端选定随机立减 staticRebate（上限=净额×比例）
              → 暂存 orderData → 弹静态码弹窗（此刻不建单！）
              → 顾客付款过门禁点「我已完成扫码支付」→ executeSubmitOrder('已支付',
                 {instantRebate: staticRebate})   ← 此刻才创建订单（已支付）

PaymentModal 门禁：移动端 = 随机延迟(20~28s)已过 && visibilitychange 切出→切回已发生
  （返回信号硬性，时间到也不放行）；桌面端 = 随机延迟已过。
  门禁未过显示静态文案「请先完成二维码支付」（无倒计时/动画——状态盲化）。

静态确认 = POST /api/orders（paymentStatus:'已支付', instantRebate）——订单此刻才落库。
动态回退特例（曾先建单）：确认 = PATCH /api/orders/[id] {paymentStatus:'已支付'}。
finishOrderSuccess()：关弹窗 → activeOrderId=订单 → 刷新用户积分/桌台。
```

服务端 createOrder 对客户端 instantRebate 的校验采用：
```ts
if (!dynamicPayActive && typeof clientRebate === 'number' && isFinite(clientRebate)) {
  const r = Math.round(clientRebate * 100) / 100;
  if (r >= 0.01 && r <= rebateCeiling + 0.005) instantRebate = r;      // 范围内→采用
  else if (r > rebateCeiling + 0.005) instantRebate = rebateCeiling;   // 超限→收敛
}                                                                       // 非法→忽略走随机
```
恶意传值最大损失=立减上限本身；「弹窗金额=落库金额」一致性由前端选定+服务端校验共同保证。

## 5. 验证方法论（四件套，无本地构建环境也能做）

1. **tsc strict 全量类型检查**：临时目录装 typescript + @types/react@18 + @types/node，外部依赖
   （lucide-react/pg/next/server 等）写 `declare module` 桩（注意：给 next/server 写**空壳桩会遮蔽真类型**，
   要么装真 next 包要么写含类型的桩）；strict:true 跑 `tsc -p`，逐条排除桩噪音后应零错误。
2. **签名对拍**：把官方 PHP generate_xh_hash 移植成 Python，与编译后的 xunhuSign 对同一组向量
   （含中文值、空值过滤、hash 字段排除、混合大小写键）逐个比对 MD5；再验 xunhuVerify 拒绝
   篡改字段/错误密钥/空 hash。参考移植：
   ```python
   import hashlib
   def php_hash(datas, secret):
       arg = ''
       for k in sorted(datas.keys()):
           v = datas[k]
           if k == 'hash' or v is None or v == '': continue
           if arg: arg += '&'
           arg += f'{k}={v}'
       return hashlib.md5((arg + secret).encode('utf-8')).hexdigest()
   ```
3. **真实库冒烟**：DDL 幂等执行 → 临时租户插入 pay_record → 复用查询命中 → pending→paid 首次转换
   → 二次回调 no-op → 唯一约束生效 → 清理零残留、真实租户零波及。
4. **弹窗静态自检**：PaymentModal 中 `if (!isOpen) return null;` 早退之后 `React.useXxx` 出现次数必须为 0
   （Hooks 顺序红线，防 #310 崩溃）。

## 6. 后端运行环境注意

- 虎皮椒网关请求必须带 AbortController 超时（10s）。
- 回调应答为**纯文本** `NextResponse('success')`，不是 JSON。
- 通知邮件用 `Promise.race([emailPromise, 3.5s])` 限时，失败不阻塞 success 应答。
