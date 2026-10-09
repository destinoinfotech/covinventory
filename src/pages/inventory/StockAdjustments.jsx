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
  ArrowRightLeft, 
  Plus, 
  Search, 
  AlertOctagon, 
  CheckCircle2, 
  History,
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

const StockAdjustments = () => {
  const { companyId, userData } = useAuth();
  const [adjustments, setAdjustments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    type: 'Decrease', // 'Increase' or 'Decrease'
    adjustmentQty: 1,
    reason: 'Damaged / Broken Goods',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    currentStock: 0
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Fetch products
    const fetchProducts = async () => {
      try {
        const prodSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching products for adjustments:', err);
      }
    };
    fetchProducts();

    // 2. Live listener for adjustments
    const q = query(
      collection(db, 'stock_adjustments'),
      where('companyId', '==', companyId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const timeA = parseItemDate(a).getTime();
          const timeB = parseItemDate(b).getTime();
          return timeB - timeA;
        });
        setAdjustments(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching adjustments:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    let totalAdded = 0;
    let totalReduced = 0;
    let increaseCount = 0;
    let decreaseCount = 0;

    adjustments.forEach(a => {
      const qty = parseInt(a.adjustmentQty || 0);
      if (a.type === 'Increase') {
        totalAdded += qty;
        increaseCount++;
      } else {
        totalReduced += qty;
        decreaseCount++;
      }
    });

    return {
      total: adjustments.length,
      totalAdded,
      totalReduced,
      increaseCount,
      decreaseCount
    };
  }, [adjustments]);

  const handleProductSelect = (pId) => {
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setFormData(prev => ({
        ...prev,
        productId: pId,
        productName: prod.name,
        currentStock: prod.stock || 0
      }));
    }
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!formData.productId) {
      toast.error('Please select a product');
      return;
    }
    const qty = parseInt(formData.adjustmentQty) || 0;
    if (qty <= 0) {
      toast.error('Adjustment quantity must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      const prodRef = doc(db, 'products', formData.productId);
      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) {
        toast.error('Product not found');
        return;
      }

      const curStock = prodSnap.data().stock || 0;
      const stockDelta = formData.type === 'Increase' ? qty : -qty;
      const newStock = Math.max(0, curStock + stockDelta);

      // 1. Update Product Stock
      await updateDoc(prodRef, {
        stock: newStock,
        updatedAt: new Date()
      });

      // 2. Add Adjustment Record
      const adjRecord = {
        ...formData,
        companyId,
        stockBefore: curStock,
        stockAfter: newStock,
        createdAt: new Date(),
        adjustedBy: userData?.name || 'Staff'
      };

      await addDoc(collection(db, 'stock_adjustments'), adjRecord);
      
      // Update local product list
      setProducts(prev => prev.map(p => p.id === formData.productId ? { ...p, stock: newStock } : p));
      
      setShowModal(false);
      toast.success(`Stock adjusted! New stock: ${newStock}`);
    } catch (err) {
      console.error('Error saving adjustment:', err);
      toast.error('Failed to save adjustment');
    } finally {
      setLoading(false);
    }
  };

  const filtered = adjustments.filter(a => {
    if (typeFilter === 'INCREASE' && a.type !== 'Increase') return false;
    if (typeFilter === 'DECREASE' && a.type !== 'Decrease') return false;

    const q = searchQuery.toLowerCase().trim();
    return !q || 
      a.productName?.toLowerCase().includes(q) || 
      a.reason?.toLowerCase().includes(q) || 
      a.adjustedBy?.toLowerCase().includes(q);
  });

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast.error('No adjustment records to export');
      return;
    }

    const headers = ['Date', 'Product Name', 'Adjustment Type', 'Reason', 'Qty Changed', 'Stock Before', 'Stock After', 'Adjusted By'];
    const rows = filtered.map(a => [
      `"${format(parseItemDate(a), 'yyyy-MM-dd')}"`,
      `"${(a.productName || '').replace(/"/g, '""')}"`,
      `"${a.type || 'Decrease'}"`,
      `"${a.reason || ''}"`,
      a.type === 'Increase' ? `+${a.adjustmentQty}` : `-${a.adjustmentQty}`,
      a.stockBefore || 0,
      a.stockAfter || 0,
      `"${a.adjustedBy || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Adjustments_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Stock adjustments exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Stock Adjustments & Waste Logging</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Log inventory audits, damaged stock, expired goods, theft/loss, and manual physical stock updates.
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
                productId: '',
                productName: '',
                type: 'Decrease',
                adjustmentQty: 1,
                reason: 'Damaged / Broken Goods',
                date: new Date().toISOString().split('T')[0],
                notes: '',
                currentStock: 0
              });
              setShowModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Adjustment</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Stock Added (+)</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              +{metrics.totalAdded}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">units ({metrics.increaseCount} entries)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Audit surpluses / sample additions</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Stock Reduced (-)</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-rose-600 dark:text-rose-400">
              -{metrics.totalReduced}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">units ({metrics.decreaseCount} entries)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Damaged / expired / theft losses</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Audit Logs</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Adjustments</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Complete variance audit trail</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search product, reason, adjusted by..."
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
            {[
              { label: 'All', value: 'ALL' },
              { label: '+ Added', value: 'INCREASE' },
              { label: '- Reduced', value: 'DECREASE' }
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={cn(
                  "px-3 py-1 rounded-md transition-all text-[11px]",
                  typeFilter === tab.value
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Action Type</th>
                <th className="px-5 py-3.5">Reason for Variance</th>
                <th className="px-5 py-3.5 text-center">Qty Changed</th>
                <th className="px-5 py-3.5">Stock Level (Before → After)</th>
                <th className="px-5 py-3.5 text-right">Adjusted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading stock adjustments...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <History className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No stock adjustments logged</p>
                      <p className="text-xs text-slate-400">Manual stock corrections, damages, and audit adjustments will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((adj) => {
                  const adjDate = parseItemDate(adj);
                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(adjDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-xs">
                        {adj.productName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                          adj.type === 'Increase'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        )}>
                          {adj.type === 'Increase' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {adj.type === 'Increase' ? '+ Stock Added' : '- Stock Reduced'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                        {adj.reason}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-center text-xs tabular-nums">
                        <span className={adj.type === 'Increase' ? 'text-emerald-600' : 'text-rose-600'}>
                          {adj.type === 'Increase' ? `+${adj.adjustmentQty}` : `-${adj.adjustmentQty}`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                        {adj.stockBefore} → <strong className="text-slate-900 dark:text-white">{adj.stockAfter}</strong>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-500 dark:text-zinc-400">
                        {adj.adjustedBy || 'Staff'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Record Stock Adjustment"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Select Product *</label>
              <select
                required
                value={formData.productId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="">Choose item...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock} {p.unit || 'pcs'})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Action Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="input-field text-xs font-bold"
                >
                  <option value="Decrease">Decrease Stock (-)</option>
                  <option value="Increase">Increase Stock (+)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.adjustmentQty}
                  onChange={(e) => setFormData({...formData, adjustmentQty: parseInt(e.target.value) || 1})}
                  className="input-field text-xs font-bold text-center"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Reason for Variance</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="input-field text-xs"
              >
                <option value="Damaged / Broken Goods">Damaged / Broken Goods</option>
                <option value="Expired / Past Expiry Date">Expired / Past Expiry Date</option>
                <option value="Theft / Lost / Missing">Theft / Lost / Missing</option>
                <option value="Physical Count Audit Variance">Physical Count Audit Variance</option>
                <option value="Internal Office / Store Consumption">Internal Office / Store Consumption</option>
                <option value="Supplier Free Sample Received">Supplier Free Sample Received</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Adjustment Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="input-field text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Save Adjustment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default StockAdjustments;
