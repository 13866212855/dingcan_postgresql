-- MyTowPay 数据库迁移（全部幂等，可直接在真实库重复执行）
-- 依赖：orders 表已存在（含 tenant_id 列）

-- 模式二：支付流水表（虎皮椒动态支付）
CREATE TABLE IF NOT EXISTS pay_records (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  order_id TEXT NOT NULL,
  trade_order_id TEXT NOT NULL UNIQUE,   -- 虎皮椒商户单号，全局唯一
  gateway TEXT NOT NULL DEFAULT 'xunhupay',
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired
  transaction_id TEXT DEFAULT '',          -- 通道交易号
  url TEXT DEFAULT '',                     -- 手机端支付跳转链接
  url_qrcode TEXT DEFAULT '',              -- PC 端二维码图（5分钟有效）
  callback_raw TEXT DEFAULT '',            -- 回调原文 JSON（对账与纠纷唯一证据）
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pay_records_tenant_order ON pay_records (tenant_id, order_id);

-- 模式一：积分即时随机立减列
ALTER TABLE orders ADD COLUMN IF NOT EXISTS instant_rebate DOUBLE PRECISION NOT NULL DEFAULT 0;

-- settings 键（按需 INSERT 或由后台界面写入；代码默认 static，无需预置）
-- pay_mode: 'static' | 'xunhupay'
-- xhu_appid / xhu_secret / xhu_gateway / pay_notify_base
