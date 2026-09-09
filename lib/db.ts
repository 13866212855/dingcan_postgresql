import { Pool } from 'pg';
import { Dish, OrderItem, Order, DiningTable, AppUser, AppSettings, Tenant } from '@/types';

export type { Dish, OrderItem, Order, DiningTable, AppUser, AppSettings, Tenant };

const FALLBACK_DATABASE_URL =
  'postgresql://neondb_owner:npg_dX4ozti1BycI@ep-crimson-tooth-b334yz69-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let poolInstance: Pool | null = null;
let isInitDone = false;
let initPromise: Promise<void> | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    const connStr = process.env.DATABASE_URL || FALLBACK_DATABASE_URL;
    poolInstance = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });

    poolInstance.on('error', (err) => {
      console.error('Unexpected idle PostgreSQL client error:', err);
    });
  }
  return poolInstance;
}

export function saveDatabase(): void {
  // No-op for PostgreSQL
}

// ----------------------------------------------------
// Default Multi-Tenant Seed Configurations
// ----------------------------------------------------
export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'default',
    name: '客来香·家常菜馆',
    slogan: '地道现炒 · 现点现做',
    logo: '',
    description: '二十年专注传统经典家常菜，精选原产地食材，每日新鲜现炒。',
    phone: '010-88886666',
    address: '美食街A区108号 (总店)',
    status: 1,
  },
  {
    id: 'chuan',
    name: '蜀香阁·地道川菜',
    slogan: '麻辣鲜香 · 传承古法巴蜀味',
    logo: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80',
    description: '正宗四川非遗老师傅掌勺，汉源花椒配二荆条，醇麻爽辣，酣畅淋漓。',
    phone: '028-66668888',
    address: '锦里老街中段22号 (川味一分店)',
    status: 1,
  },
  {
    id: 'yue',
    name: '粤品轩·精致早茶',
    slogan: '皮脆肉嫩 · 原汁原味粤派名膳',
    logo: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=300&q=80',
    description: '岭南传统手工早茶与顺德名菜，一盅两件，清而不淡，鲜而不俗。',
    phone: '020-83339999',
    address: '珠江新城美食广场F栋 (早茶二分店)',
    status: 1,
  },
];

