import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from '../../lib/supabase';
import { db } from '../../lib/supabase';
import { useAuth } from "../../context/AuthContext";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Calendar,
  Download,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Building2,
  Users,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  ShoppingBag,
  ArrowRight,
  Receipt,
  Wallet,
  Coins,
  ChevronRight,
  FileText
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { formatCurrency, formatIndianNumber, cn } from "../../lib/utils";
import { seedMockData } from "../../utils/mockDataLoader";
import {
  subMonths,
  subDays,
  format,
  startOfDay,
  isSameDay,
  isAfter,
  startOfMonth,
  endOfMonth,
  startOfYear
} from "date-fns";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

// Helper to safely extract total money value from any sale document structure
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

// Helper to safely extract purchase amount
const getPurchaseAmount = (p) => {
  if (!p) return 0;
  const val = p.grandTotal ?? p.total ?? p.taxableTotal;
  if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
    return parseFloat(val);
  }
  if (p.buyingPrice !== undefined && p.qty !== undefined) {
    return (parseFloat(p.buyingPrice) || 0) * (parseFloat(p.qty) || 1);
  }
  if (Array.isArray(p.items) && p.items.length > 0) {
    return p.items.reduce((sum, item) => {
      const lineTotal = item.total ?? ((parseFloat(item.buyingPrice || item.price || 0)) * (parseFloat(item.qty || item.quantity || 1)));
      return sum + (parseFloat(lineTotal) || 0);
    }, 0);
  }
  return 0;
};

