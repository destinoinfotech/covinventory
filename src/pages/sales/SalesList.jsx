import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  getDocs, 
  where, 
  increment, 
  writeBatch 
} from '../../lib/supabase';
import { db } from '../../lib/supabase';
import { useAuth } from "../../context/AuthContext";
import { 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Eye, 
  MoreHorizontal, 
  Mail, 
  MessageCircle, 
  FileText, 
  ShoppingCart, 
  Package, 
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { generateInvoicePDF, generateInvoiceFromHTML } from '../../utils/invoiceGenerator';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { useNavigate } from 'react-router-dom';

const parseItemDate = (item) => {
  if (!item) return new Date();
  const d = item.date || item.createdAt;
  if (!d) return new Date();
  if (typeof d.toDate === 'function') return d.toDate();
  if (d.seconds) return new Date(d.seconds * 1000);
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (d instanceof Date && !isNaN(d.getTime())) return d;
  return new Date();
};

const getSaleAmount = (s) => {
  if (!s) return 0;
  const val = s.grandTotal ?? s.total ?? s.totalAmount ?? s.amount ?? s.finalTotal ?? s.subtotal ?? 0;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const getSalePaidAmount = (s) => {
  if (!s) return 0;
  const total = getSaleAmount(s);
  if (s.paidAmount != null && !isNaN(parseFloat(s.paidAmount))) {
    return parseFloat(s.paidAmount);
  }
  const status = (s.paymentStatus || (s.saleType === 'Cash' ? 'Paid' : 'Unpaid')).toLowerCase();
  if (status === 'paid') return total;
  if (s.cashAmount != null && !isNaN(parseFloat(s.cashAmount))) {
    return parseFloat(s.cashAmount);
  }
  return 0;
};

const getSaleDueAmount = (s) => {
  if (!s) return 0;
  const total = getSaleAmount(s);
  const paid = getSalePaidAmount(s);
  if (s.creditAmount != null && !isNaN(parseFloat(s.creditAmount))) {
    return Math.max(0, parseFloat(s.creditAmount));
  }
  return Math.max(0, total - paid);
};

const getSaleStatus = (s) => {
  if (s.paymentStatus) {
    const st = s.paymentStatus.toLowerCase();
    if (st === 'paid') return 'Paid';
    if (st === 'partial') return 'Partial';
    if (st === 'unpaid') return 'Unpaid';
  }
  if (s.saleType === 'Cash') return 'Paid';
  const due = getSaleDueAmount(s);
  const paid = getSalePaidAmount(s);
  if (due <= 0.01) return 'Paid';
  if (paid > 0.01) return 'Partial';
  return 'Unpaid';
};

const isWithinDateRange = (date, filterType, customStart, customEnd) => {
  const d = new Date(date);
  const now = new Date();
  if (filterType === 'all') return true;
  if (filterType === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (filterType === 'week') {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= oneWeekAgo && d <= now;
  }
  if (filterType === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (filterType === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  return true;
};

const SalesList = () => {
  const { companyId, user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, UNPAID, PARTIAL, CREDIT, CASH
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Quick Receive Payment Modal State
  const [settlementSale, setSettlementSale] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [isSettling, setIsSettling] = useState(false);

  const navigate = useNavigate();
  const invoicePreviewRef = useRef(null);

  const [businessInfo, setBusinessInfo] = useState({
    name: "My Business Name",
    address: "123 Business Street, City, State - 110001",
    gstin: "22AAAAA0000A1Z5",
    phone: "+91 98765 43210",
    email: "contact@business.com",
    logoURL: "",
    terms: "1. Goods once sold will not be returned.\n2. Warranty as per manufacturer terms."
  });

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, 'sales'), 
      where('companyId', '==', companyId)
    );
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by date desc
        salesData.sort((a, b) => {
          const timeA = parseItemDate(a).getTime();
          const timeB = parseItemDate(b).getTime();
          return timeB - timeA;
        });
        setSales(salesData);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error in SalesList:", error);
        setLoading(false);
      }
    );

    const fetchBusinessProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', companyId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBusinessInfo({
            name: data.businessName || "My Business Name",
            address: data.address || "123 Business Street, City, State - 110001",
            gstin: data.gstin || "22AAAAA0000A1Z5",
            phone: data.phone || "+91 98765 43210",
            email: data.email || "contact@business.com",
            logoURL: data.logoURL || "",
            terms: data.terms || "1. Goods once sold will not be returned.\n2. Warranty as per manufacturer terms."
          });
        }
      } catch (error) {
        console.error("Error fetching business profile:", error);
      }
    };
    fetchBusinessProfile();

    return () => unsubscribe();
  }, [companyId]);

  // Calculations for KPI summaries across all sales in company
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalCollected = 0;
    let totalDue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;

    sales.forEach(sale => {
      const amount = getSaleAmount(sale);
      const paid = getSalePaidAmount(sale);
      const due = getSaleDueAmount(sale);
      const status = getSaleStatus(sale);

      totalSales += amount;
      totalCollected += paid;
      totalDue += due;

      if (status === 'Paid') paidCount++;
      else if (status === 'Partial') partialCount++;
      else unpaidCount++;
    });

    const totalBills = sales.length;
    const avgOrderValue = totalBills > 0 ? (totalSales / totalBills) : 0;

    return {
      totalSales,
      totalCollected,
      totalDue,
      totalBills,
      avgOrderValue,
      paidCount,
      unpaidCount,
      partialCount
    };
  }, [sales]);

  // Filtered sales based on Search, Status, and Date Range
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const invoiceNo = (sale.invoiceNumber || sale.invoiceNo || '').toLowerCase();
      const custName = (sale.customerName || '').toLowerCase();
      const custPhone = (sale.customerPhone || '').toLowerCase();
      const payMode = (sale.paymentMode || '').toLowerCase();

      const matchesSearch = !q || 
        invoiceNo.includes(q) || 
        custName.includes(q) || 
        custPhone.includes(q) ||
        payMode.includes(q);

      if (!matchesSearch) return false;

      // 2. Status Filter
      const status = getSaleStatus(sale);
      if (statusFilter === 'PAID' && status !== 'Paid') return false;
      if (statusFilter === 'UNPAID' && status !== 'Unpaid') return false;
      if (statusFilter === 'PARTIAL' && status !== 'Partial') return false;
      if (statusFilter === 'CREDIT' && sale.saleType !== 'Credit') return false;
      if (statusFilter === 'CASH' && sale.saleType !== 'Cash') return false;

      // 3. Date Range Filter
      const saleDate = parseItemDate(sale);
      if (!isWithinDateRange(saleDate, dateFilter, customStart, customEnd)) return false;

      return true;
    });
  }, [sales, searchTerm, statusFilter, dateFilter, customStart, customEnd]);

  const handlePreviewInvoice = (sale) => {
    setSelectedSale(sale);
    setShowPreviewModal(true);
  };

  const executeDownload = async (sale) => {
    const doc = await generateInvoicePDF(sale, businessInfo);
    if (doc) {
      doc.save(`${sale.invoiceNumber || sale.invoiceNo || 'invoice'}.pdf`);
      toast.success('Invoice downloading...');
    } else {
      toast.error('Failed to generate PDF');
    }
  };

  const shareViaWhatsApp = (sale) => {
    const invoiceNo = sale.invoiceNumber || sale.invoiceNo || 'INV';
    const amount = getSaleAmount(sale);
    const message = `Hello ${sale.customerName || 'Customer'}, your invoice ${invoiceNo} for ${formatCurrency(amount)} is ready. Thank you for your business!`;
    const url = `https://wa.me/${(sale.customerPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareViaEmail = (sale) => {
    const invoiceNo = sale.invoiceNumber || sale.invoiceNo || 'INV';
    const amount = getSaleAmount(sale);
    const dateStr = format(parseItemDate(sale), 'dd MMM yyyy');
    const subject = `Invoice ${invoiceNo} from ${businessInfo.name}`;
    const body = `Hello ${sale.customerName || 'Customer'},\n\nPlease find your invoice details below:\nInvoice #: ${invoiceNo}\nTotal: ${formatCurrency(amount)}\nDate: ${dateStr}\n\nThank you!`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const openQuickSettlement = (sale) => {
    const due = getSaleDueAmount(sale);
    setSettlementSale(sale);
    setSettlementAmount(due > 0 ? due.toString() : getSaleAmount(sale).toString());
    setSettlementMode('Cash');
  };

  const handleQuickReceivePayment = async (e) => {
    e.preventDefault();
    if (!settlementSale) return;
    const amt = parseFloat(settlementAmount) || 0;
    if (amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      setIsSettling(true);
      const batch = writeBatch(db);

      const billTotal = getSaleAmount(settlementSale);
      const prevPaid = getSalePaidAmount(settlementSale);
      const newPaid = prevPaid + amt;
      const newDue = Math.max(0, billTotal - newPaid);
      const newStatus = newDue <= 0.01 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');

      // 1. Update Sale Document
      const saleRef = doc(db, 'sales', settlementSale.id);
      batch.update(saleRef, {
        paymentStatus: newStatus,
        paymentMode: settlementMode,
        paidAmount: newPaid,
        creditAmount: newDue,
        cashAmount: newPaid,
        lastPaymentDate: new Date(),
        paidAt: new Date(),
        updatedAt: new Date()
      });

      // 2. Decrement Customer Credit Balance if customer ID / phone exists
      if (settlementSale.customerId) {
        const custRef = doc(db, 'customers', settlementSale.customerId);
        batch.update(custRef, {
          creditBalance: increment(-amt),
          lastPaymentDate: new Date(),
          updatedAt: new Date()
        });
      } else if (settlementSale.customerPhone) {
        const qCust = query(
          collection(db, 'customers'),
          where('phone', '==', settlementSale.customerPhone),
          where('companyId', '==', companyId)
        );
        const custSnap = await getDocs(qCust);
        if (!custSnap.empty) {
          batch.update(custSnap.docs[0].ref, {
            creditBalance: increment(-amt),
            lastPaymentDate: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // 3. Create a Payment Voucher (Receipt) doc for live bookkeeping audit trail
      const voucherRef = doc(collection(db, 'payment_vouchers'));
      const voucherNo = `REC-${Date.now().toString().slice(-6)}`;
      batch.set(voucherRef, {
        voucherType: 'payment_in',
        voucherNo,
        partyId: settlementSale.customerId || '',
        partyName: settlementSale.customerName || 'Customer',
        partyPhone: settlementSale.customerPhone || '',
        amount: amt,
        paymentMode: settlementMode,
        date: new Date().toISOString().split('T')[0],
        referenceNo: `Settlement for ${settlementSale.invoiceNumber || settlementSale.invoiceNo || 'Bill'}`,
        linkedInvoiceId: settlementSale.id,
        linkedInvoiceNo: settlementSale.invoiceNumber || settlementSale.invoiceNo || '',
        notes: `Quick settlement on Sales History`,
        companyId,
        createdAt: new Date(),
        recordedBy: user?.displayName || 'Cashier'
      });

      await batch.commit();
      toast.success(`Payment of ${formatCurrency(amt)} recorded. Invoice updated to ${newStatus}!`);
      setSettlementSale(null);
    } catch (error) {
      console.error("Error settling invoice:", error);
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setIsSettling(false);
    }
  };

  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      toast.error('No sales records to export');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Customer Name', 'Phone', 'Sale Type', 'Payment Mode', 'Payment Status', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Item Count'];
    const rows = filteredSales.map(s => [
      `"${s.invoiceNumber || s.invoiceNo || ''}"`,
      `"${format(parseItemDate(s), 'yyyy-MM-dd HH:mm')}"`,
      `"${(s.customerName || '').replace(/"/g, '""')}"`,
      `"${s.customerPhone || ''}"`,
      `"${s.saleType || 'Cash'}"`,
      `"${s.paymentMode || 'Cash'}"`,
      `"${getSaleStatus(s)}"`,
      getSaleAmount(s).toFixed(2),
      getSalePaidAmount(s).toFixed(2),
      getSaleDueAmount(s).toFixed(2),
      s.items?.length || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_History_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales history exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Sales History</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Track customer invoices, live payment collections, credit receivables, and instant settlements.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
            title="Export filtered records to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => navigate('/quotations/new')}
            className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200/80 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Quotation</span>
          </button>
          <button 
            onClick={() => navigate('/sales/new')}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Real-time Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {formatCurrency(metrics.totalSales)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.totalBills} bills)</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
            <span>Avg ticket: <strong className="text-slate-700 dark:text-zinc-300">{formatCurrency(metrics.avgOrderValue)}</strong></span>
          </div>
        </div>

        {/* Total Collected / Paid */}
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Received (Paid)</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalCollected)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600/80 dark:text-emerald-400/80 flex items-center gap-1">
            <span>{metrics.paidCount} Fully Paid • Real-time bank/cash sync</span>
          </div>
        </div>

        {/* Total Credit / Pending Due */}
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Credit Receivables</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-rose-600 dark:text-rose-400">
              {formatCurrency(metrics.totalDue)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-rose-600/80 dark:text-rose-400/80 flex items-center gap-1">
            <span>{metrics.unpaidCount} Unpaid • {metrics.partialCount} Partial Dues</span>
          </div>
        </div>

        {/* Quick Payment Action / Vouchers Route */}
        <div className="card p-4 bg-gradient-to-br from-primary-50 to-primary-100/40 dark:from-primary-950/30 dark:to-zinc-900 border border-primary-200/80 dark:border-primary-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">Payment Book</span>
            <ArrowDownLeft className="w-4 h-4 text-primary-600" />
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">
            Directly receive customer balances or register double-entry receipts.
          </p>
          <div className="mt-2 pt-2 border-t border-primary-200/50 dark:border-primary-800/50 flex items-center justify-between">
            <button
              onClick={() => navigate('/payments?type=payment_in')}
              className="text-xs font-bold text-primary-700 dark:text-primary-300 hover:underline flex items-center gap-1"
            >
              Open Payment In Vouchers →
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          {/* Search Field */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search invoice #, customer name, phone..."
              className="input-field pl-8 text-xs py-1.5"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills & Date Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="inline-flex p-0.5 bg-slate-200/70 dark:bg-zinc-800 rounded-lg text-xs font-semibold">
              {[
                { label: 'All', value: 'ALL' },
                { label: 'Paid', value: 'PAID' },
                { label: 'Unpaid', value: 'UNPAID' },
                { label: 'Partial', value: 'PARTIAL' },
                { label: 'Credit', value: 'CREDIT' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all text-[11px]",
                    statusFilter === tab.value
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm font-bold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date Range Dropdown */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 rounded-lg px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Inputs if Custom selected */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1 text-xs">
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input-field text-xs py-1 px-2"
                />
                <span className="text-slate-400">to</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input-field text-xs py-1 px-2"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sales Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Invoice Detail</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-center">Type</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Bill Amount</th>
                <th className="px-5 py-3.5 text-right">Paid / Due</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading real-time sales records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ShoppingCart className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No sales records found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search query or status/date filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const billTotal = getSaleAmount(sale);
                  const paidAmount = getSalePaidAmount(sale);
                  const dueAmount = getSaleDueAmount(sale);
                  const status = getSaleStatus(sale);
                  const saleDate = parseItemDate(sale);
                  const invoiceNumber = sale.invoiceNumber || sale.invoiceNo || 'INV-0000';

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Invoice Detail */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => handlePreviewInvoice(sale)}
                            className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-tight hover:text-primary-600 text-left font-mono"
                          >
                            {invoiceNumber}
                          </button>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                            {sale.items?.length || 0} {(sale.items?.length || 0) === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {sale.customerName || 'Walk-in Customer'}
                          </span>
                          {sale.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-mono">{sale.customerPhone}</span>
                          )}
                        </div>
                      </td>

                      {/* Mode / Type */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          sale.saleType === "Credit" 
                            ? "text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40" 
                            : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                        )}>
                          {sale.saleType || "Cash"}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                          status === "Paid" 
                            ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-none" 
                            : status === "Partial"
                            ? "bg-amber-500 text-white shadow-sm shadow-amber-200 dark:shadow-none"
                            : "bg-rose-500 text-white shadow-sm shadow-rose-200 dark:shadow-none"
                        )}>
                          {status === 'Paid' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {status === 'Partial' && <Clock className="w-2.5 h-2.5" />}
                          {status === 'Unpaid' && <AlertCircle className="w-2.5 h-2.5" />}
                          {status}
                        </span>
                      </td>

                      {/* Bill Total Amount */}
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-right font-display text-xs whitespace-nowrap">
                        {formatCurrency(billTotal)}
                      </td>

                      {/* Paid / Due Breakdown */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Rec: {formatCurrency(paidAmount)}
                          </span>
                          {dueAmount > 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              Due: {formatCurrency(dueAmount)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Settled</span>
                          )}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(saleDate, 'dd MMM yyyy, hh:mm a')}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {status !== 'Paid' && (
                            <button 
                              onClick={() => openQuickSettlement(sale)}
                              className="px-2 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all mr-1 whitespace-nowrap flex items-center gap-1"
                              title="Receive Payment & Settle Bill"
                            >
                              <ArrowDownLeft className="w-3 h-3" /> Pay
                            </button>
                          )}
                          <button 
                            onClick={() => handlePreviewInvoice(sale)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            title="Preview & Download"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => shareViaWhatsApp(sale)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => shareViaEmail(sale)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            title="Share via Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Receive Payment Modal */}
      {settlementSale && (
        <Modal
          isOpen={!!settlementSale}
          onClose={() => setSettlementSale(null)}
          title="Receive Customer Payment"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleQuickReceivePayment} className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700/60 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {settlementSale.invoiceNumber || settlementSale.invoiceNo}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {settlementSale.customerName || 'Customer'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Total Bill:</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">
                  {formatCurrency(getSaleAmount(settlementSale))}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-rose-600 font-bold">Outstanding Due:</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(getSaleDueAmount(settlementSale))}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Amount to Settle (₹) *
              </label>
              <input 
                type="number"
                step="0.01"
                required
                max={getSaleDueAmount(settlementSale) || getSaleAmount(settlementSale)}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                className="input-field text-base font-bold text-emerald-600"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Payment Mode
              </label>
              <select
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / QR">UPI / QR Code</option>
                <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlementSale(null)}
                className="btn-secondary flex-1 text-xs py-2"
                disabled={isSettling}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 text-xs py-2 bg-emerald-600 hover:bg-emerald-700"
                disabled={isSettling}
              >
                {isSettling ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invoice Preview Modal */}
      {showPreviewModal && selectedSale && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="Invoice Preview"
          maxWidth="max-w-4xl"
        >
          <div ref={invoicePreviewRef} className="bg-white rounded-2xl overflow-hidden">
            {/* Header with Background */}
            <div className="bg-slate-50 p-8 flex justify-between items-start border-b border-slate-100">
              <div className="flex items-start gap-4">
                {businessInfo.logoURL ? (
                  <img
                    src={businessInfo.logoURL}
                    alt="Logo"
                    className="w-16 h-16 object-contain rounded-lg"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="p-1.5 bg-primary-600 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-slate-900">
                    {businessInfo.name}
                  </h1>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none space-y-2">
                    <p className="max-w-[250px]">{businessInfo.address}</p>
                    <p>
                      GSTIN: {businessInfo.gstin} | Email: {businessInfo.email} | Phone: {businessInfo.phone}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
                  INVOICE
                </h2>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none space-y-2">
                  <p>
                    No:{" "}
                    <span className="text-slate-900 ml-2 uppercase font-mono">
                      {selectedSale.invoiceNumber || selectedSale.invoiceNo}
                    </span>
                  </p>
                  <p>
                    Date:{" "}
                    <span className="text-slate-900 ml-2">
                      {format(parseItemDate(selectedSale), "dd MMM yyyy")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-3">
                    Bill To
                  </p>
                  <h4 className="font-black text-slate-900 text-lg leading-none">
                    {selectedSale.customerName || "Walk-in Customer"}
                  </h4>
                  <p className="text-sm text-slate-500 font-medium">
                    {selectedSale.customerPhone}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                    {selectedSale.customerAddress || "No address provided"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Payment Info
                  </p>
                  <div className="inline-flex items-center justify-center h-6 px-4 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest gap-2">
                    <span>Mode: {selectedSale.saleType || 'Cash'}</span>
                    <span>•</span>
                    <span className={cn(
                      getSaleStatus(selectedSale) === 'Paid' ? 'text-emerald-600' : 'text-rose-600'
                    )}>
                      Status: {getSaleStatus(selectedSale)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-10 overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-4 text-left">Description</th>
                      <th className="px-4 py-4 text-center">Qty / Unit</th>
                      <th className="px-4 py-4 text-right">Price</th>
                      <th className="px-4 py-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(selectedSale.items || []).map((item, idx) => (
                      <tr key={idx} className="text-slate-900">
                        <td className="px-4 py-4 font-bold">
                          {item.name || "---"}
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {item.qty} {item.unit || 'pcs'}
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          {formatCurrency(item.price || 0)}
                        </td>
                        <td className="px-4 py-4 text-right font-black">
                          {formatCurrency(item.total || ((item.qty || 1) * (item.price || 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-end">
                <div className="w-full max-w-[280px] space-y-3">
                  {(() => {
                    const total = getSaleAmount(selectedSale);
                    const taxable = total / 1.18;
                    const gst = total - taxable;
                    const halfGst = gst / 2;
                    return (
                      <>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Taxable Amount</span>
                          <span className="text-slate-900">{formatCurrency(taxable)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>SGST (9%)</span>
                          <span className="text-slate-900">{formatCurrency(halfGst)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>CGST (9%)</span>
                          <span className="text-slate-900">{formatCurrency(halfGst)}</span>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline pr-2">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                            Grand Total
                          </span>
                          <span className="text-2xl font-black text-primary-600 font-display tracking-tight ml-4">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 mt-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</p>
                <div className="text-[10px] text-slate-500 font-medium leading-relaxed whitespace-pre-line">
                  {businessInfo.terms}
                </div>
              </div>

              <div id="saleslist-preview-actions" className="pt-10 flex gap-4">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    const actionsEl = document.getElementById('saleslist-preview-actions');
                    if (actionsEl) actionsEl.style.display = 'none';
                    const doc = await generateInvoiceFromHTML(invoicePreviewRef.current);
                    if (actionsEl) actionsEl.style.display = '';
                    if (doc) {
                      doc.save(`${selectedSale.invoiceNumber || selectedSale.invoiceNo || 'invoice'}.pdf`);
                      toast.success('PDF Downloaded!');
                    }
                  }}
                  className="flex-[2] px-8 py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SalesList;
