export interface Tenant {
  id: string; // 租户唯一标识，如 'default'、'chuan'、'yue'
  name: string; // 租户/门店名称
  logo: string; // 门店Logo
  slogan: string; // 门店特色标语
  description?: string; // 门店介绍
  phone?: string; // 门店联系电话
  address?: string; // 门店详细地址
  status: number; // 1 = 正常营业, 0 = 暂停营业
  created_at?: string;
  updated_at?: string;
}

export interface Dish {
  id: number;
  tenant_id?: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image: string;
  status: number; // 1 = 在售, 0 = 已下架
  taste_options?: string; // 菜品定制口味/做法选项（逗号分隔，如："微辣,不辣,免葱花,不要香菜,少盐少油,米饭先上"）
  created_at?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: string;
  tenant_id?: string;
  dish_id: number;
  dish_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  taste?: string; // 该菜品所选口味定制，如 "微辣,免葱花"
}

export interface Order {
  id: string;
  tenant_id?: string;
  table_no: string;
  order_type: '堂食' | '外卖';
  delivery_address?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  payment_timing: '餐前付款' | '餐后结账';
  payment_status: '未支付' | '已支付';
  total_amount: number;
  points_used: number;
  points_discount: number;
  points_earned: number;
  final_amount: number;
  status: '待处理' | '制作中' | '已完成' | '已取消';
  handler_name?: string; // 处理该订单的接单员姓名（staff 处理留痕）
  handler_phone?: string; // 处理该订单的接单员手机号（用于多接单员数据隔离）
  handler_id?: number; // 处理该订单的接单员ID
  notes: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface CartItem {
  dish: Dish;
  quantity: number;
}

export interface DiningTable {
  id: number;
  tenant_id?: string;
  name: string;
  is_occupied: number; // 0=空闲, 1=已占用
  sort_order: number;
  created_at?: string;
}

export interface AppUser {
  id: string;
  tenant_id?: string;
  phone?: string;
  name?: string;
  is_verified: number; // 0=未实名, 1=已实名
  points: number;
  balance: number;
  total_spent: number;
  delivery_address?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffUser {
  id: number;
  tenant_id?: string;
  name: string;
  phone: string;
  role: string; // 'order_handler' = 接单员
  enabled: number; // 1=启用, 0=停用
  created_at?: string;
  updated_at?: string;
}

export interface AppSettings {
  tenant_id?: string;
  payment_qr_code: string;
  points_ratio: number; // e.g. 1 means 1%
  custom_domain?: string; // 自定义扫码点餐根域名（用于微信直接打开及生产环境绑定域名）
  restaurant_name?: string; // 店面名称，例如：客来香·家常菜馆
  restaurant_logo?: string; // 店面图标/Logo图片地址
  restaurant_slogan?: string; // 店面特色标语/副标题，例如：地道现炒 · 现点现做
  enable_dine_in?: number; // 消费就餐方式: 1=开启到店堂食, 0=关闭 (默认1)
  enable_takeout?: number; // 消费就餐方式: 1=开启送餐到家(外卖), 0=关闭 (默认1)
  require_table_no?: number; // 就餐桌号配置: 1=必须选桌号, 0=允许无需桌号/非必填 (默认1)
  table_input_mode?: 'select' | 'input' | 'both'; // 桌号选择方式: 'select'下拉选桌, 'input'手输桌号, 'both'两者皆可 (默认'select')
  enable_pay_before?: number; // 支付付款时机: 1=开启餐前付款(立付), 0=关闭 (默认1)
  enable_pay_after?: number; // 支付付款时机: 1=开启餐后结账(先吃后付), 0=关闭 (默认1)
  // 在线支付通道（虎皮椒）公开配置——密钥 xhu_secret 永不下发前端，仅下发是否已配置的标志
  pay_mode?: 'static' | 'xunhupay'; // 支付模式: 'static'=静态收款码(顾客自助确认), 'xunhupay'=动态在线支付(回调自动确认) (默认'static')
  xhu_appid?: string; // 虎皮椒 APPID（非密钥，供后台表单回显）
  xhu_gateway?: string; // 虎皮椒支付网关（正式/备用平台可切换）
  pay_notify_base?: string; // 公网回调基址（如 Render 域名或 cpolar 隧道域名，不带尾部斜杠）
  xhu_secret_configured?: number; // 密钥是否已配置: 1=已配置, 0=未配置
  pay_channel_ready?: number; // 动态支付通道就绪标志: 1=模式开启且三要素齐全, 0=未就绪（前端回退静态码）
  // 大模型 (AI大脑) 配置
  llm_base_url?: string; // 大模型服务端点，例如：https://apihub.agnes-ai.com/v1
  llm_api_key?: string; // 大模型授权访问密钥 (API Key)
  llm_text_model?: string; // 文本大模型，例如：Agnes-2.5-flash
  llm_image_model?: string; // 图片/多模态大模型，例如：Agnes-Image-2.1-flash
  llm_auto_process_images?: number; // 开启上传大图自动智能处理与压缩优化: 1=开启, 0=关闭 (默认1)
  llm_max_image_dimension?: number; // 智能处理最大宽高尺寸限制（像素），默认1200
  llm_image_quality?: number; // 智能处理压缩画质 (1-100)，默认82
  // 自动打印模块配置
  auto_print_enabled?: number; // 开启自动打印: 1=开启, 0=关闭 (默认0)
  printer_type?: 'webhook' | 'feie' | 'yilianyun'; // 打印机服务类型 ('webhook' | 'feie' | 'yilianyun')
  printer_name?: string; // 打印机名称 (如: 前台58mm热敏收银机 / 后厨80mm出单机)
  printer_sn?: string; // 打印机设备号 / 终端号 / SN 码
  printer_key?: string; // 打印机密钥 (KEY / APPSECRET)
  printer_webhook_url?: string; // Webhook / 打印服务接口地址 (HTTP/HTTPS POST)
  printer_secret_token?: string; // Webhook 自定义 Bearer Token / 签名秘钥
  printer_copies?: number; // 打印联数 (1-3联，默认1)
  printer_ticket_header?: string; // 小票抬头（默认使用店面名称）
  printer_ticket_footer?: string; // 小票底部寄语 (如: 谢谢惠顾，欢迎再次光临！)
  // 邮件通知 (QQ 邮箱 SMTP) 服务配置
  smtp_host?: string; // SMTP 发信服务器，默认 smtp.qq.com
  smtp_port?: number; // SMTP 端口，默认 465 (备用 587)
  smtp_secure?: number; // 加密方式: 1=SSL/TLS(465), 0=STARTTLS(587)
  smtp_user?: string; // 发信 QQ 邮箱账号，默认 527194933@qq.com
  smtp_pass?: string; // QQ 邮箱 16 位 SMTP 独立授权码 (如: rvlehugdnsmccajh)
  notify_email_to?: string; // 接收订单通知的目标邮箱，默认 527194933@qq.com
  smtp_timeout?: number; // 网络连接超时（秒），默认 15 秒
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  textModel: string;
  imageModel: string;
  autoProcessImages?: boolean;
  maxDimension?: number;
  quality?: number;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseUrl: 'https://apihub.agnes-ai.com/v1',
  apiKey: 'sk-vWM7RHG5n7bljBNi3GgHfygxqiKlUYrPWZLLSUByIGm4BiM9',
  textModel: 'Agnes-2.5-flash',
  imageModel: 'Agnes-Image-2.1-flash',
  autoProcessImages: true,
  maxDimension: 1200,
  quality: 82,
};