const DEFAULT_DISHES_MAP: Record<string, Omit<Dish, 'id'>[]> = {
  default: [
    {
      name: '招牌红烧肉',
      price: 48,
      category: '热炒硬菜',
      description: '肥而不腻，入口即化，慢火煨炖2小时的本帮地道风味。',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '扬州炒饭',
      price: 22,
      category: '主食米面',
      description: '粒粒分明，金黄松软，配有火腿碎、青豆、虾仁与新鲜鸡蛋。',
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '麻婆豆腐',
      price: 26,
      category: '热炒硬菜',
      description: '正宗川味，麻辣醇香，红亮鲜香，选用老豆腐慢入味。',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '清炒时令鲜蔬',
      price: 18,
      category: '清爽时蔬',
      description: '每日清晨菜场直送，大火快炒保留脆嫩清香。',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '酸辣土豆丝',
      price: 16,
      category: '清爽时蔬',
      description: '刀工均匀细致，酸辣爽脆开胃，家常必点经典小炒。',
      image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '宫保鸡丁',
      price: 36,
      category: '热炒硬菜',
      description: '鲜嫩鸡腿肉丁搭配香脆花生米与大葱白，甜酸微辣。',
      image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '手工猪肉水饺(15只)',
      price: 24,
      category: '主食米面',
      description: '皮薄大馅，纯手工现包现煮，鲜香多汁配蒜醋汁。',
      image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '西红柿鸡蛋汤',
      price: 18,
      category: '汤品饮品',
      description: '浓郁番茄出汁，蛋花如丝细腻，温润暖胃，清淡爽口。',
      image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '秘制酸梅汤(冰镇壶装)',
      price: 15,
      category: '汤品饮品',
      description: '乌梅、山楂、陈皮古法慢熬，冰糖调和，解腻生津。',
      image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
  ],
  chuan: [
    {
      name: '招牌水煮牛肉',
      price: 58,
      category: '巴蜀热炒',
      description: '选用优质牛里脊，红油滚烫，麻辣鲜香，肉质滑嫩多汁。',
      image: 'https://images.unsplash.com/photo-1569058242252-623df46b5025?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '重庆歌乐山辣子鸡',
      price: 46,
      category: '巴蜀热炒',
      description: '在红辣椒堆里寻找黄金鸡肉丁，外酥里嫩，麻香四溢。',
      image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '农家传统回锅肉',
      price: 38,
      category: '巴蜀热炒',
      description: '选用肥三瘦七二刀肉，配鲜红蒜苗与郫县豆瓣酱，油润香糯。',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '成都夫妻肺片',
      price: 32,
      category: '风味凉菜',
      description: '精选牛肉、牛肚薄切，淋特调红油与熟芝麻、花生碎，回味悠长。',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '老坛酸菜鱼',
      price: 52,
      category: '巴蜀热炒',
      description: '活鱼现杀起片，老坛古法泡酸菜，酸爽开胃，鱼汤金黄鲜美。',
      image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '正宗四川担担面',
      price: 18,
      category: '特色小吃',
      description: '细面劲道，配芽菜肉末与红油花生碎，咸鲜微辣。',
      image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '手工红糖糍粑',
      price: 22,
      category: '特色小吃',
      description: '糯米捶打现炸，外酥里糯，淋浓郁老红糖浆配黄豆粉。',
      image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '古法手搓红糖冰粉',
      price: 12,
      category: '甜品饮品',
      description: '纯天然假酸浆籽手搓气泡，配山楂碎、葡萄干、花生碎解辣神器。',
      image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
  ],
  yue: [
    {
      name: '招牌水晶虾饺皇(4只)',
      price: 36,
      category: '精致点心',
      description: '皮薄如纸晶莹剔透，内包三只鲜弹整虾，鲜美多汁。',
      image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '豉汁蒸凤爪',
      price: 28,
      category: '精致点心',
      description: '炸后慢蒸脱骨，软糯入味，富含胶原蛋白，酱香浓郁。',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '金牌蜜汁叉烧包',
      price: 26,
      category: '精致点心',
      description: '酵母面皮松软开花，内馅选用秘制肥瘦叉烧肉，香甜不腻。',
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '明炉脆皮烧鹅(例份)',
      price: 68,
      category: '经典粤菜',
      description: '传统炭火暗炉烤制，皮脆肉嫩骨香，配酸梅酱化腻提鲜。',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '顺德干炒牛河',
      price: 32,
      category: '粉面主食',
      description: '猛火锅气十足，牛肉嫩滑多汁，河粉焦香爽滑不油腻。',
      image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '白灼广东迟菜心',
      price: 22,
      category: '清爽时蔬',
      description: '原产地直运菜心，滚水白灼淋鲜香豉油，甘甜清脆。',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '生滚皮蛋瘦肉粥',
      price: 18,
      category: '养生粥品',
      description: '香米熬制如丝绵滑，新鲜猪里脊与无铅皮蛋现滚慢烹。',
      image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
    {
      name: '经典杨枝甘露',
      price: 20,
      category: '甜品糖水',
      description: '新鲜台芒打茸，配西柚果粒、晶莹西米与香浓椰浆，甘甜沁心。',
      image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
      status: 1,
    },
  ],
};

const DEFAULT_TABLES_MAP: Record<string, { name: string; sort_order: number }[]> = {
  default: [
    { name: '1号桌', sort_order: 1 },
    { name: '2号桌', sort_order: 2 },
    { name: '3号桌', sort_order: 3 },
    { name: '5号桌', sort_order: 4 },
    { name: '6号桌', sort_order: 5 },
    { name: '8号桌', sort_order: 6 },
    { name: '包厢1(雅竹轩)', sort_order: 7 },
    { name: '包厢2(聚贤阁)', sort_order: 8 },
  ],
  chuan: [
    { name: '川味01桌', sort_order: 1 },
    { name: '川味02桌', sort_order: 2 },
    { name: '川味03桌', sort_order: 3 },
    { name: '川味05桌', sort_order: 4 },
    { name: '川味06桌', sort_order: 5 },
    { name: '蜀香包厢(天府厅)', sort_order: 6 },
    { name: '蜀香包厢(锦官厅)', sort_order: 7 },
  ],
  yue: [
    { name: '早茶01台', sort_order: 1 },
    { name: '早茶02台', sort_order: 2 },
    { name: '早茶03台', sort_order: 3 },
    { name: '早茶05台', sort_order: 4 },
    { name: '早茶06台', sort_order: 5 },
    { name: '粤宴包厢(满江红)', sort_order: 6 },
    { name: '粤宴包厢(荔枝湾)', sort_order: 7 },
  ],
};

export async function ensureDatabase(): Promise<Pool> {
  const pool = getPool();
  if (isInitDone) return pool;
  if (initPromise) {
    await initPromise;
    return pool;
  }

  initPromise = (async () => {
    try {
      // 1. Base table creation
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          logo TEXT DEFAULT '',
          slogan TEXT DEFAULT '',
          description TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          address TEXT DEFAULT '',
          status INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dishes (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          category TEXT NOT NULL,
          description TEXT DEFAULT '',
          image TEXT DEFAULT '',
          status INTEGER NOT NULL DEFAULT 1,
          taste_options TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          table_no TEXT NOT NULL,
          order_type TEXT NOT NULL DEFAULT '堂食',
          delivery_address TEXT,
          delivery_contact TEXT,
          delivery_phone TEXT,
          payment_timing TEXT NOT NULL DEFAULT '餐前付款',
          payment_status TEXT NOT NULL DEFAULT '未支付',
          total_amount DOUBLE PRECISION NOT NULL,
          points_used DOUBLE PRECISION NOT NULL DEFAULT 0,
          points_discount DOUBLE PRECISION NOT NULL DEFAULT 0,
          points_earned DOUBLE PRECISION NOT NULL DEFAULT 0,
          final_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT '待处理',
          notes TEXT DEFAULT '',
          user_id TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          dish_id INTEGER NOT NULL,
          dish_name TEXT NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          quantity INTEGER NOT NULL,
          subtotal DOUBLE PRECISION NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tables (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          is_occupied INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          tenant_id TEXT NOT NULL DEFAULT 'default',
          key TEXT NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT NOT NULL,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          phone TEXT,
          name TEXT,
          is_verified INTEGER NOT NULL DEFAULT 0,
          points DOUBLE PRECISION NOT NULL DEFAULT 0,
          balance DOUBLE PRECISION NOT NULL DEFAULT 0,
          total_spent DOUBLE PRECISION NOT NULL DEFAULT 0,
          delivery_address TEXT,
          delivery_contact TEXT,
          delivery_phone TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (tenant_id, id)
        );
      `);

      // 2. Safe schema upgrade migrations: add tenant_id column if missing in older tables
      await pool.query(`
        ALTER TABLE dishes ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
        ALTER TABLE dishes ADD COLUMN IF NOT EXISTS taste_options TEXT NOT NULL DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taste TEXT DEFAULT '';
        ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

        -- Drop old single-column primary key on settings if it exists
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'settings'::regclass AND conname = 'settings_pkey'
          ) THEN
            ALTER TABLE settings DROP CONSTRAINT settings_pkey CASCADE;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        -- Remove any duplicates on (tenant_id, key) before adding composite constraint
        DELETE FROM settings a USING settings b
        WHERE a.ctid < b.ctid AND a.tenant_id = b.tenant_id AND a.key = b.key;

        -- Create composite primary key on (tenant_id, key) if not exists
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'settings'::regclass AND contype = 'p'
          ) THEN
            ALTER TABLE settings ADD CONSTRAINT settings_tenant_key_pkey PRIMARY KEY (tenant_id, key);
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        -- Drop old single-column primary key on users if it exists on id only
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'users'::regclass AND c.conname = 'users_pkey'
            GROUP BY c.oid, c.conname
            HAVING count(*) = 1 AND bool_or(a.attname = 'id')
          ) THEN
            ALTER TABLE users DROP CONSTRAINT users_pkey CASCADE;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        -- Remove any duplicates on (tenant_id, id) before adding composite constraint
        DELETE FROM users a USING users b
        WHERE a.ctid < b.ctid AND a.tenant_id = b.tenant_id AND a.id = b.id;

        -- Create composite primary key on (tenant_id, id) if not exists
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'users'::regclass AND contype = 'p'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_tenant_id_pkey PRIMARY KEY (tenant_id, id);
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        -- Drop legacy global unique constraint on tables(name) to allow same table names across different tenants
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'tables'::regclass AND conname = 'tables_name_key'
          ) THEN
            ALTER TABLE tables DROP CONSTRAINT tables_name_key CASCADE;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        -- Drop legacy global unique constraint on users(phone) to support multi-tenant user bases
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'users'::regclass AND conname = 'users_phone_key'
          ) THEN
            ALTER TABLE users DROP CONSTRAINT users_phone_key CASCADE;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_dishes_tenant ON dishes(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tables_tenant_name ON tables(tenant_id, name);
        CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_users_tenant_phone ON users(tenant_id, phone);
        CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id, key);
      `);

      // 3. Seed tenants
      for (const t of DEFAULT_TENANTS) {
        await pool.query(
          `INSERT INTO tenants (id, name, logo, slogan, description, phone, address, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, t.name, t.logo, t.slogan, t.description, t.phone, t.address, t.status]
        );
      }

      // 4. Seed sample dishes per tenant if empty
      for (const [tenantId, dishes] of Object.entries(DEFAULT_DISHES_MAP)) {
        const dishCountRes = await pool.query(
          'SELECT count(*)::int as count FROM dishes WHERE tenant_id = $1',
          [tenantId]
        );
        if (dishCountRes.rows[0]?.count === 0) {
          for (const dish of dishes) {
            await pool.query(
              `INSERT INTO dishes (tenant_id, name, price, category, description, image, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [tenantId, dish.name, dish.price, dish.category, dish.description, dish.image, dish.status]
            );
          }
        }
      }

      // 5. Seed dining tables per tenant if empty
      for (const [tenantId, tables] of Object.entries(DEFAULT_TABLES_MAP)) {
        const tableCountRes = await pool.query(
          'SELECT count(*)::int as count FROM tables WHERE tenant_id = $1',
          [tenantId]
        );
        if (tableCountRes.rows[0]?.count === 0) {
          for (const tbl of tables) {
            try {
              await pool.query(
                `INSERT INTO tables (tenant_id, name, sort_order, is_occupied)
                 VALUES ($1, $2, $3, 0)`,
                [tenantId, tbl.name, tbl.sort_order]
              );
            } catch (err: any) {
              console.warn(`[ensureDatabase] Seed table ${tbl.name} notice:`, err?.message);
            }
          }
        }
      }

      // 6. Seed settings per tenant if empty
      for (const tenant of DEFAULT_TENANTS) {
        const defaultSettings = [
          { key: 'points_ratio', value: '1' },
          { key: 'payment_qr_code', value: '' },
          { key: 'restaurant_name', value: tenant.name },
          { key: 'restaurant_logo', value: tenant.logo || '' },
          { key: 'restaurant_slogan', value: tenant.slogan || '' },
        ];

        for (const s of defaultSettings) {
          await pool.query(
            `INSERT INTO settings (tenant_id, key, value)
             SELECT $1, $2, $3
             WHERE NOT EXISTS (
               SELECT 1 FROM settings WHERE tenant_id = $1 AND key = $2
             )`,
            [tenant.id, s.key, s.value]
          );
        }
      }

      isInitDone = true;
    } catch (err) {
      console.error('Database initialization fatal error in PostgreSQL:', err);
      initPromise = null;
      throw err;
    }
  })();

  await initPromise;
  return pool;
}

function formatRow<T>(row: any): T {
  if (!row) return row;
  const res: any = { ...row };
  if (res.created_at instanceof Date) res.created_at = res.created_at.toISOString();
  if (res.updated_at instanceof Date) res.updated_at = res.updated_at.toISOString();
  if (typeof res.price === 'string') res.price = parseFloat(res.price);
  if (typeof res.total_amount === 'string') res.total_amount = parseFloat(res.total_amount);
  if (typeof res.final_amount === 'string') res.final_amount = parseFloat(res.final_amount);
  if (typeof res.points_used === 'string') res.points_used = parseFloat(res.points_used);
  if (typeof res.points_discount === 'string') res.points_discount = parseFloat(res.points_discount);
  if (typeof res.points_earned === 'string') res.points_earned = parseFloat(res.points_earned);
  if (typeof res.points === 'string') res.points = parseFloat(res.points);
  if (typeof res.balance === 'string') res.balance = parseFloat(res.balance);
  if (typeof res.total_spent === 'string') res.total_spent = parseFloat(res.total_spent);
  if (typeof res.subtotal === 'string') res.subtotal = parseFloat(res.subtotal);
  return res as T;
}

// ----------------------------------------------------
// Tenants Operations (Multi-Tenant Management)
// ----------------------------------------------------
export async function getAllTenants(): Promise<Tenant[]> {
  const pool = await ensureDatabase();
  const res = await pool.query('SELECT * FROM tenants ORDER BY created_at ASC');
  return res.rows.map((row) => formatRow<Tenant>(row));
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const pool = await ensureDatabase();
  const res = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  return formatRow<Tenant>(res.rows[0]);
}

export async function createTenant(data: Partial<Tenant>): Promise<Tenant> {
  const pool = await ensureDatabase();
  const id = data.id ? data.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : `store_${Date.now()}`;
  const name = data.name?.trim() || '新连锁分店';
  const slogan = data.slogan?.trim() || '新鲜现炒 · 热情服务';
  const logo = data.logo?.trim() || '';
  const description = data.description?.trim() || '';
  const phone = data.phone?.trim() || '';
  const address = data.address?.trim() || '';
  const status = data.status !== undefined ? data.status : 1;

  const res = await pool.query(
    `INSERT INTO tenants (id, name, logo, slogan, description, phone, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       logo = EXCLUDED.logo,
       slogan = EXCLUDED.slogan,
       description = EXCLUDED.description,
       phone = EXCLUDED.phone,
       address = EXCLUDED.address,
       status = EXCLUDED.status,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [id, name, logo, slogan, description, phone, address, status]
  );

  // Initialize basic settings for new tenant
  await updateSetting('restaurant_name', name, id);
  await updateSetting('restaurant_slogan', slogan, id);
  await updateSetting('restaurant_logo', logo, id);
  await updateSetting('points_ratio', '1', id);

  // Initialize standard sample tables for the new tenant
  const tableCheck = await pool.query(
    'SELECT count(*)::int as count FROM tables WHERE tenant_id = $1',
    [id]
  );
  if (tableCheck.rows[0]?.count === 0) {
    const defaultTables = [
      { name: '1号桌', sort_order: 1 },
      { name: '2号桌', sort_order: 2 },
      { name: '3号桌', sort_order: 3 },
      { name: '5号桌', sort_order: 4 },
      { name: '6号桌', sort_order: 5 },
      { name: '包厢A', sort_order: 6 },
    ];
    for (const tbl of defaultTables) {
      try {
        await pool.query(
          `INSERT INTO tables (tenant_id, name, sort_order, is_occupied) VALUES ($1, $2, $3, 0)`,
          [id, tbl.name, tbl.sort_order]
        );
      } catch (tableErr: any) {
        console.warn(`[createTenant] Notice inserting table ${tbl.name}:`, tableErr?.message);
      }
    }
  }

  return formatRow<Tenant>(res.rows[0]);
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<boolean> {
  const pool = await ensureDatabase();
  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(data.name.trim());
    await updateSetting('restaurant_name', data.name.trim(), id);
  }
  if (data.logo !== undefined) {
    updates.push(`logo = $${paramIdx++}`);
    values.push(data.logo.trim());
    await updateSetting('restaurant_logo', data.logo.trim(), id);
  }
  if (data.slogan !== undefined) {
    updates.push(`slogan = $${paramIdx++}`);
    values.push(data.slogan.trim());
    await updateSetting('restaurant_slogan', data.slogan.trim(), id);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIdx++}`);
    values.push(data.description.trim());
  }
  if (data.phone !== undefined) {
    updates.push(`phone = $${paramIdx++}`);
    values.push(data.phone.trim());
  }
  if (data.address !== undefined) {
    updates.push(`address = $${paramIdx++}`);
    values.push(data.address.trim());
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIdx++}`);
    values.push(data.status);
  }

  values.push(id);
  await pool.query(
    `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
  return true;
}

export async function deleteTenant(id: string): Promise<boolean> {
  if (id === 'default') return false; // Default tenant cannot be deleted
  const pool = await ensureDatabase();
  await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
  await pool.query('DELETE FROM dishes WHERE tenant_id = $1', [id]);
  await pool.query('DELETE FROM tables WHERE tenant_id = $1', [id]);
  await pool.query('DELETE FROM settings WHERE tenant_id = $1', [id]);
  await pool.query('DELETE FROM orders WHERE tenant_id = $1', [id]);
  await pool.query('DELETE FROM users WHERE tenant_id = $1', [id]);
  return true;
}

// ----------------------------------------------------
// Dishes Operations (Isolated by Tenant)
// ----------------------------------------------------
export async function getAllDishes(onlyActive = false, tenantId = 'default'): Promise<Dish[]> {
  const pool = await ensureDatabase();
  const sql = onlyActive
    ? 'SELECT * FROM dishes WHERE tenant_id = $1 AND status = 1 ORDER BY id ASC'
    : 'SELECT * FROM dishes WHERE tenant_id = $1 ORDER BY id ASC';
  const res = await pool.query(sql, [tenantId]);
  return res.rows.map((row) => formatRow<Dish>(row));
}

export async function getDishById(id: number, tenantId = 'default'): Promise<Dish | null> {
  const pool = await ensureDatabase();
  const res = await pool.query('SELECT * FROM dishes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (res.rows.length === 0) return null;
  return formatRow<Dish>(res.rows[0]);
}

export async function createDish(data: Omit<Dish, 'id' | 'created_at'>, tenantId = 'default'): Promise<number> {
  const pool = await ensureDatabase();
  const res = await pool.query(
    `INSERT INTO dishes (tenant_id, name, price, category, description, image, status, taste_options)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      tenantId,
      data.name,
      data.price,
      data.category,
      data.description || '',
      data.image || '',
      data.status ?? 1,
      data.taste_options || '',
    ]
  );
  return res.rows[0].id as number;
}

export async function updateDish(id: number, data: Partial<Dish>, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(data.name);
  }
  if (data.price !== undefined) {
    updates.push(`price = $${paramIdx++}`);
    values.push(data.price);
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIdx++}`);
    values.push(data.category);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIdx++}`);
    values.push(data.description);
  }
  if (data.image !== undefined) {
    updates.push(`image = $${paramIdx++}`);
    values.push(data.image);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIdx++}`);
    values.push(data.status);
  }
  if (data.taste_options !== undefined) {
    updates.push(`taste_options = $${paramIdx++}`);
    values.push(data.taste_options);
  }

  if (updates.length === 0) return false;

  values.push(id, tenantId);
  await pool.query(
    `UPDATE dishes SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}`,
    values
  );
  return true;
}

export async function deleteDish(id: number, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  await pool.query('DELETE FROM dishes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return true;
}

// ----------------------------------------------------
// Dining Tables Operations (Isolated by Tenant)
// ----------------------------------------------------
export async function getAllTables(onlyFree = false, tenantId = 'default'): Promise<DiningTable[]> {
  const pool = await ensureDatabase();
  const sql = onlyFree
    ? 'SELECT * FROM tables WHERE tenant_id = $1 AND is_occupied = 0 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM tables WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC';
  const res = await pool.query(sql, [tenantId]);
  return res.rows.map((row) => formatRow<DiningTable>(row));
}

export async function createTable(name: string, sortOrder = 0, tenantId = 'default'): Promise<number> {
  const pool = await ensureDatabase();
  const res = await pool.query(
    `INSERT INTO tables (tenant_id, name, sort_order, is_occupied)
     VALUES ($1, $2, $3, 0)
     RETURNING id`,
    [tenantId, name.trim(), sortOrder]
  );
  return res.rows[0].id as number;
}

export async function updateTable(id: number, data: Partial<DiningTable>, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(data.name.trim());
  }
  if (data.is_occupied !== undefined) {
    updates.push(`is_occupied = $${paramIdx++}`);
    values.push(data.is_occupied);
  }
  if (data.sort_order !== undefined) {
    updates.push(`sort_order = $${paramIdx++}`);
    values.push(data.sort_order);
  }

  if (updates.length === 0) return false;

  values.push(id, tenantId);
  await pool.query(
    `UPDATE tables SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}`,
    values
  );
  return true;
}

export async function deleteTable(id: number, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  await pool.query('DELETE FROM tables WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return true;
}

export async function toggleTableOccupied(id: number, isOccupied: number, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  await pool.query('UPDATE tables SET is_occupied = $1 WHERE id = $2 AND tenant_id = $3', [isOccupied, id, tenantId]);
  return true;
}

export async function setTableOccupiedByName(tableName: string, isOccupied: number, tenantId = 'default'): Promise<void> {
  if (!tableName) return;
  const pool = await ensureDatabase();
  await pool.query('UPDATE tables SET is_occupied = $1 WHERE name = $2 AND tenant_id = $3', [isOccupied, tableName, tenantId]);
}

// ----------------------------------------------------
// System Settings Operations (Isolated by Tenant)
// ----------------------------------------------------
export async function getSettings(tenantId = 'default'): Promise<AppSettings> {
  const pool = await ensureDatabase();
  const res = await pool.query('SELECT key, value FROM settings WHERE tenant_id = $1', [tenantId]);

  // Default values based on tenant info
  const tenantInfo = await getTenantById(tenantId);
  let payment_qr_code = '';
  let points_ratio = 1;
  let custom_domain = '';
  let restaurant_name = tenantInfo?.name || '客来香·家常菜馆';
  let restaurant_logo = tenantInfo?.logo || '';
  let restaurant_slogan = tenantInfo?.slogan || '地道现炒 · 现点现做';
  let enable_dine_in = 1; // 默认开启堂食
  let enable_takeout = 1; // 默认开启外卖
  let require_table_no = 1; // 默认堂食必须选桌号
  let table_input_mode: 'select' | 'input' | 'both' = 'select'; // 默认下拉选桌
  let enable_pay_before = 1; // 默认开启餐前付款(立付)
  let enable_pay_after = 1; // 默认开启餐后结账(先吃后付)

  for (const row of res.rows) {
    if (row.key === 'payment_qr_code') payment_qr_code = row.value || '';
    if (row.key === 'points_ratio') points_ratio = parseFloat(row.value) || 1;
    if (row.key === 'custom_domain') custom_domain = row.value || '';
    if (row.key === 'restaurant_name' && row.value?.trim()) restaurant_name = row.value.trim();
    if (row.key === 'restaurant_logo') restaurant_logo = row.value || '';
    if (row.key === 'restaurant_slogan' && row.value?.trim()) restaurant_slogan = row.value.trim();
    if (row.key === 'enable_dine_in') enable_dine_in = row.value === '0' ? 0 : 1;
    if (row.key === 'enable_takeout') enable_takeout = row.value === '0' ? 0 : 1;
    if (row.key === 'require_table_no') require_table_no = row.value === '0' ? 0 : 1;
    if (row.key === 'table_input_mode' && (row.value === 'select' || row.value === 'input' || row.value === 'both')) {
      table_input_mode = row.value;
    }
    if (row.key === 'enable_pay_before') enable_pay_before = row.value === '0' ? 0 : 1;
    if (row.key === 'enable_pay_after') enable_pay_after = row.value === '0' ? 0 : 1;
  }

  return {
    tenant_id: tenantId,
    payment_qr_code,
    points_ratio,
    custom_domain,
    restaurant_name,
    restaurant_logo,
    restaurant_slogan,
    enable_dine_in,
    enable_takeout,
    require_table_no,
    table_input_mode,
    enable_pay_before,
    enable_pay_after,
  };
}

export async function updateSetting(key: string, value: string, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  // Safe delete + insert for composite tenant setting key
  await pool.query('DELETE FROM settings WHERE tenant_id = $1 AND key = $2', [tenantId, key]);
  await pool.query('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3)', [tenantId, key, value]);

  // If updating core branding, also update tenant record
  if (key === 'restaurant_name') {
    await pool.query('UPDATE tenants SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [value, tenantId]);
  } else if (key === 'restaurant_logo') {
    await pool.query('UPDATE tenants SET logo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [value, tenantId]);
  } else if (key === 'restaurant_slogan') {
    await pool.query('UPDATE tenants SET slogan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [value, tenantId]);
  }

  return true;
}

// ----------------------------------------------------
// Users / Members Operations (Isolated by Tenant)
// ----------------------------------------------------
export async function getUser(id: string, tenantId = 'default'): Promise<AppUser | null> {
  if (!id) return null;
  const pool = await ensureDatabase();
  const res = await pool.query('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (res.rows.length === 0) return null;
  return formatRow<AppUser>(res.rows[0]);
}

export async function getOrCreateUser(id: string, tenantId = 'default'): Promise<AppUser> {
  const existing = await getUser(id, tenantId);
  if (existing) return existing;

  const pool = await ensureDatabase();
  const nowIso = new Date().toISOString();
  await pool.query(
    `INSERT INTO users (id, tenant_id, points, balance, total_spent, is_verified, created_at, updated_at)
     VALUES ($1, $2, 0, 0, 0, 0, $3, $4)
     ON CONFLICT (tenant_id, id) DO NOTHING`,
    [id, tenantId, nowIso, nowIso]
  );

  const created = await getUser(id, tenantId);
  if (created) return created;

  return {
    id,
    tenant_id: tenantId,
    is_verified: 0,
    points: 0,
    balance: 0,
    total_spent: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function updateUser(id: string, data: Partial<AppUser>, tenantId = 'default'): Promise<boolean> {
  const pool = await ensureDatabase();
  const updates: string[] = ['updated_at = $1'];
  const values: any[] = [new Date().toISOString()];
  let paramIdx = 2;

  if (data.phone !== undefined) {
    updates.push(`phone = $${paramIdx++}`);
    values.push(data.phone.trim());
  }
  if (data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(data.name.trim());
  }
  if (data.is_verified !== undefined) {
    updates.push(`is_verified = $${paramIdx++}`);
    values.push(data.is_verified);
  }
  if (data.points !== undefined) {
    updates.push(`points = $${paramIdx++}`);
    values.push(data.points);
  }
  if (data.balance !== undefined) {
    updates.push(`balance = $${paramIdx++}`);
    values.push(data.balance);
  }
  if (data.total_spent !== undefined) {
    updates.push(`total_spent = $${paramIdx++}`);
    values.push(data.total_spent);
  }
  if (data.delivery_address !== undefined) {
    updates.push(`delivery_address = $${paramIdx++}`);
    values.push(data.delivery_address.trim());
  }
  if (data.delivery_contact !== undefined) {
    updates.push(`delivery_contact = $${paramIdx++}`);
    values.push(data.delivery_contact.trim());
  }
  if (data.delivery_phone !== undefined) {
    updates.push(`delivery_phone = $${paramIdx++}`);
    values.push(data.delivery_phone.trim());
  }

  values.push(id, tenantId);
  await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}`,
    values
  );
  return true;
}

