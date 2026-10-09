import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  increment,
  writeBatch,
  where,
  getDocs
} from '../../lib/supabase';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Trash2, 
  Truck, 
  Loader2,
  Calendar,
  Package,
  FileSpreadsheet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  X,
  RefreshCw,
  Building2
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
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

const getPurchaseAmount = (p) => {
  if (!p) return 0;
  if (p.total != null && !isNaN(parseFloat(p.total))) return parseFloat(p.total);
  if (p.grandTotal != null && !isNaN(parseFloat(p.grandTotal))) return parseFloat(p.grandTotal);
  if (p.buyingPrice != null && p.qty != null) {
    return (parseFloat(p.buyingPrice) || 0) * (parseFloat(p.qty) || 0);
  }
  return 0;
};

const PurchaseList = () => {
  const { companyId } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, 'purchases'), 
      where('companyId', '==', companyId)
    );
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const purchaseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseData.sort((a, b) => {
          const timeA = parseItemDate(a).getTime();
          const timeB = parseItemDate(b).getTime();
          return timeB - timeA;
        });
        setPurchases(purchaseData);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error in PurchaseList:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    let totalPurchases = 0;
    let totalQty = 0;
    const suppliersSet = new Set();

    purchases.forEach(p => {
      totalPurchases += getPurchaseAmount(p);
      totalQty += (parseInt(p.qty) || 1);
      if (p.supplierName) suppliersSet.add(p.supplierName.toLowerCase());
    });

    const totalBills = purchases.length;
    const avgOrderValue = totalBills > 0 ? (totalPurchases / totalBills) : 0;

    return {
      totalPurchases,
      totalQty,
      supplierCount: suppliersSet.size,
      totalBills,
      avgOrderValue
    };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const prodName = (p.productName || '').toLowerCase();
      const suppName = (p.supplierName || '').toLowerCase();
      const billNo = (p.billNumber || p.invoiceNo || '').toLowerCase();

      const matchesSearch = !q || prodName.includes(q) || suppName.includes(q) || billNo.includes(q);
      if (!matchesSearch) return false;

      const d = parseItemDate(p);
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
  }, [purchases, searchTerm, dateFilter]);

  const exportToCSV = () => {
    if (filteredPurchases.length === 0) {
      toast.error('No purchase records to export');
      return;
    }

    const headers = ['Date', 'Bill No', 'Product Name', 'Supplier Name', 'Quantity', 'Buying Price (INR)', 'Total (INR)'];
    const rows = filteredPurchases.map(p => [
      `"${format(parseItemDate(p), 'yyyy-MM-dd')}"`,
      `"${p.billNumber || p.invoiceNo || ''}"`,
      `"${(p.productName || '').replace(/"/g, '""')}"`,
      `"${(p.supplierName || '').replace(/"/g, '""')}"`,
      p.qty || 1,
      (parseFloat(p.buyingPrice) || 0).toFixed(2),
      getPurchaseAmount(p).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchases_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Purchases exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Purchase History</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage procurement bills, supplier liabilities, incoming stock restocks, and payout settlements.
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
            onClick={() => setShowAddModal(true)}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Purchases</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {formatCurrency(metrics.totalPurchases)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.totalBills} bills)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total inventory procurement expense</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Units Procured</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {metrics.totalQty}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Items added</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Stock automatically added to inventory</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Suppliers</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              {metrics.supplierCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Vendors</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Vendor balances tracked in CRM</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Purchase Order</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-purple-600 dark:text-purple-400">
              {formatCurrency(metrics.avgOrderValue)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Average bill procurement value</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by product, supplier name..."
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Supplier / Vendor</th>
                <th className="px-5 py-3.5 text-center">Qty</th>
                <th className="px-5 py-3.5 text-right">Buying Rate</th>
                <th className="px-5 py-3.5 text-right">Total Amount</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading purchase records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Truck className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No purchase records found</p>
                      <p className="text-xs text-slate-400">Record incoming purchases from wholesale suppliers to increase inventory stock.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  const pDate = parseItemDate(p);
                  const total = getPurchaseAmount(p);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-xs">
                        {p.productName}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                        {p.supplierName}
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs font-bold tabular-nums">
                        {p.qty} {p.unit || 'pcs'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                        {formatCurrency(p.buyingPrice || 0)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-right font-display text-xs whitespace-nowrap">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(pDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            navigate(`/payments?type=payment_out&partyId=${p.supplierId || ''}&partyName=${encodeURIComponent(p.supplierName || '')}&amount=${total}`);
                          }}
                          className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1 shadow-sm transition-all"
                          title="Record Payment Out to Supplier"
                        >
                          <ArrowUpRight className="w-3 h-3" /> Pay Vendor
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        title="Record New Purchase"
        maxWidth="max-w-2xl"
      >
        <PurchaseEntry onSuccess={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
};

// Internal component for the purchase entry form
const PurchaseEntry = ({ onSuccess }) => {
  const { user, companyId } = useAuth();
  const supplierRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (supplierRef.current && !supplierRef.current.contains(event.target)) {
        setSearching(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    supplierId: '',
    supplierName: '',
    qty: 1,
    buyingPrice: 0,
    unit: 'pcs'
  });

  useEffect(() => {
    const fetchDropdowns = async () => {
      if (!companyId) return;

      const qProd = query(collection(db, 'products'), where('companyId', '==', companyId));
      const prodSnap = await getDocs(qProd);
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const qSupp = query(collection(db, 'suppliers'), where('companyId', '==', companyId));
      const suppSnap = await getDocs(qSupp);
      setSuppliers(suppSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchDropdowns();
  }, [companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productId || !formData.supplierName) {
      toast.error('Please select product and enter supplier');
      return;
    }

    setLoading(true);
    try {
      const selectedProd = products.find(p => p.id === formData.productId);
      const batch = writeBatch(db);
      
      const purchaseData = {
        ...formData,
        unit: selectedProd?.unit || 'pcs',
        productName: selectedProd?.name || '',
        total: (parseFloat(formData.buyingPrice) || 0) * (parseFloat(formData.qty) || 0),
        date: new Date(),
        createdBy: user.uid,
        companyId
      };

      // 1. Record Purchase
      const purchaseRef = doc(collection(db, 'purchases'));
      batch.set(purchaseRef, purchaseData);
      
      // 2. Update Stock
      const productRef = doc(db, 'products', formData.productId);
      batch.update(productRef, {
        stock: increment(formData.qty)
      });

      // 3. Supplier Management
      if (formData.supplierName) {
        const existingSupp = suppliers.find(s => s.name.toLowerCase() === formData.supplierName.toLowerCase());
        
        if (!existingSupp) {
          const newSuppRef = doc(collection(db, 'suppliers'));
          batch.set(newSuppRef, {
            name: formData.supplierName,
            companyId,
            createdAt: new Date(),
            totalPurchases: formData.buyingPrice * formData.qty,
            lastPurchase: new Date()
          });
        } else {
          batch.update(doc(db, 'suppliers', existingSupp.id), {
            totalPurchases: increment(formData.buyingPrice * formData.qty),
            lastPurchase: new Date()
          });
        }
      }

      await batch.commit();
      toast.success('Purchase recorded and inventory stock incremented!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to record purchase: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Select Product *</label>
        <select 
          required
          className="input-field text-xs font-semibold"
          value={formData.productId}
          onChange={(e) => {
            const p = products.find(item => item.id === e.target.value);
            setFormData({
              ...formData, 
              productId: e.target.value,
              productName: p?.name || '',
              buyingPrice: p?.buyingPrice || formData.buyingPrice,
              unit: p?.unit || 'pcs'
            });
          }}
        >
          <option value="">Choose a product from inventory</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock})</option>)}
        </select>
      </div>

      <div className="relative" ref={supplierRef}>
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Supplier / Vendor Name *</label>
        <input 
          type="text" 
          required 
          className="input-field text-xs font-semibold" 
          placeholder="e.g. ABC Wholesalers"
          value={formData.supplierName}
          onChange={(e) => {
            setFormData({...formData, supplierName: e.target.value});
            setSearching(e.target.value.length > 0);
          }}
          onFocus={() => formData.supplierName && setSearching(true)}
        />
        {searching && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[100] max-h-48 overflow-y-auto">
            <div className="p-1 space-y-0.5">
              {suppliers
                .filter(s => s.name?.toLowerCase().includes(formData.supplierName.toLowerCase()))
                .map(supp => (
                  <button
                    key={supp.id}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-all text-left"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        supplierName: supp.name,
                        supplierId: supp.id
                      });
                      setSearching(false);
                    }}
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{supp.name}</span>
                      <span className="text-[10px] text-slate-400 block">{supp.phone || 'Supplier'}</span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-primary-600" />
                  </button>
                ))}
              {suppliers.filter(s => s.name?.toLowerCase().includes(formData.supplierName.toLowerCase())).length === 0 && (
                <div className="p-3 text-center text-xs text-slate-400">
                  Add "{formData.supplierName}" as new supplier
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Quantity *</label>
          <input 
            type="number" 
            min="1"
            required 
            className="input-field text-xs font-bold text-center"
            value={formData.qty}
            onChange={(e) => setFormData({...formData, qty: parseInt(e.target.value) || 1})}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Buying Price / Unit (₹) *</label>
          <input 
            type="number" 
            step="0.01"
            min="0"
            required 
            className="input-field text-xs font-bold text-right text-emerald-600"
            value={formData.buyingPrice}
            onChange={(e) => setFormData({...formData, buyingPrice: parseFloat(e.target.value) || 0})}
          />
        </div>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-700 flex justify-between items-center text-xs">
        <span className="font-bold text-slate-500">Total Purchase Value:</span>
        <span className="text-base font-black text-slate-900 dark:text-white font-display">
          {formatCurrency((formData.qty || 1) * (formData.buyingPrice || 0))}
        </span>
      </div>

      <div className="pt-2 flex gap-2 border-t border-slate-100 dark:border-zinc-800">
        <button 
          type="button" 
          onClick={onSuccess}
          className="btn-secondary flex-1 text-xs py-2"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Purchase & Restock'}
        </button>
      </div>
    </form>
  );
};

export default PurchaseList;
