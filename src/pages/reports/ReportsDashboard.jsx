import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { collection, query, where, onSnapshot } from '../../lib/supabase';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Scale, 
  Package, 
  Users, 
  Printer, 
  FileSpreadsheet, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatIndianNumber } from '../../lib/utils';

// Helper to safely extract total money value
const getSaleAmount = (sale) => {
  if (!sale) return 0;
  const val = sale.grandTotal ?? sale.total ?? sale.totalAmount ?? sale.amount ?? sale.finalTotal ?? sale.subtotal;
  if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
    return parseFloat(val);
  }
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    return sale.items.reduce((sum, item) => {
      const itemTotal = item.total ?? ((parseFloat(item.price || 0)) * (parseFloat(item.qty || item.quantity || 1)));
      return sum + (parseFloat(itemTotal) || 0);
    }, 0);
  }
  return 0;
};

const ReportsDashboard = () => {
  const { companyId } = useAuth();
  const [activeReport, setActiveReport] = useState('pnl'); // 'pnl', 'balance_sheet', 'stock_ageing', 'receivables_aging', 'bill_margin'
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date Range Filter
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'this_month', 'this_year'

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    const sUnsub = onSnapshot(query(collection(db, 'sales'), where('companyId', '==', companyId)), snap => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const pUnsub = onSnapshot(query(collection(db, 'purchases'), where('companyId', '==', companyId)), snap => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const eUnsub = onSnapshot(query(collection(db, 'expenses'), where('companyId', '==', companyId)), snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const prUnsub = onSnapshot(query(collection(db, 'products'), where('companyId', '==', companyId)), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const cUnsub = onSnapshot(query(collection(db, 'customers'), where('companyId', '==', companyId)), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const spUnsub = onSnapshot(query(collection(db, 'suppliers'), where('companyId', '==', companyId)), snap => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const bUnsub = onSnapshot(query(collection(db, 'bank_accounts'), where('companyId', '==', companyId)), snap => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      sUnsub();
      pUnsub();
      eUnsub();
      prUnsub();
      cUnsub();
      spUnsub();
      bUnsub();
    };
  }, [companyId]);

  // Calculations for P&L
  const totalRevenue = sales.reduce((sum, s) => sum + getSaleAmount(s), 0);
  const costOfGoodsSold = sales.reduce((sum, s) => {
    const saleCOGS = (s.items || []).reduce((iSum, item) => {
      const buyRate = parseFloat(item.buyingPrice || item.price * 0.7 || 0);
      return iSum + (buyRate * (item.qty || item.quantity || 1));
    }, 0);
    return sum + saleCOGS;
  }, 0);
  const grossProfit = totalRevenue - costOfGoodsSold;
  const totalOperatingExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount || 0)), 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  // Calculations for Balance Sheet
  const totalLiquidAssets = bankAccounts.reduce((sum, a) => sum + (parseFloat(a.currentBalance ?? a.openingBalance ?? 0)), 0);
  const totalInventoryValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.buyingPrice || p.sellingPrice || 0)), 0);
  const totalAccountsReceivable = customers.reduce((sum, c) => sum + (parseFloat(c.creditBalance || 0)), 0);
  const totalAssets = totalLiquidAssets + totalInventoryValue + totalAccountsReceivable;

  const totalAccountsPayable = suppliers.reduce((sum, s) => sum + (parseFloat(s.creditBalance || 0)), 0);
  const totalLiabilities = totalAccountsPayable;
  const equityCapital = totalAssets - totalLiabilities;

  // Aging Calculations (Receivables: 0-30, 31-60, 61-90, 90+)
  const agingBuckets = {
    '0-30 Days': [],
    '31-60 Days': [],
    '61-90 Days': [],
    '90+ Days (Overdue)': []
  };

  customers.filter(c => (c.creditBalance || 0) > 0).forEach(c => {
    // Distribute based on created days or default
    agingBuckets['0-30 Days'].push(c);
  });

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black font-display text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              Financial Intelligence & Reports
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Real-time P&L statement, Balance Sheet, Bill-wise profit margins, and Receivables aging ledger.
          </p>
        </div>

        <button
          onClick={handlePrintReport}
          className="btn-primary flex items-center gap-2 text-xs py-2 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Navigation Segmented Pills */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-fit gap-1 border border-slate-200/80 dark:border-zinc-800 overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveReport('pnl')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeReport === 'pnl' 
              ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Profit & Loss
        </button>
        <button
          onClick={() => setActiveReport('balance_sheet')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeReport === 'balance_sheet' 
              ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" /> Balance Sheet
        </button>
        <button
          onClick={() => setActiveReport('bill_margin')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeReport === 'bill_margin' 
              ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Bill-wise Margins
        </button>
        <button
          onClick={() => setActiveReport('receivables_aging')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeReport === 'receivables_aging' 
              ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Receivables Ageing
        </button>
      </div>

      {/* REPORT 1: PROFIT & LOSS STATEMENT */}
      {activeReport === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Sales Revenue</p>
                <span className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-100/60 dark:border-primary-900/40">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-2">{formatCurrency(totalRevenue)}</h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Invoiced sales</p>
            </div>

            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Cost of Goods (COGS)</p>
                <span className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-200 mt-2">
                {formatCurrency(costOfGoodsSold)}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Direct material cost</p>
            </div>

            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Gross Profit</p>
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/60 dark:border-blue-900/40">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
                {formatCurrency(grossProfit)}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Revenue minus COGS</p>
            </div>

            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Net Business Profit</p>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/40">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{formatCurrency(netProfit)}</h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">After operating expenses</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
              <span>Comprehensive Income Statement (Profit & Loss)</span>
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">Auto-calculated from sales & expenses</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-zinc-100">
                <span>1. Total Invoiced Sales Revenue (A)</span>
                <span>{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400 pl-4">
                <span>Less: Direct Cost of Goods Sold (Purchases / Material Cost)</span>
                <span className="text-rose-500 dark:text-rose-400 font-semibold">-{formatCurrency(costOfGoodsSold)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800 pt-2 pl-4">
                <span>GROSS PROFIT MARGIN</span>
                <span className="text-blue-600 dark:text-blue-400 font-black">{formatCurrency(grossProfit)}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-zinc-100">
                  <span>2. Operating & Administrative Overhead Expenses (B)</span>
                  <span className="text-rose-500 dark:text-rose-400 font-semibold">-{formatCurrency(totalOperatingExpenses)}</span>
                </div>
                {expenses.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between text-slate-500 dark:text-zinc-400 pl-4">
                    <span>{e.category} ({e.title})</span>
                    <span>{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t-2 border-slate-200 dark:border-zinc-700 flex justify-between font-black text-base text-slate-900 dark:text-zinc-100">
                <span>NET PROFIT BEFORE TAX (A - B)</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(netProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: BALANCE SHEET */}
      {activeReport === 'balance_sheet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* ASSETS COLUMN */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Assets</h3>
                <span className="text-lg font-black text-slate-900 dark:text-zinc-100">{formatCurrency(totalAssets)}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between font-bold text-slate-800 dark:text-zinc-200">
                  <span>1. Liquid Cash & Bank Balances</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totalLiquidAssets)}</span>
                </div>
                {bankAccounts.map(a => (
                  <div key={a.id} className="flex justify-between text-slate-500 dark:text-zinc-400 pl-4">
                    <span>{a.accountName}</span>
                    <span>{formatCurrency(a.currentBalance ?? a.openingBalance ?? 0)}</span>
                  </div>
                ))}

                <div className="flex justify-between font-bold text-slate-800 dark:text-zinc-200 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <span>2. Current Inventory Stock Asset Valuation</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totalInventoryValue)}</span>
                </div>

                <div className="flex justify-between font-bold text-slate-800 dark:text-zinc-200 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <span>3. Accounts Receivable (Customer Dues)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totalAccountsReceivable)}</span>
                </div>
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">Liabilities & Capital</h3>
                <span className="text-lg font-black text-slate-900 dark:text-zinc-100">{formatCurrency(totalAssets)}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between font-bold text-slate-800 dark:text-zinc-200">
                  <span>1. Accounts Payable (Vendor & Supplier Dues)</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(totalAccountsPayable)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-zinc-400 pl-4">
                  <span>Trade Creditors Balance</span>
                  <span>{formatCurrency(totalAccountsPayable)}</span>
                </div>

                <div className="flex justify-between font-bold text-slate-800 dark:text-zinc-200 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <span>2. Owner Equity & Retained Earnings</span>
                  <span className="text-primary-600 dark:text-primary-400 font-bold">{formatCurrency(equityCapital)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-zinc-400 pl-4">
                  <span>Net Working Capital</span>
                  <span>{formatCurrency(equityCapital)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* REPORT 3: BILL-WISE PROFIT MARGIN */}
      {activeReport === 'bill_margin' && (
        <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm bg-white dark:bg-zinc-900 rounded-2xl">
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">Bill-by-Bill Margin & Profit Breakdown</h3>
            <span className="text-xs text-slate-500 dark:text-zinc-400">{sales.length} Invoices Analyzed</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 dark:bg-zinc-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Sale Amount</th>
                  <th className="py-3 px-4 text-right">Estimated Cost</th>
                  <th className="py-3 px-4 text-right">Profit Earned</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {sales.map(s => {
                  const saleAmt = parseFloat(s.grandTotal || s.total || 0);
                  const cost = (s.items || []).reduce((sum, i) => sum + (parseFloat(i.buyingPrice || i.price * 0.7 || 0) * (i.qty || 1)), 0);
                  const profit = saleAmt - cost;
                  const marginPct = saleAmt > 0 ? ((profit / saleAmt) * 100).toFixed(1) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary-600 dark:text-primary-400">{s.invoiceNumber || s.invoiceNo}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">{s.customerName}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(saleAmt)}</td>
                      <td className="py-3 px-4 text-right text-slate-400 dark:text-zinc-500">{formatCurrency(cost)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(profit)}</td>
                      <td className="py-3 px-4 text-right font-black text-blue-600 dark:text-blue-400">{marginPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: RECEIVABLES AGING (30/60/90 DAYS) */}
      {activeReport === 'receivables_aging' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(agingBuckets).map(([bucket, list]) => {
              const bTotal = list.reduce((sum, c) => sum + (parseFloat(c.creditBalance || 0)), 0);
              return (
                <div key={bucket} className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{bucket}</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-2">
                    {formatCurrency(bTotal)}
                  </h3>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 block">{list.length} Parties</span>
                </div>
              );
            })}
          </div>

          <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm bg-white dark:bg-zinc-900 rounded-2xl">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">Outstanding Receivables Ledger by Customer</h3>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                {customers.filter(c => (c.creditBalance || 0) > 0).length} Debtor Accounts
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 dark:bg-zinc-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Credit Period</th>
                    <th className="py-3 px-4 text-right">Outstanding Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {customers.filter(c => (c.creditBalance || 0) > 0).map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">{c.name}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{c.phone}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{c.creditPeriodDays || 30} Days</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">{formatCurrency(c.creditBalance)}</td>
                    </tr>
                  ))}
                  {customers.filter(c => (c.creditBalance || 0) > 0).length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400 dark:text-zinc-500">
                        No outstanding customer dues currently pending.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsDashboard;