export async function verifyUser(id: string, phone: string, name: string, tenantId = 'default'): Promise<AppUser> {
  const pool = await ensureDatabase();
  await getOrCreateUser(id, tenantId);

  // If this phone is already associated with another record in this tenant, merge points
  const resPhone = await pool.query(
    'SELECT id, points, balance, total_spent FROM users WHERE phone = $1 AND id != $2 AND tenant_id = $3',
    [phone.trim(), id, tenantId]
  );
  let bonusPoints = 0;
  let bonusBalance = 0;
  let bonusSpent = 0;

  if (resPhone.rows.length > 0) {
    const oldUser = resPhone.rows[0];
    bonusPoints = parseFloat(oldUser.points) || 0;
    bonusBalance = parseFloat(oldUser.balance) || 0;
    bonusSpent = parseFloat(oldUser.total_spent) || 0;
    await pool.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [oldUser.id, tenantId]);
  }

  const currentUser = await getUser(id, tenantId);
  const newPoints = (currentUser?.points || 0) + bonusPoints;
  const newBalance = (currentUser?.balance || 0) + bonusBalance;
  const newSpent = (currentUser?.total_spent || 0) + bonusSpent;

  await pool.query(
    `UPDATE users
     SET phone = $1, name = $2, is_verified = 1, points = $3, balance = $4, total_spent = $5, updated_at = $6
     WHERE id = $7 AND tenant_id = $8`,
    [phone.trim(), name.trim(), newPoints, newBalance, newSpent, new Date().toISOString(), id, tenantId]
  );

  return (await getUser(id, tenantId))!;
}