// Helper to safely parse dates across Firestore Timestamps, JS Dates, ISO strings, and seconds
const parseItemDate = (item) => {
  if (!item) return new Date();
  if (item.date && typeof item.date.toDate === "function") {
    return item.date.toDate();
  }
  if (item.date && typeof item.date.seconds === "number") {
    return new Date(item.date.seconds * 1000);
  }
  if (item.date instanceof Date && !isNaN(item.date.getTime())) {
    return item.date;
  }
  if (typeof item.date === "string" || typeof item.date === "number") {
    const parsed = new Date(item.date);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (item.createdAt && typeof item.createdAt.toDate === "function") {
    return item.createdAt.toDate();
  }
  if (item.createdAt && typeof item.createdAt.seconds === "number") {
    return new Date(item.createdAt.seconds * 1000);
  }
  if (item.createdAt) {
    const parsed = new Date(item.createdAt);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const Dashboard = () => {
  const { user, companyId } = useAuth();
  const navigate = useNavigate();

  const [rawSales, setRawSales] = useState([]);
  const [rawPurchases, setRawPurchases] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  const [rawPayments, setRawPayments] = useState([]);
  const [rawCustomers, setRawCustomers] = useState([]);
  const [rawSuppliers, setRawSuppliers] = useState([]);
  const [rawBankAccounts, setRawBankAccounts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("thisMonth");
  const [lastSynced, setLastSynced] = useState(new Date());

  // Real-time Firestore Subscriptions for all core collections
  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    // 1. Live Sales Listener
    const salesQuery = query(
      collection(db, "sales"),
      where("companyId", "==", companyId)
    );
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawSales(list);
      setLastSynced(new Date());
      setLoading(false);
    }, (err) => {
      console.error("Sales snapshot error:", err);
      setLoading(false);
    });

    // 2. Live Purchases Listener
    const purchaseQuery = query(
      collection(db, "purchases"),
      where("companyId", "==", companyId)
    );
    const unsubPurchases = onSnapshot(purchaseQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawPurchases(list);
    }, (err) => console.error("Purchases snapshot error:", err));

    // 3. Live Products Listener
    const productsQuery = query(
      collection(db, "products"),
      where("companyId", "==", companyId)
    );
    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawProducts(list);
    }, (err) => console.error("Products snapshot error:", err));

    // 4. Live Expenses Listener
    const expensesQuery = query(
      collection(db, "expenses"),
      where("companyId", "==", companyId)
    );
    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawExpenses(list);
    }, (err) => console.error("Expenses snapshot error:", err));

    // 5. Live Payment Vouchers Listener (Payment In & Out)
    const paymentsQuery = query(
      collection(db, "payment_vouchers"),
      where("companyId", "==", companyId)
    );
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawPayments(list);
    }, (err) => console.error("Payments snapshot error:", err));

    // 6. Live Customers Listener
    const customersQuery = query(
      collection(db, "customers"),
      where("companyId", "==", companyId)
    );
    const unsubCustomers = onSnapshot(customersQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawCustomers(list);
    }, (err) => console.error("Customers snapshot error:", err));

    // 7. Live Suppliers Listener
    const suppliersQuery = query(
      collection(db, "suppliers"),
      where("companyId", "==", companyId)
    );
    const unsubSuppliers = onSnapshot(suppliersQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawSuppliers(list);
    }, (err) => console.error("Suppliers snapshot error:", err));

    // 8. Live Bank Accounts Listener
    const bankQuery = query(
      collection(db, "bank_accounts"),
      where("companyId", "==", companyId)
    );
    const unsubBank = onSnapshot(bankQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRawBankAccounts(list);
    }, (err) => console.error("Bank Accounts snapshot error:", err));

    return () => {
      unsubSales();
      unsubPurchases();
      unsubProducts();
      unsubExpenses();
      unsubPayments();
      unsubCustomers();
      unsubSuppliers();
      unsubBank();
    };
  }, [companyId]);

  // Filter items by Date Range
  const filterByDateRange = (items) => {
    const now = new Date();
    return items.filter((item) => {
      if (dateRange === "allTime") return true;
      const itemDate = parseItemDate(item);

      if (dateRange === "today") {
        return isSameDay(itemDate, now);
      }
      if (dateRange === "thisWeek") {
        const weekAgo = subDays(now, 7);
        return isAfter(itemDate, weekAgo);
      }
      if (dateRange === "thisMonth") {
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      }
      if (dateRange === "lastMonth") {
        const lastM = subMonths(now, 1);
        return (
          itemDate.getMonth() === lastM.getMonth() &&
          itemDate.getFullYear() === lastM.getFullYear()
        );
      }
      if (dateRange === "thisYear") {
        return itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  // Compute all metrics dynamically
  const {
    filteredSales,
    filteredPurchases,
    filteredPaymentsIn,
    filteredPaymentsOut,
    totalInvoicedRevenue,
    totalPaymentIn,
    totalPaymentOut,
    totalPurchasesCost,
    totalOperatingExpenses,
    totalExpenses,
    netProfit,
    profitMargin,
    salesCount,
    totalReceivables,
    totalPayables,
    totalLiquidCash,
    topProducts,
    stockStatus,
    lowStockTotal,
    salesChartData,
    recentActivity
  } = useMemo(() => {
    const sList = filterByDateRange(rawSales).sort((a, b) => parseItemDate(b).getTime() - parseItemDate(a).getTime());
    const pList = filterByDateRange(rawPurchases).sort((a, b) => parseItemDate(b).getTime() - parseItemDate(a).getTime());
    const eList = filterByDateRange(rawExpenses);
    const payList = filterByDateRange(rawPayments);

    const payInList = payList.filter(p => (p.voucherType || 'payment_in') === 'payment_in');
    const payOutList = payList.filter(p => p.voucherType === 'payment_out');

    // 1. Total Invoiced Revenue
    const invoicedRevenue = sList.reduce((acc, sale) => acc + getSaleAmount(sale), 0);

    // 2. Payments In (Customer Receipts Collected in period)
    const paymentInTotal = payInList.reduce((acc, p) => acc + (parseFloat(p.amount || 0)), 0);

    // 3. Payments Out (Supplier Payouts in period)
    const paymentOutTotal = payOutList.reduce((acc, p) => acc + (parseFloat(p.amount || 0)), 0);

    // 4. Purchases COGS + Operating Expenses
    const purchaseCost = pList.reduce((acc, p) => acc + getPurchaseAmount(p), 0);
    const operatingExpenses = eList.reduce((acc, e) => acc + (parseFloat(e.amount || 0)), 0);
    const expenses = purchaseCost + operatingExpenses;

    // 5. Profit & Margins
    const profit = invoicedRevenue - expenses;
    const margin = invoicedRevenue > 0 ? (profit / invoicedRevenue) * 100 : 0;

    // 6. Outstanding Receivables & Payables
    const receivables = rawCustomers.reduce((acc, c) => acc + (parseFloat(c.creditBalance || 0)), 0);
    const payables = rawSuppliers.reduce((acc, s) => acc + (parseFloat(s.creditBalance || 0)), 0);

    // 7. Liquid Cash & Bank Balances
    const liquidCash = rawBankAccounts.reduce((acc, a) => acc + (parseFloat(a.currentBalance ?? a.openingBalance ?? 0)), 0);

    // 8. Top Selling Products
    const productMap = {};
    sList.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const name = item.name || "Product";
        if (!productMap[name]) {
          productMap[name] = { name, units: 0, revenue: 0 };
        }
        const qty = parseFloat(item.qty || item.quantity || 1) || 1;
        const total = parseFloat(item.total ?? ((parseFloat(item.price || 0)) * qty)) || 0;
        productMap[name].units += qty;
        productMap[name].revenue += total;
      });
    });

    const topList = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 9. Stock status & low stock count
    const catStockMap = {};
    rawProducts.forEach((p) => {
      const cat = p.category || "General";
      if (!catStockMap[cat]) catStockMap[cat] = { total: 0, low: 0 };
      catStockMap[cat].total++;
      const currentStock = parseInt(p.currentStock ?? p.stockQuantity ?? p.stock ?? 0);
      const threshold = parseInt(p.lowStockThreshold ?? 10);
      if (currentStock <= threshold) {
        catStockMap[cat].low++;
      }
    });

    const stockStatusList = Object.keys(catStockMap)
      .map((cat) => ({
        label: cat,
        percentage: catStockMap[cat].total > 0
          ? Math.round(((catStockMap[cat].total - catStockMap[cat].low) / catStockMap[cat].total) * 100)
          : 100,
        lowCount: catStockMap[cat].low
      }))
      .sort((a, b) => a.percentage - b.percentage);

    const lowStockCount = rawProducts.filter((p) => {
      const currentStock = parseInt(p.currentStock ?? p.stockQuantity ?? p.stock ?? 0);
      const threshold = parseInt(p.lowStockThreshold ?? 10);
      return currentStock <= threshold;
    }).length;

    // 10. Chart Map
    const chartMap = {};
    sList.forEach((sale) => {
      const saleDate = parseItemDate(sale);
      const day = format(saleDate, "MMM dd");
      const timestamp = startOfDay(saleDate).getTime();
      if (!chartMap[timestamp]) {
        chartMap[timestamp] = { name: day, revenue: 0, collected: 0, expenses: 0, timestamp };
      }
      chartMap[timestamp].revenue += getSaleAmount(sale);
    });

    payInList.forEach((p) => {
      const pDate = parseItemDate(p);
      const day = format(pDate, "MMM dd");
      const timestamp = startOfDay(pDate).getTime();
      if (!chartMap[timestamp]) {
        chartMap[timestamp] = { name: day, revenue: 0, collected: 0, expenses: 0, timestamp };
      }
      chartMap[timestamp].collected += parseFloat(p.amount || 0);
    });

    pList.forEach((p) => {
      const pDate = parseItemDate(p);
      const day = format(pDate, "MMM dd");
      const timestamp = startOfDay(pDate).getTime();
      if (!chartMap[timestamp]) {
        chartMap[timestamp] = { name: day, revenue: 0, collected: 0, expenses: 0, timestamp };
      }
      chartMap[timestamp].expenses += getPurchaseAmount(p);
    });

    const sortedChart = Object.values(chartMap)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ name, revenue, collected, expenses }) => ({ name, revenue, collected, expenses }));

    const finalChart = sortedChart.length > 0 ? sortedChart : [
      { name: format(subDays(new Date(), 4), "MMM dd"), revenue: 0, collected: 0, expenses: 0 },
      { name: format(subDays(new Date(), 3), "MMM dd"), revenue: 0, collected: 0, expenses: 0 },
      { name: format(subDays(new Date(), 2), "MMM dd"), revenue: 0, collected: 0, expenses: 0 },
      { name: format(subDays(new Date(), 1), "MMM dd"), revenue: 0, collected: 0, expenses: 0 },
      { name: format(new Date(), "MMM dd"), revenue: 0, collected: 0, expenses: 0 },
    ];

    // 11. Recent Combined Transactions
    const combined = [
      ...sList.slice(0, 5).map(s => ({
        id: s.id,
        type: 'sale',
        title: `Sales Invoice #${s.invoiceNumber || s.invoiceNo || 'INV'}`,
        party: s.customerName || 'Customer',
        amount: getSaleAmount(s),
        date: parseItemDate(s),
        status: s.paymentStatus || (s.saleType === 'Cash' ? 'Paid' : 'Unpaid'),
        isCredit: s.saleType === 'Credit' || s.saleType === 'Due'
      })),
      ...payList.slice(0, 5).map(p => ({
        id: p.id,
        type: p.voucherType === 'payment_out' ? 'payment_out' : 'payment_in',
        title: `${p.voucherType === 'payment_out' ? 'Payout' : 'Receipt'} #${p.voucherNo || 'VOUCHER'}`,
        party: p.partyName || 'Party',
        amount: parseFloat(p.amount || 0),
        date: parseItemDate(p),
        status: 'Settled',
        isCredit: false
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);

    return {
      filteredSales: sList,
      filteredPurchases: pList,
      filteredPaymentsIn: payInList,
      filteredPaymentsOut: payOutList,
      totalInvoicedRevenue: invoicedRevenue,
      totalPaymentIn: paymentInTotal,
      totalPaymentOut: paymentOutTotal,
      totalPurchasesCost: purchaseCost,
      totalOperatingExpenses: operatingExpenses,
      totalExpenses: expenses,
      netProfit: profit,
      profitMargin: margin,
      salesCount: sList.length,
      totalReceivables: receivables,
      totalPayables: payables,
      totalLiquidCash: liquidCash,
      topProducts: topList,
      stockStatus: stockStatusList,
      lowStockTotal: lowStockCount,
      salesChartData: finalChart,
      recentActivity: combined
    };
  }, [rawSales, rawPurchases, rawExpenses, rawPayments, rawCustomers, rawSuppliers, rawBankAccounts, rawProducts, dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            Dashboard
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Live Real-time Synced" />
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
            Real-time business performance, revenue & cashflow summary • 
            <span className="text-slate-400 font-mono text-[11px]">
              Live Updated {format(lastSynced, "hh:mm:ss a")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-lg text-xs shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-xs font-medium focus:ring-0 outline-none text-slate-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="thisWeek">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="allTime">All Time</option>
            </select>
          </div>

          {user?.email === 'kakashigod777@gmail.com' && (
            <button 
              onClick={async () => {
                if (!window.confirm('Populate rich sample business dataset in your current account?')) return;
                try {
                  toast.loading('Filling mock data...', { id: 'mock-load' });
                  await seedMockData(companyId, 'Apex Retail & Traders');
                  toast.success('Sample business data filled!', { id: 'mock-load' });
                } catch (err) {
                  console.error(err);
                  toast.error(err?.message || 'Failed to fill mock data', { id: 'mock-load' });
                }
              }}
              className="btn-primary flex items-center gap-1.5"
              title="Populate complete sample business dataset"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Mock Data</span>
            </button>
          )}

          <button 
            onClick={() => window.print()}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Receivables & Payables Quick Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link 
          to="/payments?type=payment_in"
          className="card p-3.5 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Receivables (To Collect)</span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency(totalReceivables)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
        </Link>

        <Link 
          to="/payments?type=payment_out"
          className="card p-3.5 hover:border-rose-300 dark:hover:border-rose-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/50">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Payables (To Pay)</span>
              <span className="text-sm font-black text-slate-800 dark:text-zinc-200 tabular-nums">
                {formatCurrency(totalPayables)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 transition-colors" />
        </Link>

        <Link 
          to="/banking"
          className="card p-3.5 hover:border-primary-300 dark:hover:border-primary-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-200/50">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cash & Bank Balances</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(totalLiquidCash)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
        </Link>

        <Link 
          to="/payments?type=payment_in"
          className="card p-3.5 hover:border-primary-300 dark:hover:border-primary-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment In Collected</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(totalPaymentIn)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
        </Link>
      </div>

      {/* Main 4 Core KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Invoiced Revenue */}
        <div className="card p-4 transition-all hover:shadow-md border-t-2 border-t-slate-900 dark:border-t-zinc-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Invoiced Revenue</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded">
              +{salesCount} Bills
            </span>
          </div>
          <p className="text-xl font-black text-slate-950 dark:text-white mt-2 tabular-nums">
            {formatCurrency(totalInvoicedRevenue)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
            {dateRange === "allTime" ? "All-time sales" : "Invoiced in selected period"}
          </span>
        </div>

        {/* Purchases & Direct Cost */}
        <div className="card p-4 transition-all hover:shadow-md border-t-2 border-t-slate-400 dark:border-t-zinc-600">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Purchases & Cost (COGS)</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded">
              COGS
            </span>
          </div>
          <p className="text-xl font-black text-slate-950 dark:text-white mt-2 tabular-nums">
            {formatCurrency(totalExpenses)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">Direct goods + expenses</span>
        </div>

        {/* Net Profit */}
        <div className="card p-4 transition-all hover:shadow-md border-t-2 border-t-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Net Profit</span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              netProfit >= 0 
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400"
            )}>
              {profitMargin.toFixed(1)}% Margin
            </span>
          </div>
          <p className={cn(
            "text-xl font-black mt-2 tabular-nums",
            netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {formatCurrency(netProfit)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">Revenue minus direct costs</span>
        </div>

        {/* Stock Alerts */}
        <div className="card p-4 transition-all hover:shadow-md border-t-2 border-t-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Stock Alerts</span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              lowStockTotal > 0 ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
            )}>
              {lowStockTotal} Items
            </span>
          </div>
          <p className="text-xl font-black text-slate-950 dark:text-white mt-2 tabular-nums">
            {lowStockTotal} Items
          </p>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">Below safety threshold</span>
        </div>
      </div>

      {/* Main Charts & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue & Cashflow Trend Chart (2 Cols) */}
        <div className="card lg:col-span-2 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Revenue, Receipts & Expense Trend</h3>
              <p className="text-[11px] text-slate-400">Comparing Invoiced Sales, Collected Receipts (Payment In), and Expenses</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" /> Invoiced
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Collected
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-600" /> Expenses
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontSize: 10 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontSize: 10 }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    color: "#fff",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "11px",
                    padding: "6px 10px"
                  }}
                  formatter={(value, name) => [
                    formatCurrency(value), 
                    name === 'revenue' ? 'Invoiced Sales' : name === 'collected' ? 'Collected (Payment In)' : 'Expenses / Payouts'
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={1.5} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={1.5} fill="url(#colGrad)" />
                <Area type="monotone" dataKey="expenses" stroke="#94a3b8" strokeWidth={1.5} fill="transparent" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products (1 Col) */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Top Selling Products</h3>
            <span className="text-[10px] text-slate-400">By Revenue</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 flex-1">
            {topProducts.length > 0 ? (
              topProducts.map((p, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.units} units sold</p>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No product sales recorded yet for this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Live Transactions & Category Stock Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Recent Transactions & Vouchers (7 Cols) */}
        <div className="card p-4 lg:col-span-7">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Recent Revenue & Settlement Activity</h3>
            </div>
            <Link to="/sales" className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-0.5">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent activity recorded yet.
              </div>
            ) : (
              recentActivity.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                      item.type === 'sale'
                        ? "bg-primary-50 dark:bg-primary-950/40 text-primary-600"
                        : item.type === 'payment_in'
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-600"
                    )}>
                      {item.type === 'sale' ? <FileText className="w-3.5 h-3.5" /> : item.type === 'payment_in' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.party} • {format(item.date, "dd MMM, hh:mm a")}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={cn(
                      "font-bold tabular-nums block",
                      item.type === 'payment_out' ? "text-rose-600" : "text-slate-900 dark:text-zinc-100"
                    )}>
                      {item.type === 'payment_out' ? '-' : '+'}{formatCurrency(item.amount)}
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded",
                      item.status === 'Paid' || item.status === 'Settled'
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-600"
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Stock Health (5 Cols) */}
        <div className="card p-4 lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Category Stock Health</h3>
            <span className="text-[10px] text-slate-400">Availability ratio</span>
          </div>

          <div className="space-y-3 flex-1">
            {(stockStatus || []).slice(0, 4).map((item, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 dark:bg-zinc-900/60 rounded-lg border border-slate-200/60 dark:border-zinc-800/60 space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-800 dark:text-zinc-200">{item.label}</span>
                  <span className={item.percentage < 50 ? "text-rose-500 font-bold" : "text-slate-500"}>{item.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      item.percentage > 70 ? "bg-slate-900 dark:bg-zinc-100" : item.percentage > 30 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
