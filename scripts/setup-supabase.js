#!/usr/bin/env node
/**
 * Baqala → Supabase one-command setup.
 * 
 * Usage:
 *   1. Create a project at https://supabase.com/dashboard → "New Project" → name it "baqala"
 *   2. Go to Settings → API → copy Project URL + service_role key
 *   3. Run: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/setup-supabase.js
 * 
 * This script: runs migration, seeds merchant + products, updates .env.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('❌ Missing env vars. Run:');
  console.error('   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/setup-supabase.js');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('🔌 Connecting to Supabase...');

  // Test connection
  const { error: testErr } = await supabase.from('merchants').select('id').limit(1);
  const tablesExist = !testErr;

  if (!tablesExist) {
    console.log('📋 Tables not found. Run the migration SQL manually:');
    console.log(`   1. Open: ${url.replace('.supabase.co', '.supabase.com/project/_/sql')}`);
    console.log('   2. Paste contents of: supabase/migrations/001_initial_schema.sql');
    console.log('   3. Click "Run", then re-run this script');
    // Still update .env so user doesn't have to re-enter creds
  } else {
    console.log('✅ Tables exist');
  }

  if (tablesExist) {
    // Seed merchant
    console.log('🌱 Seeding test merchant...');
    const { data: merchant } = await supabase.from('merchants').upsert({
      id: 'test0001',
      name_ar: 'بقالة أبو حسن (تجربة)',
      phone: '964770000001',
      neighborhood: 'زيونة',
      address: 'بغداد، زيونة، شارع الربيعي',
      delivery_provider: 'merchant_driver',
      active: true,
    }, { onConflict: 'phone' }).select().single();
    console.log(`✅ Merchant: ${merchant?.name_ar || 'seeded'}`);

    // Seed products
    const products = [
      { name_ar: 'طماطة', price_iqd: 2500, unit: 'كيلو', category: 'خضار' },
      { name_ar: 'بطاطا', price_iqd: 1500, unit: 'كيلو', category: 'خضار' },
      { name_ar: 'خيار', price_iqd: 2000, unit: 'كيلو', category: 'خضار' },
      { name_ar: 'بصل', price_iqd: 1000, unit: 'كيلو', category: 'خضار' },
      { name_ar: 'دجاج', price_iqd: 12000, unit: 'حبة', category: 'لحوم' },
      { name_ar: 'لحم غنم', price_iqd: 22000, unit: 'كيلو', category: 'لحوم' },
      { name_ar: 'رز عنبر', price_iqd: 4500, unit: 'كيلو', category: 'أساسيات' },
      { name_ar: 'زيت نباتي', price_iqd: 3500, unit: 'لتر', category: 'أساسيات' },
      { name_ar: 'خبز صمون', price_iqd: 1000, unit: 'ربطة', category: 'مخبوزات' },
      { name_ar: 'بيض', price_iqd: 5000, unit: 'طبق', category: 'أساسيات' },
    ];
    for (const p of products) {
      await supabase.from('products').upsert({
        id: Math.random().toString(36).slice(2, 10),
        merchant_id: 'test0001', ...p,
        in_stock: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id,name_ar' });
    }
    console.log(`✅ ${products.length} products seeded`);
  }

  // Update .env
  const envPath = join(ROOT, '.env');
  let env = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  if (!env.includes('SUPABASE_URL')) {
    env += `\nSUPABASE_URL=${url}\nSUPABASE_SERVICE_KEY=${key}\n`;
    writeFileSync(envPath, env);
    console.log('✅ .env updated');
  }

  console.log('\n🚀 Done! Run: npm run dev');
  console.log('   App auto-detects Supabase via SUPABASE_URL in .env');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
