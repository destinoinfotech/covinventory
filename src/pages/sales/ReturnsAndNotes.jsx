import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs 
} from '../../lib/supabase';
import { 
  RotateCcw, 
  Plus, 
  Search, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Package,
  FileSpreadsheet,
  X,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';

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

const ReturnsAndNotes = () => {
  const { companyId, userData } = useAuth();
  const [activeTab, setActiveTab] = useState('credit'); // 'credit' (Sales Returns) or 'debit' (Purchase Returns)
  const [notes, setNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State for Return / Note
  const [formData, setFormData] = useState({
    noteType: 'credit', // 'credit' or 'debit'
    noteNo: `CN-${Date.now().toString().slice(-6)}`,
    referenceInvoiceId: '',
    originalDocNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    partyPhone: '',
    partyGSTIN: '',
    reason: 'Damaged / Defective Goods',
    items: [{ productId: '', name: '', qty: 1, price: 0, total: 0 }],
    refundType: 'Credit to Account', // 'Credit to Account' or 'Cash Refund'
    totalAmount: 0
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Live listener for returns/notes
    const qNotes = query(collection(db, 'returns_notes'), where('companyId', '==', companyId));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = parseItemDate(a).getTime();
        const timeB = parseItemDate(b).getTime();
        return timeB - timeA;
      });
      setNotes(list);
      setLoading(false);
    });

    // 2. Fetch references for dropdown
    const fetchReferences = async () => {
      try {
        const [salesSnap, purSnap, prodSnap] = await Promise.all([
          getDocs(query(collection(db, 'sales'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'purchases'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)))
        ]);
        setInvoices(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPurchases(purSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching return references:', err);
      }
    };
    fetchReferences();

    return () => unsubNotes();
  }, [companyId]);

  const metrics = useMemo(() => {
    let creditTotal = 0;
    let debitTotal = 0;
    let creditCount = 0;
    let debitCount = 0;

    notes.forEach(n => {
      const amt = parseFloat(n.totalAmount || 0);
      if (n.noteType === 'debit') {
        debitTotal += amt;
        debitCount++;
      } else {
        creditTotal += amt;
        creditCount++;
      }
    });

    return {
      creditTotal,
      debitTotal,
      creditCount,
      debitCount,
      totalNotes: notes.length
    };
  }, [notes]);

  const handleSelectReferenceDoc = (docId) => {
    if (formData.noteType === 'credit') {
      const sale = invoices.find(s => s.id === docId);
      if (sale) {
        setFormData(prev => ({
          ...prev,
          referenceInvoiceId: docId,
          originalDocNo: sale.invoiceNumber || sale.invoiceNo || '',
          partyName: sale.customerName || '',
          partyPhone: sale.customerPhone || '',
          partyGSTIN: sale.customerGSTIN || '',
          items: (sale.items || []).map(i => ({
            productId: i.productId || i.id || '',
            name: i.name || '',
            qty: 1,
            maxQty: i.qty || i.quantity || 1,
            price: i.price || 0,
            total: i.price || 0
          }))
        }));
      }
    } else {
      const pur = purchases.find(p => p.id === docId);
      if (pur) {
        setFormData(prev => ({
          ...prev,
          referenceInvoiceId: docId,
          originalDocNo: pur.billNumber || pur.invoiceNo || pur.id?.slice(0, 6),
          partyName: pur.supplierName || '',
          partyPhone: pur.supplierPhone || '',
          partyGSTIN: pur.supplierGSTIN || '',
          items: (pur.items || []).map(i => ({
            productId: i.productId || i.id || '',
            name: i.name || '',
            qty: 1,
            maxQty: i.qty || i.quantity || 1,
            price: i.price || i.buyingPrice || 0,
            total: i.price || i.buyingPrice || 0
          }))
        }));
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'qty' || field === 'price') {
        items[index].total = (parseFloat(items[index].qty) || 0) * (parseFloat(items[index].price) || 0);
      }
      return { ...prev, items };
    });
  };

  const totalReturnAmount = formData.items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!formData.partyName) {
      toast.error('Please specify party name');
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].name) {
      toast.error('Please add at least one returned item');
      return;
    }

    try {
      setLoading(true);
      const noteDoc = {
        ...formData,
        companyId,
        totalAmount: totalReturnAmount,
        createdAt: new Date(),
        createdBy: userData?.name || 'Staff'
      };

      // 1. Save Return/Note record
      await addDoc(collection(db, 'returns_notes'), noteDoc);

      // 2. Adjust Product Inventory Stock:
      for (const item of formData.items) {
        if (item.productId) {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const currentStock = pSnap.data().stock || 0;
            const stockDelta = formData.noteType === 'credit' 
              ? (item.qty || 1) // Restock for sales return
              : -(item.qty || 1); // Deduct for purchase return

            await updateDoc(pRef, {
              stock: Math.max(0, currentStock + stockDelta),
              updatedAt: new Date()
            });
          }
        }
      }

      setShowCreateModal(false);
      toast.success(`${formData.noteType === 'credit' ? 'Credit Note' : 'Debit Note'} created successfully!`);
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to create note: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(n => {
    const matchesTab = (n.noteType || 'credit') === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      n.noteNo?.toLowerCase().includes(q) || 
      n.partyName?.toLowerCase().includes(q) || 
      n.originalDocNo?.toLowerCase().includes(q) ||
      n.reason?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const exportToCSV = () => {
    if (filteredNotes.length === 0) {
      toast.error('No note records to export');
      return;
    }

    const headers = ['Note No', 'Type', 'Date', 'Original Ref', 'Party Name', 'Reason', 'Refund Method', 'Amount (INR)'];
    const rows = filteredNotes.map(n => [
      `"${n.noteNo || ''}"`,
      `"${n.noteType === 'credit' ? 'Credit Note (Sales Return)' : 'Debit Note (Purchase Return)'}"`,
      `"${format(parseItemDate(n), 'yyyy-MM-dd')}"`,
      `"${n.originalDocNo || ''}"`,
      `"${(n.partyName || '').replace(/"/g, '""')}"`,
      `"${n.reason || ''}"`,
      `"${n.refundType || ''}"`,
      (parseFloat(n.totalAmount) || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Returns_${activeTab}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Returns data exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Credit & Debit Notes</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Issue Credit Notes for Sales Returns (auto-restock) and Debit Notes for Purchase Returns (reverse liability).
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
            onClick={() => {
              setFormData({
                noteType: activeTab,
                noteNo: `${activeTab === 'credit' ? 'CN' : 'DN'}-${Date.now().toString().slice(-6)}`,
                referenceInvoiceId: '',
                originalDocNo: '',
                date: new Date().toISOString().split('T')[0],
                partyName: '',
                partyPhone: '',
                partyGSTIN: '',
                reason: 'Damaged / Defective Goods',
                items: [{ productId: '', name: '', qty: 1, price: 0, total: 0 }],
                refundType: 'Credit to Account',
                totalAmount: 0
              });
              setShowCreateModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New {activeTab === 'credit' ? 'Credit Note' : 'Debit Note'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Credit Notes (Sales Return)</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.creditTotal)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.creditCount} notes)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Returned goods restocked to inventory</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Debit Notes (Purchase Return)</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-rose-600 dark:text-rose-400">
              {formatCurrency(metrics.debitTotal)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.debitCount} notes)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Supplier liability reversed</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Return Notes</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {metrics.totalNotes}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Total records</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Both Credit & Debit vouchers</p>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab === 'credit' ? 'Credit Note' : 'Debit Note'}, Party, Original Ref...`}
              className="input-field pl-8 text-xs py-1.5"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex p-0.5 bg-slate-200/70 dark:bg-zinc-800 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('credit')}
              className={cn(
                "px-3 py-1 rounded-md transition-all text-[11px] flex items-center gap-1.5",
                activeTab === 'credit'
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              )}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
              Credit Notes (Sales Returns)
            </button>
            <button
              onClick={() => setActiveTab('debit')}
              className={cn(
                "px-3 py-1 rounded-md transition-all text-[11px] flex items-center gap-1.5",
                activeTab === 'debit'
                  ? "bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-400 shadow-sm font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              )}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
              Debit Notes (Purchase Returns)
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Note No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Original Ref</th>
                <th className="px-5 py-3.5">Party Name</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Refund Method</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading return vouchers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <RotateCcw className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">
                        No {activeTab === 'credit' ? 'Credit Notes' : 'Debit Notes'} recorded
                      </p>
                      <p className="text-xs text-slate-400">Record returns to automatically update inventory and financial balance.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNotes.map((n) => {
                  const nDate = parseItemDate(n);
                  return (
                    <tr key={n.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-primary-600 dark:text-primary-400 text-xs">
                        {n.noteNo}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(nDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-zinc-300">
                        {n.originalDocNo || '---'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {n.partyName}
                          </span>
                          {n.partyPhone && (
                            <span className="text-[10px] text-slate-400 font-mono">{n.partyPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-zinc-300">
                        {n.reason}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-full font-bold text-[10px]">
                          {n.refundType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                        {formatCurrency(n.totalAmount || 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Note Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={`New ${formData.noteType === 'credit' ? 'Credit Note (Sales Return)' : 'Debit Note (Purchase Return)'}`}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateNote} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Note Number *</label>
                <input
                  type="text"
                  required
                  value={formData.noteNo}
                  onChange={(e) => setFormData({...formData, noteNo: e.target.value})}
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Select {formData.noteType === 'credit' ? 'Sales Invoice' : 'Purchase Bill'}
                </label>
                <select
                  value={formData.referenceInvoiceId}
                  onChange={(e) => handleSelectReferenceDoc(e.target.value)}
                  className="input-field text-xs font-semibold"
                >
                  <option value="">Choose original bill...</option>
                  {formData.noteType === 'credit' 
                    ? invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber || inv.invoiceNo} - {inv.customerName} ({formatCurrency(inv.grandTotal || inv.total || 0)})
                        </option>
                      ))
                    : purchases.map(pur => (
                        <option key={pur.id} value={pur.id}>
                          {pur.billNumber || pur.invoiceNo || pur.id?.slice(0, 6)} - {pur.supplierName} ({formatCurrency(pur.grandTotal || pur.amount || 0)})
                        </option>
                      ))
                  }
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Party / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.partyName}
                  onChange={(e) => setFormData({...formData, partyName: e.target.value})}
                  className="input-field text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Reason for Return</label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="input-field text-xs"
                >
                  <option value="Damaged / Defective Goods">Damaged / Defective Goods</option>
                  <option value="Wrong Item Dispatched">Wrong Item Dispatched</option>
                  <option value="Customer Cancellation">Customer Cancellation</option>
                  <option value="Quality Not Satisfactory">Quality Not Satisfactory</option>
                  <option value="Excess Quantity Returned">Excess Quantity Returned</option>
                </select>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <label className="text-xs font-bold uppercase text-slate-500 block">
                Returned Goods (Will automatically adjust product stock level)
              </label>
              {formData.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Product Name"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    className="input-field flex-1 text-xs font-medium"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Return Qty"
                    value={item.qty}
                    onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                    className="input-field w-24 text-xs text-center font-bold"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={item.price}
                    onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="input-field w-28 text-xs text-right font-bold"
                  />
                  <div className="w-24 text-right text-xs font-black text-slate-800 dark:text-white tabular-nums">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Settlement Method</label>
                <select
                  value={formData.refundType}
                  onChange={(e) => setFormData({...formData, refundType: e.target.value})}
                  className="input-field text-xs"
                >
                  <option value="Credit to Account">Credit to Party Ledger Balance</option>
                  <option value="Cash Refund">Cash / Bank Refund Out</option>
                </select>
              </div>
              <div className="text-right flex flex-col justify-center">
                <span className="text-[11px] text-slate-400">Total Return Value</span>
                <span className="text-lg font-black text-primary-600 dark:text-primary-400 font-display">
                  {formatCurrency(totalReturnAmount)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Save {formData.noteType === 'credit' ? 'Credit Note' : 'Debit Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ReturnsAndNotes;
