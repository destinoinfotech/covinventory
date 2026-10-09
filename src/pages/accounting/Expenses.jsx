import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs 
} from '../../lib/supabase';
import { 
  Receipt, 
  Plus, 
  Search, 
  Trash2, 
  Filter, 
  DollarSign, 
  Tag, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  TrendingDown,
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

const Expenses = () => {
  const { companyId, userData } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const expenseCategories = [
    'Rent & Utilities',
    'Electricity & Water',
    'Staff Salaries & Wages',
    'Logistics & Freight',
    'Marketing & Advertising',
    'Office Supplies & Stationary',
    'Repairs & Maintenance',
    'Professional & Legal Fees',
    'Miscellaneous Overheads'
  ];

  const [formData, setFormData] = useState({
    expenseNo: `EXP-${Date.now().toString().slice(-6)}`,
    title: '',
    category: 'Rent & Utilities',
    amount: '',
    gstPercent: 18,
    isItcEligible: false,
    vendorName: '',
    vendorGSTIN: '',
    paymentMode: 'Cash',
    paidFromAccountId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Live listener for Expenses
    const qExp = query(collection(db, 'expenses'), where('companyId', '==', companyId));
    const unsubExp = onSnapshot(qExp, (snap) => {
      const listExp = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      listExp.sort((a, b) => {
        const timeA = parseItemDate(a).getTime();
        const timeB = parseItemDate(b).getTime();
        return timeB - timeA;
      });
      setExpenses(listExp);
      setLoading(false);
    });

    // 2. Fetch Accounts
    const fetchAccounts = async () => {
      try {
        const qAcc = query(collection(db, 'bank_accounts'), where('companyId', '==', companyId));
        const snapAcc = await getDocs(qAcc);
        setAccounts(snapAcc.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchAccounts();

    return () => unsubExp();
  }, [companyId]);

  const metrics = useMemo(() => {
    let total = 0;
    let itcEligible = 0;
    const categoryTotals = {};

    expenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      total += amt;
      if (e.isItcEligible) itcEligible += amt;
      const cat = e.category || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    let topCategory = 'None';
    let topVal = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > topVal) {
        topVal = val;
        topCategory = cat;
      }
    });

    return {
      total,
      itcEligible,
      topCategory,
      count: expenses.length
    };
  }, [expenses]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount) || 0;
    if (amt <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }

    try {
      setLoading(true);
      const newExp = {
        ...formData,
        amount: amt,
        companyId,
        createdAt: new Date(),
        createdBy: userData?.name || 'Staff'
      };

      await addDoc(collection(db, 'expenses'), newExp);
      setShowModal(false);
      toast.success('Expense recorded successfully!');
    } catch (err) {
      toast.error('Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense removed');
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        e.title?.toLowerCase().includes(q) || 
        e.vendorName?.toLowerCase().includes(q) || 
        e.expenseNo?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [expenses, categoryFilter, searchQuery]);

  const exportToCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.error('No expense records to export');
      return;
    }

    const headers = ['Expense No', 'Date', 'Title', 'Vendor Name', 'Category', 'Payment Mode', 'GST ITC Eligible', 'Amount (INR)'];
    const rows = filteredExpenses.map(e => [
      `"${e.expenseNo || ''}"`,
      `"${format(parseItemDate(e), 'yyyy-MM-dd')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.vendorName || '').replace(/"/g, '""')}"`,
      `"${e.category || ''}"`,
      `"${e.paymentMode || 'Cash'}"`,
      e.isItcEligible ? `Yes (${e.gstPercent || 18}%)` : 'No',
      (parseFloat(e.amount) || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Expenses exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Expense Tracker & Overheads</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Log direct & indirect operational overhead expenses with GST Input Tax Credit (ITC) tracking.
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
                expenseNo: `EXP-${Date.now().toString().slice(-6)}`,
                title: '',
                category: 'Rent & Utilities',
                amount: '',
                gstPercent: 18,
                isItcEligible: false,
                vendorName: '',
                vendorGSTIN: '',
                paymentMode: 'Cash',
                paidFromAccountId: accounts[0]?.id || '',
                date: new Date().toISOString().split('T')[0],
                notes: ''
              });
              setShowModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-rose-600 dark:text-rose-400">
              {formatCurrency(metrics.total)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.count} records)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Operational overhead costs</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GST ITC Claimable</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.itcEligible)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Qualifies for GSTR-3B tax credit</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Expense Head</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
              {metrics.topCategory}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Highest spending operational category</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Categories</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-purple-600 dark:text-purple-400">
              {expenseCategories.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Head categories</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">P&L overhead categories</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by title, vendor, code..."
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 rounded-lg px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Expense No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Title & Vendor</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">GST / ITC</th>
                <th className="px-5 py-3.5">Paid Via</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading expenses...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Receipt className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No expenses found</p>
                      <p className="text-xs text-slate-400">Record operational overhead expenses to keep your P&L accurate.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const expDate = parseItemDate(exp);
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                        {exp.expenseNo}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(expDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800 dark:text-white text-xs">{exp.title}</p>
                        {exp.vendorName && <p className="text-[10px] text-slate-400 font-mono">{exp.vendorName}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-full font-bold text-[10px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {exp.isItcEligible ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> ITC ({exp.gstPercent || 18}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">No ITC</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-zinc-300">
                        {exp.paymentMode}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white font-display text-xs whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Expense Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Record Business Expense"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Expense Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Office Electricity Bill Feb 2026"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="input-field text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="input-field text-xs font-semibold"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="input-field text-xs font-bold text-rose-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Payment Mode</label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({...formData, paymentMode: e.target.value})}
                  className="input-field text-xs"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                  <option value="UPI / QR">UPI / QR</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isItcEligible}
                  onChange={(e) => setFormData({...formData, isItcEligible: e.target.checked})}
                  className="rounded text-primary-600"
                />
                GST Input Tax Credit (ITC) Eligible
              </label>

              {formData.isItcEligible && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-zinc-700">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Vendor GSTIN</label>
                    <input
                      type="text"
                      placeholder="27AABCU9603R1ZM"
                      value={formData.vendorGSTIN}
                      onChange={(e) => setFormData({...formData, vendorGSTIN: e.target.value})}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">GST Rate (%)</label>
                    <select
                      value={formData.gstPercent}
                      onChange={(e) => setFormData({...formData, gstPercent: parseInt(e.target.value) || 18})}
                      className="input-field text-xs font-bold"
                    >
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
              )}
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
                Save Expense
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Expenses;
