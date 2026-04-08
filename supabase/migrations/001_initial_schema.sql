-- Baqala: Initial Supabase schema
-- Mirrors sql.js local schema with Postgres types + RLS

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Merchants ──
create table if not exists merchants (
  id text primary key default substring(uuid_generate_v4()::text, 1, 8),
  name_ar text not null,
  phone text unique not null,
  city text default 'بغداد',
  neighborhood text,
  address text,
  driver_phone text,
  delivery_provider text default 'merchant_driver',
  commission_pct numeric(5,2) default 5.0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── Products ──
create table if not exists products (
  id text primary key default substring(uuid_generate_v4()::text, 1, 8),
  merchant_id text references merchants(id) on delete cascade,
  name_ar text not null,
  price_iqd integer not null,
  unit text default 'كيلو',
  category text default 'أخرى',
  image_url text,
  in_stock boolean default true,
  weight_kg numeric(6,2),
  updated_at timestamptz default now(),
  unique(merchant_id, name_ar)
);

-- ── Orders ──
create table if not exists orders (
  id text primary key default substring(uuid_generate_v4()::text, 1, 8),
  merchant_id text references merchants(id),
  customer_phone text not null,
  customer_name text,
  address text,
  items jsonb not null default '[]'::jsonb,
  total_iqd integer default 0,
  status text default 'pending',
  delivery_provider text,
  boxy_order_id text,
  tracking_number text,
  updated_at timestamptz,
  created_at timestamptz default now()
);

-- ── Messages (conversation log) ──
create table if not exists messages (
  id text primary key default uuid_generate_v4()::text,
  merchant_id text references merchants(id),
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  message_type text default 'text',
  created_at timestamptz default now()
);

-- ── Indexes ──
create index if not exists idx_products_merchant on products(merchant_id);
create index if not exists idx_orders_merchant on orders(merchant_id);
create index if not exists idx_orders_customer on orders(customer_phone);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_messages_phone on messages(phone);

-- ── Row Level Security ──
alter table merchants enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table messages enable row level security;

-- Service role (backend) gets full access
create policy "service_full_access" on merchants for all using (true) with check (true);
create policy "service_full_access" on products for all using (true) with check (true);
create policy "service_full_access" on orders for all using (true) with check (true);
create policy "service_full_access" on messages for all using (true) with check (true);
