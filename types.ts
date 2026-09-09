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
}
