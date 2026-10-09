import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  where 
} from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Mail,
  MessageCircle,
  FileText,
  Plus,
  Package,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  X,
  RefreshCw
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

const getQuoteAmount = (q) => {
  if (!q) return 0;
  const val = q.grandTotal ?? q.total ?? q.totalAmount ?? q.amount ?? q.finalTotal ?? 0;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const QuotationList = () => {
  const { companyId } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const navigate = useNavigate();
  const quotationPreviewRef = useRef(null);

  const [businessInfo, setBusinessInfo] = useState({
    name: "My Business Name",
    address: "123 Business Street, City, State - 110001",
    gstin: "22AAAAA0000A1Z5",
    phone: "+91 98765 43210",
    email: "contact@business.com",
    logoURL: "",
    terms: "1. This is a quotation and not an invoice.\n2. Prices are valid for 7 days."
  });

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, 'quotations'), 
      where('companyId', '==', companyId)
    );
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const quotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        quotData.sort((a, b) => {
          const timeA = parseItemDate(a).getTime();
          const timeB = parseItemDate(b).getTime();
          return timeB - timeA;
        });
        setQuotations(quotData);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error fetching quotations:", error);
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
            terms: data.terms || "1. This is a quotation and not an invoice.\n2. Prices are valid for 7 days."
          });
        }
      } catch (error) {
        console.error("Error fetching business profile:", error);
      }
    };
    fetchBusinessProfile();

    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    let totalValue = 0;
    quotations.forEach(q => {
      totalValue += getQuoteAmount(q);
    });
    const totalCount = quotations.length;
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;
    return {
      totalValue,
      totalCount,
      avgValue
    };
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter(quotation => {
      const q = searchTerm.toLowerCase().trim();
      const quoteNo = (quotation.quotationNumber || '').toLowerCase();
      const custName = (quotation.customerName || '').toLowerCase();
      const custPhone = (quotation.customerPhone || '').toLowerCase();

      const matchesSearch = !q || quoteNo.includes(q) || custName.includes(q) || custPhone.includes(q);
      if (!matchesSearch) return false;

      const d = parseItemDate(quotation);
      const now = new Date();
      if (dateFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (d < weekAgo || d > now) return false;
      }
      if (dateFilter === 'month') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [quotations, searchTerm, dateFilter]);

  const handlePreviewQuotation = (quotation) => {
    setSelectedQuotation(quotation);
    setShowPreviewModal(true);
  };

  const shareViaWhatsApp = (quotation) => {
    const amount = getQuoteAmount(quotation);
    const message = `Hello ${quotation.customerName || 'Customer'}, your estimated quotation ${quotation.quotationNumber} for ${formatCurrency(amount)} is ready. Valid for 7 days. Thank you!`;
    const url = `https://wa.me/${(quotation.customerPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareViaEmail = (quotation) => {
    const amount = getQuoteAmount(quotation);
    const dateStr = format(parseItemDate(quotation), 'dd MMM yyyy');
    const subject = `Quotation ${quotation.quotationNumber} from ${businessInfo.name}`;
    const body = `Hello ${quotation.customerName || 'Customer'},\n\nPlease find your quotation details below:\nQuotation #: ${quotation.quotationNumber}\nEstimated Total: ${formatCurrency(amount)}\nDate: ${dateStr}\n\nThis is an estimated quote valid for 7 days.\n\nThank you!`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleConvertToSale = (quotation) => {
    navigate('/sales/new', {
      state: {
        convertedQuotation: quotation
      }
    });
  };

  const exportToCSV = () => {
    if (filteredQuotations.length === 0) {
      toast.error('No quotation records to export');
      return;
    }

    const headers = ['Quotation No', 'Date', 'Customer Name', 'Phone', 'Items Count', 'Estimated Total (INR)'];
    const rows = filteredQuotations.map(q => [
      `"${q.quotationNumber || ''}"`,
      `"${format(parseItemDate(q), 'yyyy-MM-dd HH:mm')}"`,
      `"${(q.customerName || '').replace(/"/g, '""')}"`,
      `"${q.customerPhone || ''}"`,
      q.items?.length || 0,
      getQuoteAmount(q).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Quotations_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Quotations exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Quotation History</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 animate-pulse" />
              Estimates & Bids
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Create, track, share estimated price quotes, and convert directly to GST Tax Invoices.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => navigate('/quotations/new')}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Pipeline Value</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {formatCurrency(metrics.totalValue)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Across all estimated price quotes</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quotations Issued</span>
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-primary-600 dark:text-primary-400">
              {metrics.totalCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Quotes generated</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Ready for 1-click invoice conversion</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Quote Size</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.avgValue)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Average estimated ticket value</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by customer or quote #..."
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

          <div className="flex items-center gap-2">
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
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Quote Detail</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-center">Items</th>
                <th className="px-5 py-3.5 text-right">Estimated Total</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading quotations...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No quotations found</p>
                      <p className="text-xs text-slate-400">Create a quotation to issue an estimated bid to your customer.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => {
                  const amount = getQuoteAmount(quotation);
                  const quoteDate = parseItemDate(quotation);

                  return (
                    <tr key={quotation.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <button 
                          onClick={() => handlePreviewQuotation(quotation)}
                          className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-tight hover:text-primary-600 text-left font-mono"
                        >
                          {quotation.quotationNumber}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {quotation.customerName || 'Walk-in Customer'}
                          </span>
                          {quotation.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-mono">{quotation.customerPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {quotation.items?.length || 0} Items
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-right font-display text-xs whitespace-nowrap">
                        {formatCurrency(amount)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(quoteDate, 'dd MMM yyyy, hh:mm a')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleConvertToSale(quotation)}
                            className="px-2 py-1 text-[10px] font-bold bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-lg shadow-sm transition-all mr-1 whitespace-nowrap flex items-center gap-1"
                            title="Convert Quotation to Invoice"
                          >
                            <ArrowRight className="w-3 h-3" /> Convert to Invoice
                          </button>
                          <button 
                            onClick={() => handlePreviewQuotation(quotation)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            title="Preview & Download"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => shareViaWhatsApp(quotation)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => shareViaEmail(quotation)}
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

      {/* Quotation Preview Modal */}
      {showPreviewModal && selectedQuotation && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="Quotation Preview"
          maxWidth="max-w-4xl"
        >
          <div ref={quotationPreviewRef} className="bg-white rounded-2xl overflow-hidden">
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
                  QUOTATION
                </h2>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none space-y-2">
                  <p>
                    No:{" "}
                    <span className="text-slate-900 ml-2 uppercase font-mono">
                      {selectedQuotation.quotationNumber}
                    </span>
                  </p>
                  <p>
                    Date:{" "}
                    <span className="text-slate-900 ml-2">
                      {format(parseItemDate(selectedQuotation), "dd MMM yyyy")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-3">
                    Quote To
                  </p>
                  <h4 className="font-black text-slate-900 text-lg leading-none">
                    {selectedQuotation.customerName || "Walk-in Customer"}
                  </h4>
                  <p className="text-sm text-slate-500 font-medium">
                    {selectedQuotation.customerPhone}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                    {selectedQuotation.customerAddress || "No address provided"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Status
                  </p>
                  <div className="inline-flex items-center justify-center h-6 px-4 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Estimated Quote (Valid 7 Days)
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
                    {(selectedQuotation.items || []).map((item, idx) => (
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
                    const total = getQuoteAmount(selectedQuotation);
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
                            Estimated Total
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

              <div id="quotationlist-preview-actions" className="pt-10 flex gap-4">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    const actionsEl = document.getElementById('quotationlist-preview-actions');
                    if (actionsEl) actionsEl.style.display = 'none';
                    const doc = await generateInvoiceFromHTML(quotationPreviewRef.current);
                    if (actionsEl) actionsEl.style.display = '';
                    if (doc) {
                      doc.save(`${selectedQuotation.quotationNumber}.pdf`);
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

export default QuotationList;
