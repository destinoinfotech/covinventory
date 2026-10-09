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
  getDocs 
} from '../../lib/supabase';
import { 
  Warehouse, 
  Plus, 
  ArrowRight, 
  ArrowRightLeft, 
  Search, 
  MapPin, 
  Package, 
  History,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
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

const GodownManagement = () => {
  const { companyId, userData } = useAuth();
  const [godowns, setGodowns] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGodownModal, setShowGodownModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Godown Form
  const [godownForm, setGodownForm] = useState({
    name: '',
    location: '',
    managerName: '',
    contactPhone: '',
    notes: ''
  });

  // Transfer Voucher Form
  const [transferForm, setTransferForm] = useState({
    transferNo: `TR-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    sourceGodownId: 'main',
    sourceGodownName: 'Main Store / Floor',
    destGodownId: '',
    destGodownName: '',
    productId: '',
    productName: '',
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Fetch products
    const fetchProducts = async () => {
      try {
        const pSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching products for godowns:', err);
      }
    };
    fetchProducts();

    // 2. Live listener for Godowns
    const qGodowns = query(collection(db, 'godowns'), where('companyId', '==', companyId));
    const unsubGodowns = onSnapshot(qGodowns, (snap) => {
      setGodowns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Live listener for Transfers
    const qTransfers = query(collection(db, 'godown_transfers'), where('companyId', '==', companyId));
    const unsubTransfers = onSnapshot(qTransfers, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = parseItemDate(a).getTime();
        const timeB = parseItemDate(b).getTime();
        return timeB - timeA;
      });
      setTransfers(list);
      setLoading(false);
    });

    return () => {
      unsubGodowns();
      unsubTransfers();
    };
  }, [companyId]);

  const handleCreateGodown = async (e) => {
    e.preventDefault();
    if (!godownForm.name) {
      toast.error('Please enter godown name');
      return;
    }

    try {
      setLoading(true);
      const newGodown = {
        ...godownForm,
        companyId,
        createdAt: new Date()
      };
      await addDoc(collection(db, 'godowns'), newGodown);
      setShowGodownModal(false);
      toast.success('Godown created successfully!');
    } catch (err) {
      toast.error('Failed to add godown');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.productId) {
      toast.error('Please select product');
      return;
    }
    if (!transferForm.destGodownId) {
      toast.error('Please select destination godown');
      return;
    }
    if (transferForm.sourceGodownId === transferForm.destGodownId) {
      toast.error('Source and Destination godowns must be different');
      return;
    }

    try {
      setLoading(true);
      const transferRecord = {
        ...transferForm,
        companyId,
        status: 'Completed',
        transferredBy: userData?.name || 'Warehouse Staff',
        createdAt: new Date()
      };

      await addDoc(collection(db, 'godown_transfers'), transferRecord);
      setShowTransferModal(false);
      toast.success('Stock transfer voucher generated and logged!');
    } catch (err) {
      toast.error('Failed to process transfer');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransfers = transfers.filter(tr => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      tr.transferNo?.toLowerCase().includes(q) || 
      tr.productName?.toLowerCase().includes(q) ||
      tr.sourceGodownName?.toLowerCase().includes(q) ||
      tr.destGodownName?.toLowerCase().includes(q) ||
      tr.transferredBy?.toLowerCase().includes(q);
  });

  const exportToCSV = () => {
    if (filteredTransfers.length === 0) {
      toast.error('No transfer records to export');
      return;
    }

    const headers = ['Transfer No', 'Date', 'Source Godown', 'Destination Godown', 'Product Name', 'Quantity', 'Transferred By'];
    const rows = filteredTransfers.map(tr => [
      `"${tr.transferNo || ''}"`,
      `"${format(parseItemDate(tr), 'yyyy-MM-dd')}"`,
      `"${tr.sourceGodownName || ''}"`,
      `"${tr.destGodownName || ''}"`,
      `"${(tr.productName || '').replace(/"/g, '""')}"`,
      tr.quantity || 1,
      `"${tr.transferredBy || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Transfers_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transfer log exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Multi-Godown & Branch Warehouses</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage physical warehouses, storage godowns, and inter-branch stock transfer vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setTransferForm({
                transferNo: `TR-${Date.now().toString().slice(-6)}`,
                date: new Date().toISOString().split('T')[0],
                sourceGodownId: 'main',
                sourceGodownName: 'Main Store / Floor',
                destGodownId: '',
                destGodownName: '',
                productId: '',
                productName: '',
                quantity: 1,
                notes: ''
              });
              setShowTransferModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Stock</span>
          </button>
          <button
            onClick={() => {
              setGodownForm({ name: '', location: '', managerName: '', contactPhone: '', notes: '' });
              setShowGodownModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Godown</span>
          </button>
        </div>
      </div>

      {/* KPI Cards / Godowns Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Storage Godowns</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {godowns.length + 1}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Locations</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Main Store + {godowns.length} Godowns</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Catalog Items</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {products.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">SKUs</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Available for warehouse allocation</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inter-Branch Transfers</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              {transfers.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Vouchers</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Logged inter-godown movements</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Primary Location</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
              Main Store / Floor
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Default POS & Billing Counter</p>
        </div>
      </div>

      {/* Godowns Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 text-[10px] font-bold uppercase rounded-full">
              Primary Location
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Main Store / Shop Floor</h3>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5" /> Primary Retail & Billing Location
          </p>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-between text-xs font-bold text-slate-500">
            <span>Allocated Items:</span>
            <span className="text-slate-900 dark:text-white">{products.length} Products</span>
          </div>
        </div>

        {godowns.map(g => (
          <div key={g.id} className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                <Warehouse className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {g.managerName ? `Mgr: ${g.managerName}` : 'Branch Storage'}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{g.name}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {g.location || 'Warehouse Location'}
            </p>
            {g.contactPhone && (
              <p className="text-[10px] text-slate-400 mt-1">Ph: {g.contactPhone}</p>
            )}
          </div>
        ))}
      </div>

      {/* Inter-Godown Stock Transfer Vouchers Table */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search transfer #, product, godowns..."
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

          <button 
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 font-medium text-xs py-1.5 px-3 rounded-lg transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Transfer Voucher</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Transfer Route (From → To)</th>
                <th className="px-5 py-3.5">Product Transferred</th>
                <th className="px-5 py-3.5 text-center">Quantity</th>
                <th className="px-5 py-3.5 text-right">Transferred By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading transfer logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <History className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No stock transfers recorded yet</p>
                      <p className="text-xs text-slate-400">Transfer inventory items between warehouses to keep stock synced.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((tr) => {
                  const trDate = parseItemDate(tr);
                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        {tr.transferNo}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(trDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {tr.sourceGodownName} <span className="text-slate-400 mx-1">→</span> {tr.destGodownName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 text-xs">
                        {tr.productName}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-center text-xs tabular-nums">
                        {tr.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-500 dark:text-zinc-400">
                        {tr.transferredBy}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Godown Modal */}
      {showGodownModal && (
        <Modal
          isOpen={showGodownModal}
          onClose={() => setShowGodownModal(false)}
          title="Add New Warehouse / Godown"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateGodown} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Godown / Branch Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. North Warehouse or Branch 2"
                value={godownForm.name}
                onChange={(e) => setGodownForm({...godownForm, name: e.target.value})}
                className="input-field text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Physical Location / Address</label>
              <input
                type="text"
                placeholder="Street / Industrial Area / City"
                value={godownForm.location}
                onChange={(e) => setGodownForm({...godownForm, location: e.target.value})}
                className="input-field text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Manager / In-charge</label>
                <input
                  type="text"
                  placeholder="Staff Name"
                  value={godownForm.managerName}
                  onChange={(e) => setGodownForm({...godownForm, managerName: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={godownForm.contactPhone}
                  onChange={(e) => setGodownForm({...godownForm, contactPhone: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowGodownModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Save Godown
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <Modal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          title="Inter-Godown Stock Transfer Voucher"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateTransfer} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer No</label>
                <input
                  type="text"
                  required
                  value={transferForm.transferNo}
                  onChange={(e) => setTransferForm({...transferForm, transferNo: e.target.value})}
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={transferForm.date}
                  onChange={(e) => setTransferForm({...transferForm, date: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Source Godown (From)</label>
              <select
                value={transferForm.sourceGodownId}
                onChange={(e) => {
                  const selected = e.target.value === 'main' ? 'Main Store / Floor' : godowns.find(g => g.id === e.target.value)?.name;
                  setTransferForm({
                    ...transferForm,
                    sourceGodownId: e.target.value,
                    sourceGodownName: selected
                  });
                }}
                className="input-field text-xs font-semibold"
              >
                <option value="main">Main Store / Floor</option>
                {godowns.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Destination Godown (To) *</label>
              <select
                required
                value={transferForm.destGodownId}
                onChange={(e) => {
                  const selected = e.target.value === 'main' ? 'Main Store / Floor' : godowns.find(g => g.id === e.target.value)?.name;
                  setTransferForm({
                    ...transferForm,
                    destGodownId: e.target.value,
                    destGodownName: selected
                  });
                }}
                className="input-field text-xs font-semibold"
              >
                <option value="">Select Destination...</option>
                <option value="main">Main Store / Floor</option>
                {godowns.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Product *</label>
                <select
                  required
                  value={transferForm.productId}
                  onChange={(e) => {
                    const prod = products.find(p => p.id === e.target.value);
                    setTransferForm({
                      ...transferForm,
                      productId: e.target.value,
                      productName: prod?.name || ''
                    });
                  }}
                  className="input-field text-xs font-semibold"
                >
                  <option value="">Choose item...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer Qty</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({...transferForm, quantity: parseInt(e.target.value) || 1})}
                  className="input-field text-xs text-center font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Transfer Stock
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default GodownManagement;
