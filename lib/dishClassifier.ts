import { OrderItem } from '@/types';

/**
 * 现成常备菜品识别关键词（无需后厨开火起锅，前厅/打包台可直接装配出餐）
 */
const READY_KEYWORDS = [
  '米饭',
  '白饭',
  '大米饭',
  '蒸米饭',
  '五常米饭',
  '馒头',
  '花卷',
  '大饼',
  '主食',
  '泡菜',
  '酸豆角',
  '榨菜',
  '小菜',
  '例汤',
  '紫菜蛋花汤',
  '酸梅汤',
  '饮料',
  '可乐',
  '可口可乐',
  '百事可乐',
  '雪碧',
  '芬达',
  '王老吉',
  '加多宝',
  '矿泉水',
  '纯净水',
  '绿茶',
  '红茶',
  '啤酒',
  '青岛啤酒',
  '雪花啤酒',
  '豆浆',
  '鲜豆浆',
  '椰汁',
  '果汁',
  '凉菜',
  '拍黄瓜',
  '凉拌黄瓜',
  '皮蛋',
  '皮蛋豆腐',
  '凉拌',
  '卤',
  '卤肉',
  '卤蛋',
  '卤豆干',
  '鸭腿',
  '烤鸭腿',
  '卤鸭腿',
  '熟食',
  '冷切',
  '花生米',
  '油炸花生米',
];

const READY_CATEGORIES = ['酒水饮料', '酒水', '饮料', '开胃凉菜', '凉菜', '冷菜', '熟食卤味', '经典主食'];

/**
 * 判断单道菜品是否属于现成/常备预制菜品
 */
export function isReadyMadeDish(dishName: string, category = ''): boolean {
  const name = (dishName || '').trim().toLowerCase();
  const cat = (category || '').trim().toLowerCase();

  // 1. 分类匹配
  if (cat && READY_CATEGORIES.some((c) => cat.includes(c.toLowerCase()))) {
    return true;
  }

  // 2. 菜名关键词匹配
  if (READY_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()))) {
    return true;
  }

  return false;
}

/**
 * 分析整单的菜品构成：
 * - allReadyMade: 全单皆为常备现成菜（如单纯米饭+烤鸭腿+可乐），支持「⚡ 一键齐餐出餐」
 * - hasCooking: 含有需要后厨起锅热炒或深加工的热菜（如招牌红烧肉、麻婆豆腐、炒时蔬）
 */
export function classifyOrderDishes(items?: OrderItem[]): {
  hasCooking: boolean;
  allReadyMade: boolean;
  readyItems: OrderItem[];
  cookingItems: OrderItem[];
  totalItemsCount: number;
} {
  const list = items || [];
  if (list.length === 0) {
    return {
      hasCooking: false,
      allReadyMade: false,
      readyItems: [],
      cookingItems: [],
      totalItemsCount: 0,
    };
  }

  const readyItems: OrderItem[] = [];
  const cookingItems: OrderItem[] = [];

  for (const it of list) {
    if (isReadyMadeDish(it.dish_name)) {
      readyItems.push(it);
    } else {
      cookingItems.push(it);
    }
  }

  const allReadyMade = list.length > 0 && cookingItems.length === 0;
  const hasCooking = cookingItems.length > 0;

  return {
    hasCooking,
    allReadyMade,
    readyItems,
    cookingItems,
    totalItemsCount: list.reduce((sum, it) => sum + (it.quantity || 1), 0),
  };
}
