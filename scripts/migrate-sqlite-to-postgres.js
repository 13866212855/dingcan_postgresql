const { Pool } = require('pg');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_dX4ozti1BycI@ep-crimson-tooth-b334yz69-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  console.log('Connecting to PostgreSQL...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('PostgreSQL connected.');

  try {
    console.log('Creating PostgreSQL schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS dishes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        category TEXT NOT NULL,
        description TEXT DEFAULT '',
        image TEXT DEFAULT '',
        status INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
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
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        dish_id INTEGER NOT NULL,
        dish_name TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal DOUBLE PRECISION NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        is_occupied INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        name TEXT,
        is_verified INTEGER NOT NULL DEFAULT 0,
        points DOUBLE PRECISION NOT NULL DEFAULT 0,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_spent DOUBLE PRECISION NOT NULL DEFAULT 0,
        delivery_address TEXT,
        delivery_contact TEXT,
        delivery_phone TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Schema created successfully.');

    // Check if SQLite database exists to migrate data from
    const dbPath = path.join(process.cwd(), 'data', 'restaurant.sqlite');
    if (fs.existsSync(dbPath)) {
      console.log('Loading SQLite data from:', dbPath);
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const sqliteDb = new SQL.Database(fileBuffer);

      // 1. Migrate settings
      const settingsRes = sqliteDb.exec('SELECT key, value FROM settings');
      if (settingsRes && settingsRes.length > 0) {
        for (const [key, value] of settingsRes[0].values) {
          await client.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, value]
          );
        }
        console.log(`Migrated ${settingsRes[0].values.length} settings.`);
      }

      // 2. Migrate tables
      const tablesRes = sqliteDb.exec('SELECT id, name, is_occupied, sort_order, created_at FROM tables');
      if (tablesRes && tablesRes.length > 0) {
        for (const [id, name, is_occupied, sort_order, created_at] of tablesRes[0].values) {
          await client.query(
            'INSERT INTO tables (id, name, is_occupied, sort_order, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET is_occupied = EXCLUDED.is_occupied, sort_order = EXCLUDED.sort_order',
            [id, name, is_occupied ?? 0, sort_order ?? 0, created_at || new Date().toISOString()]
          );
        }
        await client.query("SELECT setval(pg_get_serial_sequence('tables', 'id'), COALESCE(MAX(id), 1)) FROM tables");
        console.log(`Migrated ${tablesRes[0].values.length} tables.`);
      }

      // 3. Migrate dishes
      const dishesRes = sqliteDb.exec('SELECT id, name, price, category, description, image, status, created_at FROM dishes');
      if (dishesRes && dishesRes.length > 0) {
        for (const [id, name, price, category, description, image, status, created_at] of dishesRes[0].values) {
          await client.query(
            'INSERT INTO dishes (id, name, price, category, description, image, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, category = EXCLUDED.category, description = EXCLUDED.description, image = EXCLUDED.image, status = EXCLUDED.status',
            [id, name, price, category, description || '', image || '', status ?? 1, created_at || new Date().toISOString()]
          );
        }
        await client.query("SELECT setval(pg_get_serial_sequence('dishes', 'id'), COALESCE(MAX(id), 1)) FROM dishes");
        console.log(`Migrated ${dishesRes[0].values.length} dishes.`);
      }

      // 4. Migrate users
      const usersRes = sqliteDb.exec('SELECT id, phone, name, is_verified, points, balance, total_spent, delivery_address, delivery_contact, delivery_phone, created_at, updated_at FROM users');
      if (usersRes && usersRes.length > 0) {
        for (const [id, phone, name, is_verified, points, balance, total_spent, delivery_address, delivery_contact, delivery_phone, created_at, updated_at] of usersRes[0].values) {
          await client.query(
            `INSERT INTO users (id, phone, name, is_verified, points, balance, total_spent, delivery_address, delivery_contact, delivery_phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, name = EXCLUDED.name, points = EXCLUDED.points, balance = EXCLUDED.balance, total_spent = EXCLUDED.total_spent`,
            [id, phone, name, is_verified ?? 0, points ?? 0, balance ?? 0, total_spent ?? 0, delivery_address, delivery_contact, delivery_phone, created_at || new Date().toISOString(), updated_at || new Date().toISOString()]
          );
        }
        console.log(`Migrated ${usersRes[0].values.length} users.`);
      }

      // 5. Migrate orders
      const ordersRes = sqliteDb.exec('SELECT id, table_no, order_type, delivery_address, delivery_contact, delivery_phone, payment_timing, payment_status, total_amount, points_used, points_discount, points_earned, final_amount, status, notes, user_id, created_at, updated_at FROM orders');
      if (ordersRes && ordersRes.length > 0) {
        for (const [id, table_no, order_type, delivery_address, delivery_contact, delivery_phone, payment_timing, payment_status, total_amount, points_used, points_discount, points_earned, final_amount, status, notes, user_id, created_at, updated_at] of ordersRes[0].values) {
          await client.query(
            `INSERT INTO orders (id, table_no, order_type, delivery_address, delivery_contact, delivery_phone, payment_timing, payment_status, total_amount, points_used, points_discount, points_earned, final_amount, status, notes, user_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             ON CONFLICT (id) DO NOTHING`,
            [id, table_no, order_type || '堂食', delivery_address, delivery_contact, delivery_phone, payment_timing || '餐前付款', payment_status || '未支付', total_amount, points_used || 0, points_discount || 0, points_earned || 0, final_amount || 0, status || '待处理', notes || '', user_id, created_at || new Date().toISOString(), updated_at || new Date().toISOString()]
          );
        }
        console.log(`Migrated ${ordersRes[0].values.length} orders.`);
      }

      // 6. Migrate order_items
      const orderItemsRes = sqliteDb.exec('SELECT id, order_id, dish_id, dish_name, price, quantity, subtotal FROM order_items');
      if (orderItemsRes && orderItemsRes.length > 0) {
        for (const [id, order_id, dish_id, dish_name, price, quantity, subtotal] of orderItemsRes[0].values) {
          await client.query(
            `INSERT INTO order_items (id, order_id, dish_id, dish_name, price, quantity, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [id, order_id, dish_id, dish_name, price, quantity, subtotal]
          );
        }
        await client.query("SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE(MAX(id), 1)) FROM order_items");
        console.log(`Migrated ${orderItemsRes[0].values.length} order items.`);
      }
    }

    console.log('Migration to PostgreSQL completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
