# Testing Credentials

## Super Admin
- **Email:** `sherwinbritto232@gmail.com`
- **Password:** `admin123`
- **Scope:** Multi-tenant platform administration, all companies.

---

## Company: Zentech

### 1. Admin (Full Access)
- **Email:** `kakashigod777@gmail.com`
- **Password:** `zenox123`
- **Scope:** Complete company control (Executive Dashboard, P&L Reports, GST Returns, Bank Accounts, Settings, User Management).

### 2. Staff (Operations & Billing)
- **Email:** `sherwinbritto777@gmail.com`
- **Password:** `sherwin123`
- **Scope:** POS counter billing, Sales invoices, Quotations, Challans, Returns, Products & Stock, Purchases, Expenses, Payment Vouchers, Contacts, Online Orders, WhatsApp.

---

## Company: TechZone

### Admin
- **Email:** `sherwinbritto1990@gmail.com`
- **Password:** `tim123`
- **Scope:** Full Admin control for second tenant.

---

## 🔑 Role Permission Summary

| Area / Feature | Staff Role | Admin Role | Super Admin |
| :--- | :---: | :---: | :---: |
| **POS Fast Billing (`/pos`)** | ✅ | ✅ | ✅ |
| **Invoices, Quotes, Challans, Returns** | ✅ | ✅ | ✅ |
| **Inventory & Barcode Label Designer** | ✅ | ✅ | ✅ |
| **Purchases, Expenses & Payments In/Out** | ✅ | ✅ | ✅ |
| **Customer & Supplier Directory** | ✅ | ✅ | ✅ |
| **Online Orders & WhatsApp Reminders** | ✅ | ✅ | ✅ |
| **Executive Revenue Dashboard (`/`)** | 🔒 | ✅ | ✅ |
| **P&L & Financial Reports (`/reports`)** | 🔒 | ✅ | ✅ |
| **GST Returns & E-Way Bills (`/gst-reports`)** | 🔒 | ✅ | ✅ |
| **Cash & Bank Accounts (`/banking`)** | 🔒 | ✅ | ✅ |
| **System Settings & Team Management** | 🔒 | ✅ | ✅ |
| **Multi-Tenant Administration (`/superadmin`)** | 🔒 | 🔒 | ✅ |
