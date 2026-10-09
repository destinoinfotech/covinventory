-- ==============================================================================
-- Covinventory — Enterprise Supabase PostgreSQL Database Schema
-- Run this complete script in your Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Companies / Business Tenants Table
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    trade_name TEXT,
    gstin TEXT,
    pan TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    state TEXT,
    state_code TEXT,
    pincode TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    upi_id TEXT,
    logo_url TEXT,
    signature_url TEXT,
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_seq INTEGER DEFAULT 1001,
    theme TEXT DEFAULT 'dark',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to companies" ON public.companies;
CREATE POLICY "Allow full access to companies" ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Users / Staff Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY, -- Matches auth.users.id
    email TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'staff' CHECK (role IN ('superadmin', 'admin', 'cashier', 'accountant', 'warehouse', 'staff')),
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    phone TEXT,
    status TEXT DEFAULT 'active',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to users" ON public.users;
CREATE POLICY "Allow full access to users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Products / Inventory Items Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    category TEXT,
    brand TEXT,
    hsn_code TEXT,
    description TEXT,
    purchase_price NUMERIC(12, 2) DEFAULT 0,
    sale_price NUMERIC(12, 2) DEFAULT 0,
    mrp NUMERIC(12, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 18.0,
    tax_type TEXT DEFAULT 'exclusive',
    primary_unit TEXT DEFAULT 'PCS',
    secondary_unit TEXT,
    conversion_ratio NUMERIC(10, 4) DEFAULT 1,
    current_stock NUMERIC(12, 2) DEFAULT 0,
    min_stock_alert NUMERIC(12, 2) DEFAULT 5,
    godown_id TEXT,
    godown_name TEXT,
    has_batches BOOLEAN DEFAULT FALSE,
    batches JSONB DEFAULT '[]'::jsonb,
    has_serials BOOLEAN DEFAULT FALSE,
    serials JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to products" ON public.products;
CREATE POLICY "Allow full access to products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to categories" ON public.categories;
CREATE POLICY "Allow full access to categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Units Table
CREATE TABLE IF NOT EXISTS public.units (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to units" ON public.units;
CREATE POLICY "Allow full access to units" ON public.units FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Godowns / Warehouses Table
CREATE TABLE IF NOT EXISTS public.godowns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    manager_name TEXT,
    contact_phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.godowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to godowns" ON public.godowns;
CREATE POLICY "Allow full access to godowns" ON public.godowns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Stock Adjustments Table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    adjustment_no TEXT,
    product_id TEXT NOT NULL,
    product_name TEXT,
    godown_id TEXT,
    godown_name TEXT,
    adjustment_type TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    adjusted_by TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Allow full access to stock_adjustments" ON public.stock_adjustments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. Stock Transfers Table
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    transfer_no TEXT,
    source_godown_id TEXT NOT NULL,
    source_godown_name TEXT,
    dest_godown_id TEXT NOT NULL,
    dest_godown_name TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to stock_transfers" ON public.stock_transfers;
CREATE POLICY "Allow full access to stock_transfers" ON public.stock_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. Parties (Customers & Suppliers) Table
CREATE TABLE IF NOT EXISTS public.people (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    pan TEXT,
    address TEXT,
    state TEXT,
    state_code TEXT,
    pincode TEXT,
    opening_balance NUMERIC(12, 2) DEFAULT 0,
    balance_type TEXT DEFAULT 'to_receive',
    current_balance NUMERIC(12, 2) DEFAULT 0,
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to people" ON public.people;
CREATE POLICY "Allow full access to people" ON public.people FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 11. Sales Invoices & POS Bills Table
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_gstin TEXT,
    customer_address TEXT,
    customer_state TEXT,
    customer_state_code TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    taxable_amount NUMERIC(12, 2) DEFAULT 0,
    cgst_amount NUMERIC(12, 2) DEFAULT 0,
    sgst_amount NUMERIC(12, 2) DEFAULT 0,
    igst_amount NUMERIC(12, 2) DEFAULT 0,
    total_tax NUMERIC(12, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    round_off NUMERIC(6, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    balance_amount NUMERIC(12, 2) DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    payment_details JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'paid',
    is_pos BOOLEAN DEFAULT FALSE,
    notes TEXT,
    terms TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to sales" ON public.sales;
CREATE POLICY "Allow full access to sales" ON public.sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 12. Delivery Challans Table
CREATE TABLE IF NOT EXISTS public.delivery_challans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    challan_no TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending',
    converted_invoice_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to delivery_challans" ON public.delivery_challans;
CREATE POLICY "Allow full access to delivery_challans" ON public.delivery_challans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 13. Quotations & Estimates Table
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    quotation_no TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    total_tax NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    converted_invoice_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to quotations" ON public.quotations;
CREATE POLICY "Allow full access to quotations" ON public.quotations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 14. Sales Returns / Credit Notes Table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    return_no TEXT NOT NULL,
    original_invoice_no TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to sales_returns" ON public.sales_returns;
CREATE POLICY "Allow full access to sales_returns" ON public.sales_returns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 15. Purchases & Supplier Bills Table
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    supplier_id TEXT,
    supplier_name TEXT,
    supplier_gstin TEXT,
    supplier_phone TEXT,
    supplier_address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    taxable_amount NUMERIC(12, 2) DEFAULT 0,
    cgst_amount NUMERIC(12, 2) DEFAULT 0,
    sgst_amount NUMERIC(12, 2) DEFAULT 0,
    igst_amount NUMERIC(12, 2) DEFAULT 0,
    total_tax NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    balance_amount NUMERIC(12, 2) DEFAULT 0,
    payment_mode TEXT DEFAULT 'Bank Transfer',
    status TEXT DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to purchases" ON public.purchases;
CREATE POLICY "Allow full access to purchases" ON public.purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 16. Purchase Returns / Debit Notes Table
CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    return_no TEXT NOT NULL,
    original_bill_no TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    supplier_id TEXT,
    supplier_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to purchase_returns" ON public.purchase_returns;
CREATE POLICY "Allow full access to purchase_returns" ON public.purchase_returns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 17. Bank Accounts & Cash Wallets Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT DEFAULT 'bank',
    account_number TEXT,
    bank_name TEXT,
    ifsc_code TEXT,
    branch_name TEXT,
    opening_balance NUMERIC(12, 2) DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to accounts" ON public.accounts;
CREATE POLICY "Allow full access to accounts" ON public.accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 18. Financial Transactions & Contra Entries Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    transaction_no TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL,
    from_account_id TEXT,
    from_account_name TEXT,
    to_account_id TEXT,
    to_account_name TEXT,
    party_id TEXT,
    party_name TEXT,
    party_type TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    reference_no TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to transactions" ON public.transactions;
CREATE POLICY "Allow full access to transactions" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 19. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    expense_no TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    account_id TEXT,
    account_name TEXT,
    vendor_name TEXT,
    vendor_gstin TEXT,
    gst_rate NUMERIC(5, 2) DEFAULT 0,
    gst_amount NUMERIC(12, 2) DEFAULT 0,
    is_itc_eligible BOOLEAN DEFAULT FALSE,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to expenses" ON public.expenses;
CREATE POLICY "Allow full access to expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 20. Online Mini Shop Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    order_no TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'COD',
    payment_status TEXT DEFAULT 'pending',
    order_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to orders" ON public.orders;
CREATE POLICY "Allow full access to orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 21. Discount Coupons & Promotions Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    usage_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to coupons" ON public.coupons;
CREATE POLICY "Allow full access to coupons" ON public.coupons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 22. Company Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    business_name TEXT,
    company_name TEXT,
    gstin TEXT,
    state TEXT,
    gst_scheme TEXT DEFAULT 'Regular',
    reverse_charge_default BOOLEAN DEFAULT FALSE,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    website TEXT,
    logo_url TEXT,
    upi_id TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    default_print_template TEXT DEFAULT 'thermal',
    terms TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to settings" ON public.settings;
CREATE POLICY "Allow full access to settings" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 23. Indexes for Multi-Tenant Query Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_sales_company_id ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_company_id ON public.purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_people_company_id ON public.people(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON public.accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);

-- ==============================================================================
-- 24. Automatic User Profile Creation on Supabase Auth SignUp
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, company_id, status)
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'company_id', 'company_default'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 25. Enable Real-Time Replication for Live UI updates
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.companies,
  public.users,
  public.products,
  public.sales,
  public.purchases,
  public.people,
  public.accounts,
  public.transactions,
  public.expenses,
  public.orders,
  public.settings;
