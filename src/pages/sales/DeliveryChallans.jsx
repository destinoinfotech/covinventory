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
  Truck, 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Trash2, 
  Printer, 
  Eye, 
  PackageCheck,
  AlertCircle,
  FileSpreadsheet,
  X,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
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

const DeliveryChallans = () => {
  const { companyId, userData } = useAuth();
  const navigate = useNavigate();
  const [challans, setChallans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    challanNo: `DC-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    vehicleNo: '',
    driverName: '',
    notes: '',
    items: [{ productId: '', name: '', qty: 1, unit: 'pcs' }]
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Fetch Products for dropdown
    const fetchProducts = async () => {
      try {
        const prodSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching products for challans:', err);
      }
    };
    fetchProducts();

    // 2. Live listener for Challans
    const q = query(
      collection(db, 'challans'),
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
        setChallans(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching challans:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    let dispatched = 0;
    let delivered = 0;
    let invoiced = 0;
    challans.forEach(c => {
      if (c.status === 'Invoiced') invoiced++;
      else if (c.status === 'Delivered') delivered++;
      else dispatched++;
    });
    return {
      total: challans.length,
      dispatched,
      delivered,
      invoiced
    };
  }, [challans]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', name: '', qty: 1, unit: 'pcs' }]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        items[index] = {
          ...items[index],
          productId: value,
          name: prod?.name || '',
          unit: prod?.unit || 'pcs',
          price: prod?.sellingPrice || 0
        };
      } else {
        items[index][field] = value;
      }
      return { ...prev, items };
    });
  };

  const handleCreateChallan = async (e) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].name) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      setLoading(true);
      const newChallan = {
        ...formData,
        companyId,
        status: 'Dispatched',
        createdAt: new Date(),
        createdBy: userData?.name || 'Staff'
      };

      await addDoc(collection(db, 'challans'), newChallan);
      setShowCreateModal(false);
      toast.success('Delivery Challan created successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save challan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'challans', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleConvertToInvoice = (challan) => {
    navigate('/sales/new', { 
      state: { 
        convertedChallan: challan 
      } 
    });
  };

  const filteredChallans = challans.filter(c => {
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      c.challanNo?.toLowerCase().includes(q) || 
      c.customerName?.toLowerCase().includes(q) ||
      c.vehicleNo?.toLowerCase().includes(q) ||
      c.driverName?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const exportToCSV = () => {
    if (filteredChallans.length === 0) {
      toast.error('No challan records to export');
      return;
    }

    const headers = ['Challan No', 'Date', 'Customer Name', 'Phone', 'Vehicle No', 'Driver Name', 'Items Count', 'Status'];
    const rows = filteredChallans.map(c => [
      `"${c.challanNo || ''}"`,
      `"${format(parseItemDate(c), 'yyyy-MM-dd')}"`,
      `"${(c.customerName || '').replace(/"/g, '""')}"`,
      `"${c.customerPhone || ''}"`,
      `"${c.vehicleNo || ''}"`,
      `"${c.driverName || ''}"`,
      c.items?.length || 0,
      `"${c.status || 'Dispatched'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Delivery_Challans_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Challans exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Delivery Challans & Dispatches</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Record dispatches, generate transport packing slips, and convert to sales invoices.
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
                challanNo: `DC-${Date.now().toString().slice(-6)}`,
                date: new Date().toISOString().split('T')[0],
                customerName: '',
                customerPhone: '',
                deliveryAddress: '',
                vehicleNo: '',
                driverName: '',
                notes: '',
                items: [{ productId: '', name: '', qty: 1, unit: 'pcs' }]
              });
              setShowCreateModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Challan</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Dispatches</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Challans</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">All recorded movements</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Transit / Dispatched</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              {metrics.dispatched}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Pending Delivery</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Goods currently out for delivery</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivered</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {metrics.delivered}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Delivered to client</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Ready for invoice billing</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Converted Invoices</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-purple-600 dark:text-purple-400">
              {metrics.invoiced}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Invoiced</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Tax invoices generated</p>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search challan #, customer, vehicle..."
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
            {['All', 'Dispatched', 'Delivered', 'Invoiced'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all text-[11px]",
                  statusFilter === status
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Challans Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Challan No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Vehicle & Driver</th>
                <th className="px-5 py-3.5 text-center">Items</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading delivery challans...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Truck className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No delivery challans recorded</p>
                      <p className="text-xs text-slate-400">Create a delivery challan to dispatch inventory items with transport receipts.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChallans.map((ch) => {
                  const chDate = parseItemDate(ch);
                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-primary-600 dark:text-primary-400 text-xs">
                        {ch.challanNo}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(chDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {ch.customerName}
                          </span>
                          {ch.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-mono">{ch.customerPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-zinc-300">
                        <span className="font-bold">{ch.vehicleNo || 'Self Transport'}</span>
                        {ch.driverName && <span className="block text-[10px] text-slate-400">Driver: {ch.driverName}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {ch.items?.length || 0} Products
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                          ch.status === 'Invoiced'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : ch.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}>
                          {ch.status === 'Delivered' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {ch.status === 'Dispatched' && <Clock className="w-2.5 h-2.5" />}
                          {ch.status || 'Dispatched'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {ch.status !== 'Invoiced' && (
                            <button
                              onClick={() => handleConvertToInvoice(ch)}
                              className="px-2.5 py-1 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" /> Convert Invoice
                            </button>
                          )}
                          {ch.status === 'Dispatched' && (
                            <button
                              onClick={() => handleUpdateStatus(ch.id, 'Delivered')}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold rounded-lg hover:bg-emerald-100 text-[10px] inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Delivered
                            </button>
                          )}
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

      {/* Create Challan Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Delivery Challan"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateChallan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Challan No *</label>
                <input
                  type="text"
                  required
                  value={formData.challanNo}
                  onChange={(e) => setFormData({...formData, challanNo: e.target.value})}
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Dispatch Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g. MH-04-AB-1234"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData({...formData, vehicleNo: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Customer / Consignee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Customer or Warehouse Store"
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  className="input-field text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="Mobile number"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  className="input-field text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Delivery Destination Address</label>
              <input
                type="text"
                placeholder="Delivery address / site location"
                value={formData.deliveryAddress}
                onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
                className="input-field text-xs"
              />
            </div>

            {/* Items List */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-500">Items / Goods to Dispatch</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-primary-600 font-bold hover:underline"
                >
                  + Add Item
                </button>
              </div>

              {formData.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.productId}
                    onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                    className="input-field flex-1 text-xs"
                  >
                    <option value="">Select Item from Catalog</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                    className="input-field w-20 text-xs text-center font-bold"
                  />

                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                    className="input-field w-16 text-xs text-center"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={formData.items.length === 1}
                    className="text-slate-400 hover:text-rose-500 disabled:opacity-30 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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
                Create Delivery Challan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default DeliveryChallans;