export async function rechargeUser(
  id: string,
  pointsDelta: number,
  balanceDelta: number,
  tenantId = 'default'
): Promise<AppUser | null> {
  const user = await getUser(id, tenantId);
  if (!user) return null;

  const newPoints = Math.max(0, Math.round(((user.points || 0) + pointsDelta) * 100) / 100);
  const newBalance = Math.max(0, Math.round(((user.balance || 0) + balanceDelta) * 100) / 100);

  const pool = await ensureDatabase();
  await pool.query(
    `UPDATE users SET points = $1, balance = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`,
    [newPoints, newBalance, new Date().toISOString(), id, tenantId]
  );

  return await getUser(id, tenantId);
}

export async function getAllUsers(tenantId = 'default'): Promise<AppUser[]> {
  const pool = await ensureDatabase();
  const res = await pool.query(
    'SELECT * FROM users WHERE tenant_id = $1 ORDER BY total_spent DESC, updated_at DESC',
    [tenantId]
  );
  return res.rows.map((row) => formatRow<AppUser>(row));
}

// ----------------------------------------------------
// Orders Operations (Isolated by Tenant)
// ----------------------------------------------------
export interface CreateOrderParams {
  tableNo: string;
  orderType?: '堂食' | '外卖';
  deliveryAddress?: string;
  deliveryContact?: string;
  deliveryPhone?: string;
  paymentTiming?: '餐前付款' | '餐后结账';
  paymentStatus?: '未支付' | '已支付';
  pointsUsed?: number;
  notes?: string;
  userId?: string;
  items: { dishId: number; quantity: number; taste?: string }[];
}

