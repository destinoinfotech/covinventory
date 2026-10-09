import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  addDoc 
} from '../../lib/supabase';
import { 
  MessageSquare, 
  Send, 
  Tag, 
  Gift, 
  Sparkles, 
  QrCode, 
  Percent, 
  Plus, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  DollarSign,
  TrendingDown,
  X,
  RefreshCw,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { generateUPIString } from '../../utils/taxEngine';

const RemindersAndPromotions = () => {
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState('reminders'); // 'reminders' or 'coupons'
  const [customers, setCustomers] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reminder Generator State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [reminderAmount, setReminderAmount] = useState(0);

  // New Coupon Form
  const [couponForm, setCouponForm] = useState({
    code: 'SAVE10',
    discountType: 'percentage', // 'percentage' or 'flat'
    discountValue: 10,
    minOrderValue: 500,
    expiryDate: '2026-12-31',
    isActive: true
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Fetch Company Settings
    const fetchCompany = async () => {
      try {
        const cSnap = await getDoc(doc(db, 'settings', companyId));
        if (cSnap.exists()) {
          setCompanyProfile(cSnap.data());
        } else {
          const compSnap = await getDoc(doc(db, 'companies', companyId));
          if (compSnap.exists()) setCompanyProfile(compSnap.data());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCompany();

    // 2. Live listener for Customers
    const qCust = query(collection(db, 'customers'), where('companyId', '==', companyId));
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Live listener for Coupons
    const qCoup = query(collection(db, 'promotions'), where('companyId', '==', companyId));
    const unsubCoup = onSnapshot(qCoup, (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubCust();
      unsubCoup();
    };
  }, [companyId]);

  const overdueCustomers = useMemo(() => {
    return customers.filter(c => (parseFloat(c.creditBalance) || 0) > 0);
  }, [customers]);

  const metrics = useMemo(() => {
    let totalDue = 0;
    overdueCustomers.forEach(c => {
      totalDue += parseFloat(c.creditBalance) || 0;
    });

    return {
      totalDue,
      debtorsCount: overdueCustomers.length,
      activeCouponsCount: coupons.length
    };
  }, [overdueCustomers, coupons]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    const due = parseFloat(customer.creditBalance) || 0;
    setReminderAmount(due);

    const upiLink = companyProfile?.upiId 
      ? generateUPIString({
          upiId: companyProfile.upiId,
          payeeName: companyProfile.businessName || companyProfile.companyName || 'Business',
          amount: due,
          note: `Due Settlement for ${customer.name}`
        })
      : '';

    let text = `Dear ${customer.name},\n\n`;
    text += `This is a gentle payment reminder from *${companyProfile?.businessName || companyProfile?.companyName || 'Covinventory'}* regarding your pending ledger balance of *${formatCurrency(due)}*.\n\n`;
    if (companyProfile?.upiId) {
      text += `💳 *Pay Online via UPI:* ${companyProfile.upiId}\n`;
      if (upiLink) text += `Quick Pay Link: ${upiLink}\n\n`;
    }
    text += `Please settle the outstanding amount at your earliest convenience. Thank you for your business!`;
    setCustomMessage(text);
  };

  const handleSendWhatsApp = () => {
    if (!selectedCustomer?.phone) {
      toast.error('Customer phone number missing');
      return;
    }
    const cleanPhone = selectedCustomer.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessage)}`;
    window.open(url, '_blank');
    toast.success('WhatsApp link opened!');
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    if (!couponForm.code) {
      toast.error('Please enter coupon code');
      return;
    }

    try {
      setLoading(true);
      const newCoupon = {
        ...couponForm,
        companyId,
        createdAt: new Date()
      };
      await addDoc(collection(db, 'promotions'), newCoupon);
      toast.success('Promotional coupon created!');
      setCouponForm({
        code: '',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 500,
        expiryDate: '2026-12-31',
        isActive: true
      });
    } catch (err) {
      toast.error('Failed to create coupon: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">WhatsApp Reminders & Promotions</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Automated WhatsApp payment reminders with UPI QR intent links and promotional customer discount schemes.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Outstanding Dues</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-rose-600 dark:text-rose-400">
              {formatCurrency(metrics.totalDue)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Pending credit customer balances</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Debtors Requiring Reminder</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {metrics.debtorsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Customers</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Click to generate instant WhatsApp text</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Promo Schemes</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {metrics.activeCouponsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Coupons</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Applicable during POS & web billing</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('reminders')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'reminders'
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Send className="w-3.5 h-3.5" /> WhatsApp Payment Reminders
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'coupons'
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Gift className="w-3.5 h-3.5" /> Discount Coupons & Schemes
        </button>
      </div>

      {/* TAB 1: WHATSAPP PAYMENT REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Customers with Overdue List */}
          <div className="col-span-12 lg:col-span-5 card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Customers with Pending Dues
              </h3>
              <span className="text-[10px] font-bold text-rose-600">
                {overdueCustomers.length} Debtors
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[450px] overflow-y-auto space-y-1">
              {overdueCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between",
                    selectedCustomer?.id === c.id 
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700"
                      : "hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{c.phone || 'No phone'}</span>
                  </div>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-display">
                    {formatCurrency(c.creditBalance)}
                  </span>
                </button>
              ))}

              {overdueCustomers.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                  <p className="font-bold text-slate-700 dark:text-zinc-300">All customer dues settled!</p>
                  <p className="text-[10px] text-slate-400">No debtors requiring payment reminders at this time.</p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Message Preview & Dispatch */}
          <div className="col-span-12 lg:col-span-7 card p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Message Generator
            </h3>

            {selectedCustomer ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Selected Recipient</span>
                    <strong className="text-xs text-slate-900 dark:text-white">{selectedCustomer.name} ({selectedCustomer.phone})</strong>
                  </div>
                  <span className="text-sm font-bold text-rose-600 font-display">{formatCurrency(reminderAmount)}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Editable WhatsApp Message Template
                  </label>
                  <textarea
                    rows={8}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="input-field text-xs font-mono"
                  />
                </div>

                {companyProfile?.upiId && (
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Direct UPI Intent Attached</span>
                        <p className="text-[10px] text-slate-500">Includes direct payment link to {companyProfile.upiId}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSendWhatsApp}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Send className="w-4 h-4" /> Open in WhatsApp & Send Reminder
                </button>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="w-10 h-10 mb-2 stroke-1 opacity-40 text-slate-400" />
                <p className="font-bold text-xs text-slate-600 dark:text-zinc-400">Select a debtor on the left</p>
                <p className="text-[10px] text-slate-400">Pre-formats reminder text with live UPI payment links.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROMOTIONS & DISCOUNT COUPONS */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Create Coupon Form */}
          <div className="col-span-12 lg:col-span-5 card p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary-600" /> Create Discount Coupon
            </h3>

            <form onSubmit={handleSaveCoupon} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20 or FESTIVE500"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Type</label>
                  <select
                    value={couponForm.discountType}
                    onChange={(e) => setCouponForm({...couponForm, discountType: e.target.value})}
                    className="input-field text-xs font-semibold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Discount Value *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm({...couponForm, discountValue: parseFloat(e.target.value) || 0})}
                    className="input-field text-xs font-bold text-primary-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    value={couponForm.minOrderValue}
                    onChange={(e) => setCouponForm({...couponForm, minOrderValue: parseFloat(e.target.value) || 0})}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={couponForm.expiryDate}
                    onChange={(e) => setCouponForm({...couponForm, expiryDate: e.target.value})}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 text-xs mt-2"
              >
                Create Promotional Coupon
              </button>
            </form>
          </div>

          {/* Active Coupons List */}
          <div className="col-span-12 lg:col-span-7 card p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
              Active Promotional Codes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coupons.map(cp => (
                <div key={cp.id} className="p-3.5 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-1.5">
                  <span className="font-mono font-bold text-primary-600 text-xs tracking-wider block">
                    {cp.code}
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {cp.discountType === 'percentage' ? `${cp.discountValue}% OFF` : `₹${cp.discountValue} FLAT OFF`}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Min Order: {formatCurrency(cp.minOrderValue || 0)}
                  </p>
                  <span className="text-[10px] text-slate-400 block">
                    Valid till: {cp.expiryDate || 'No Expiry'}
                  </span>
                </div>
              ))}

              {coupons.length === 0 && (
                <div className="col-span-2 py-12 text-center text-slate-400 text-xs">
                  No promotional coupons created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersAndPromotions;
