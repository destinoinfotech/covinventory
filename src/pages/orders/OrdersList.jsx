import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc 
} from '../../lib/supabase';
import { 
  ShoppingBag, 
  Search, 
  CheckCircle2, 
  Clock, 
  Truck, 
  FileText, 
  ArrowRight, 
  Phone, 
  MapPin, 
  MessageSquare,
  PackageCheck,
  FileSpreadsheet,
  ExternalLink,
  DollarSign,
  TrendingUp,
  X,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
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

const OrdersList = () => {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, 'online_orders'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const timeA = parseItemDate(a).getTime();
          const timeB = parseItemDate(b).getTime();
          return timeB - timeA;
        });
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error in OrdersList:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    let totalGMV = 0;
    let pending = 0;
    let shipped = 0;
    let invoiced = 0;

    orders.forEach(o => {
      totalGMV += parseFloat(o.totalAmount || 0);
      const st = o.status || 'Pending';
      if (st === 'Invoiced') invoiced++;
      else if (st === 'Shipped' || st === 'Packed') shipped++;
      else if (st === 'Pending' || st === 'Accepted') pending++;
    });

    return {
      totalOrders: orders.length,
      totalGMV,
      pending,
      shipped,
      invoiced
    };
  }, [orders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'online_orders', orderId), { 
        status: newStatus,
        updatedAt: new Date()
      });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleConvertToInvoice = (order) => {
    navigate('/sales/new', {
      state: {
        convertedOrder: order
      }
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        o.orderNo?.toLowerCase().includes(q) || 
        o.customerName?.toLowerCase().includes(q) || 
        o.customerPhone?.includes(q) ||
        o.deliveryAddress?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const exportToCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error('No digital order records to export');
      return;
    }

    const headers = ['Order No', 'Date', 'Customer Name', 'Phone', 'Address', 'Items Count', 'Status', 'Total (INR)'];
    const rows = filteredOrders.map(o => [
      `"${o.orderNo || ''}"`,
      `"${format(parseItemDate(o), 'yyyy-MM-dd HH:mm')}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`,
      o.items?.length || 0,
      `"${o.status || 'Pending'}"`,
      (parseFloat(o.totalAmount) || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Online_Orders_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Web Shop & Online Orders</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage incoming digital catalog orders, track shipment pipeline, and convert orders to Tax Invoices.
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
          <a
            href={`/store/${companyId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Open Public Store</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Online GMV</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalGMV)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total revenue from digital storefront</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {metrics.totalOrders}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Orders placed</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">All incoming web catalog orders</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Processing</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              {metrics.pending}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Pending packing</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Orders requiring action</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Invoiced & Billed</span>
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
          <p className="text-[10px] text-slate-400 mt-1">Converted to GST Tax Invoices</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search order #, customer, phone..."
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

          <div className="inline-flex p-0.5 bg-slate-200/70 dark:bg-zinc-800 rounded-lg text-xs font-semibold overflow-x-auto no-scrollbar">
            {['All', 'Pending', 'Accepted', 'Packed', 'Shipped', 'Delivered', 'Invoiced'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all text-[11px] whitespace-nowrap",
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Order No</th>
                <th className="px-5 py-3.5">Customer & Contact</th>
                <th className="px-5 py-3.5">Delivery Address</th>
                <th className="px-5 py-3.5 text-center">Items</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Order Total</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading online orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No digital orders received yet</p>
                      <p className="text-xs text-slate-400">Share your public web store link with customers to receive catalog orders.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const oDate = parseItemDate(order);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-primary-600 dark:text-primary-400 text-xs block">
                          {order.orderNo}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {format(oDate, 'dd MMM yyyy, hh:mm a')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800 dark:text-white text-xs">{order.customerName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{order.customerPhone}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 max-w-xs truncate">
                        {order.deliveryAddress || 'Self Pickup / In-Store'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold text-[10px] text-slate-700 dark:text-slate-300">
                          {order.items?.length || 0} Items
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <select
                          value={order.status || 'Pending'}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border",
                            order.status === 'Delivered' || order.status === 'Invoiced'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : order.status === 'Shipped' || order.status === 'Packed'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          )}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Packed">Packed</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Invoiced">Invoiced</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white font-display text-xs whitespace-nowrap">
                        {formatCurrency(order.totalAmount || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {order.status !== 'Invoiced' && (
                          <button
                            onClick={() => handleConvertToInvoice(order)}
                            className="px-2.5 py-1 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1 shadow-sm transition-all"
                            title="Convert Order to GST Tax Invoice"
                          >
                            <FileText className="w-3 h-3" /> Convert Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersList;