export async function createOrder(params: CreateOrderParams, tenantId = 'default'): Promise<Order> {
  const pool = await ensureDatabase();
  const {
    tableNo,
    orderType = '堂食',
    deliveryAddress = '',
    deliveryContact = '',
    deliveryPhone = '',
    paymentTiming = '餐前付款',
    paymentStatus = '未支付',
    pointsUsed = 0,
    notes = '',
    userId,
    items,
  } = params;

  // Calculate items and total using dishes from THIS tenant
  const allDishes = await getAllDishes(false, tenantId);
  const dishMap = new Map(allDishes.map((d) => [d.id, d]));

  let total = 0;
  const orderItemsData: {
    dish_id: number;
    dish_name: string;
    price: number;
    quantity: number;
    subtotal: number;
    taste?: string;
  }[] = [];

  for (const item of items) {
    const dish = dishMap.get(item.dishId);
    if (!dish) continue;
    const subtotal = dish.price * item.quantity;
    total += subtotal;
    orderItemsData.push({
      dish_id: dish.id,
      dish_name: dish.name,
      price: dish.price,
      quantity: item.quantity,
      subtotal,
      taste: item.taste || '',
    });
  }

  // Handle Points deduction within tenant
  let actualPointsUsed = 0;
  let pointsDiscount = 0;

  if (userId && pointsUsed > 0) {
    const user = await getUser(userId, tenantId);
    if (user && user.is_verified === 1 && user.points > 0) {
      actualPointsUsed = Math.min(pointsUsed, user.points, total);
      pointsDiscount = actualPointsUsed;

      const remainingPoints = Math.round((user.points - actualPointsUsed) * 100) / 100;
      await updateUser(userId, { points: remainingPoints }, tenantId);
    }
  }

  const finalAmount = Math.max(0, Math.round((total - pointsDiscount) * 100) / 100);

  // Calculate earned points from tenant settings
  const settings = await getSettings(tenantId);
  const pointsRatio = (settings.points_ratio || 1) / 100;
  const pointsEarned = Math.round(finalAmount * pointsRatio * 100) / 100;

  if (userId && paymentStatus === '已支付') {
    const user = await getUser(userId, tenantId);
    if (user) {
      const newPoints = Math.round(((user.points || 0) + pointsEarned) * 100) / 100;
      const newSpent = Math.round(((user.total_spent || 0) + finalAmount) * 100) / 100;
      await updateUser(userId, { points: newPoints, total_spent: newSpent }, tenantId);
    }
  }

  if (userId && orderType === '外卖' && deliveryAddress) {
    await updateUser(userId, {
      delivery_address: deliveryAddress,
      delivery_contact: deliveryContact,
      delivery_phone: deliveryPhone,
    }, tenantId);
  }

  if (orderType === '堂食' && tableNo) {
    await setTableOccupiedByName(tableNo, 1, tenantId);
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const tenantPrefix = tenantId === 'default' ? 'ORD' : `ORD-${tenantId.toUpperCase()}`;
  const orderId = `${tenantPrefix}-${dateStr}-${randomSuffix}`;
  const nowIso = now.toISOString();

  await pool.query(
    `INSERT INTO orders (
      id, tenant_id, table_no, order_type, delivery_address, delivery_contact, delivery_phone,
      payment_timing, payment_status, total_amount, points_used, points_discount,
      points_earned, final_amount, status, notes, user_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '待处理', $15, $16, $17, $18
    )`,
    [
      orderId,
      tenantId,
      orderType === '堂食' ? tableNo : '外卖送餐',
      orderType,
      deliveryAddress,
      deliveryContact,
      deliveryPhone,
      paymentTiming,
      paymentStatus,
      total,
      actualPointsUsed,
      pointsDiscount,
      pointsEarned,
      finalAmount,
      notes || '',
      userId || null,
      nowIso,
      nowIso,
    ]
  );

  for (const it of orderItemsData) {
    await pool.query(
      `INSERT INTO order_items (tenant_id, order_id, dish_id, dish_name, price, quantity, subtotal, taste)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, orderId, it.dish_id, it.dish_name, it.price, it.quantity, it.subtotal, it.taste || '']
    );
  }

  return {
    id: orderId,
    tenant_id: tenantId,
    table_no: orderType === '堂食' ? tableNo : '外卖送餐',
    order_type: orderType,
    delivery_address: deliveryAddress,
    delivery_contact: deliveryContact,
    delivery_phone: deliveryPhone,
    payment_timing: paymentTiming,
    payment_status: paymentStatus,
    total_amount: total,
    points_used: actualPointsUsed,
    points_discount: pointsDiscount,
    points_earned: pointsEarned,
    final_amount: finalAmount,
    status: '待处理',
    notes,
    user_id: userId,
    created_at: nowIso,
    updated_at: nowIso,
    items: orderItemsData,
  };
}

export async function getAllOrders(
  filterStatus?: string,
  search?: string,
  tenantId = 'default'
): Promise<Order[]> {
  const pool = await ensureDatabase();
  let sql = 'SELECT * FROM orders WHERE tenant_id = $1';
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (filterStatus && filterStatus !== '全部') {
    sql += ` AND status = $${paramIdx++}`;
    params.push(filterStatus);
  }

  if (search && search.trim()) {
    const query = `%${search.trim()}%`;
    sql += ` AND (id ILIKE $${paramIdx} OR table_no ILIKE $${paramIdx} OR notes ILIKE $${paramIdx} OR delivery_address ILIKE $${paramIdx} OR delivery_phone ILIKE $${paramIdx})`;
    params.push(query);
    paramIdx++;
  }

  sql += ' ORDER BY created_at DESC';

  const result = await pool.query(sql, params);
  if (result.rows.length === 0) return [];

  const orders: Order[] = result.rows.map((row) => formatRow<Order>(row));

  try {
    const orderIds = orders.map((o) => o.id);
    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ANY($1::text[])',
      [orderIds]
    );
    const itemsByOrderId: Record<string, OrderItem[]> = {};

    for (const row of itemsRes.rows) {
      const item = formatRow<OrderItem>(row);
      const oId = row.order_id;
      if (!itemsByOrderId[oId]) itemsByOrderId[oId] = [];
      itemsByOrderId[oId].push(item);
    }

    for (const order of orders) {
      order.items = itemsByOrderId[order.id] || [];
    }
  } catch (err) {
    console.error('Error fetching order items in batch:', err);
    for (const order of orders) {
      order.items = [];
    }
  }

  return orders;
}

export async function getOrderById(id: string, tenantId?: string): Promise<Order | null> {
  const pool = await ensureDatabase();
  const sql = tenantId
    ? 'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2'
    : 'SELECT * FROM orders WHERE id = $1';
  const params = tenantId ? [id, tenantId] : [id];
  const res = await pool.query(sql, params);
  if (res.rows.length === 0) return null;

  const order = formatRow<Order>(res.rows[0]);
  const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
  order.items = itemsRes.rows.map((row) => formatRow<OrderItem>(row));

  return order;
}

export async function updateOrderStatus(
  id: string,
  status: '待处理' | '制作中' | '已完成' | '已取消',
  tenantId?: string
): Promise<boolean> {
  const pool = await ensureDatabase();
  const order = await getOrderById(id, tenantId);
  if (!order) return false;

  const currentTenant = order.tenant_id || tenantId || 'default';
  const nowIso = new Date().toISOString();
  await pool.query('UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3', [
    status,
    nowIso,
    id,
  ]);

  if (status === '已完成' || status === '已取消') {
    if (order.order_type === '堂食' && order.table_no) {
      const activeRes = await pool.query(
        "SELECT count(*)::int as count FROM orders WHERE tenant_id = $1 AND table_no = $2 AND status IN ('待处理', '制作中') AND id != $3",
        [currentTenant, order.table_no, id]
      );
      const activeCount = activeRes.rows[0]?.count || 0;
      if (activeCount === 0) {
        await setTableOccupiedByName(order.table_no, 0, currentTenant);
      }
    }
  }

  if (status === '已完成' && order.user_id && order.payment_status === '未支付') {
    await pool.query(
      "UPDATE orders SET payment_status = '已支付', updated_at = $1 WHERE id = $2",
      [nowIso, id]
    );
    const user = await getUser(order.user_id, currentTenant);
    if (user) {
      const newPoints = Math.round(((user.points || 0) + (order.points_earned || 0)) * 100) / 100;
      const newSpent =
        Math.round(((user.total_spent || 0) + (order.final_amount || 0)) * 100) / 100;
      await updateUser(order.user_id, { points: newPoints, total_spent: newSpent }, currentTenant);
    }
  }

  return true;
}

export async function updateOrderPayment(
  id: string,
  paymentStatus: '已支付' | '未支付',
  tenantId?: string
): Promise<boolean> {
  const pool = await ensureDatabase();
  const order = await getOrderById(id, tenantId);
  if (!order) return false;

  const currentTenant = order.tenant_id || tenantId || 'default';
  const nowIso = new Date().toISOString();
  await pool.query(
    'UPDATE orders SET payment_status = $1, updated_at = $2 WHERE id = $3',
    [paymentStatus, nowIso, id]
  );

  if (paymentStatus === '已支付' && order.payment_status !== '已支付' && order.user_id) {
    const user = await getUser(order.user_id, currentTenant);
    if (user) {
      const newPoints = Math.round(((user.points || 0) + (order.points_earned || 0)) * 100) / 100;
      const newSpent =
        Math.round(((user.total_spent || 0) + (order.final_amount || 0)) * 100) / 100;
      await updateUser(order.user_id, { points: newPoints, total_spent: newSpent }, currentTenant);
    }
  }

  return true;
}
