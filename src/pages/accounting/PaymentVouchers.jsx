import React, { useState, useEffect } from 'react';
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
  increment,
  writeBatch
} from '../../lib/supabase';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Search, 
  Filter, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  User, 
  Truck,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Printer,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';

const PaymentVouchers = () => {
  const { companyId, userData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(searchParams.get('type') || 'payment_in'); // 'payment_in' or 'payment_out'
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState(null);

  const [formData, setFormData] = useState({
    voucherType: 'payment_in', // 'payment_in' (Customer Receipt) or 'payment_out' (Supplier Payout)
    voucherNo: `REC-${Date.now().toString().slice(-6)}`,
    partyId: '',
    partyName: '',
    partyPhone: '',
    amount: '',
    paymentMode: 'Cash',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    linkedInvoiceNo: '',
    linkedInvoiceId: '',
    notes: ''
  });

  // Real-time Listeners
  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    // 1. Payment Vouchers Live
    const qPay = query(collection(db, 'payment_vouchers'), where('companyId', '==', companyId));
    const unsubPay = onSnapshot(qPay, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setPayments(list);
      setLoading(false);
    });

    // 2. Customers Live
    const qCust = query(collection(db, 'customers'), where('companyId', '==', companyId));
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Suppliers Live
    const qSupp = query(collection(db, 'suppliers'), where('companyId', '==', companyId));
    const unsubSupp = onSnapshot(qSupp, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Bank Accounts Live
    const qAcc = query(collection(db, 'bank_accounts'), where('companyId', '==', companyId));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Sales Invoices Live
    const qSales = query(collection(db, 'sales'), where('companyId', '==', companyId));
    const unsubSales = onSnapshot(qSales, (snap) => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 6. Purchases Live
    const qPur = query(collection(db, 'purchases'), where('companyId', '==', companyId));
    const unsubPur = onSnapshot(qPur, (snap) => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPay();
      unsubCust();
      unsubSupp();
      unsubAcc();
      unsubSales();
      unsubPur();
    };
  }, [companyId]);

  // Handle URL prefill params (e.g. from SalesList or PeopleList "Receive Payment")
  useEffect(() => {
    const urlType = searchParams.get('type');
    const urlPartyId = searchParams.get('partyId');
    const urlPartyName = searchParams.get('partyName');
    const urlAmount = searchParams.get('amount');
    const urlInvoiceNo = searchParams.get('invoiceNo');

    if (urlType || urlPartyId || urlPartyName || urlInvoiceNo) {
      const vType = urlType === 'payment_out' ? 'payment_out' : 'payment_in';
      setActiveTab(vType);
      setFormData({
        voucherType: vType,
        voucherNo: `${vType === 'payment_in' ? 'REC' : 'PAY'}-${Date.now().toString().slice(-6)}`,
        partyId: urlPartyId || '',
        partyName: urlPartyName || '',
        partyPhone: '',
        amount: urlAmount ? parseFloat(urlAmount) || '' : '',
        paymentMode: 'UPI / QR',
        accountId: '',
        date: new Date().toISOString().split('T')[0],
        referenceNo: urlInvoiceNo ? `Settlement for ${urlInvoiceNo}` : '',
        linkedInvoiceNo: urlInvoiceNo || '',
        linkedInvoiceId: '',
        notes: urlInvoiceNo ? `Direct settlement for bill #${urlInvoiceNo}` : ''
      });
      setShowModal(true);
    }
  }, [searchParams]);

  // Active parties list based on voucher type
  const activeParties = formData.voucherType === 'payment_in' ? customers : suppliers;

  // Linked pending bills for the selected party
  const partyPendingInvoices = formData.partyId ? (
    formData.voucherType === 'payment_in'
      ? sales.filter(s => (s.customerId === formData.partyId || s.customerName?.toLowerCase() === formData.partyName?.toLowerCase()) && (s.paymentStatus !== 'Paid'))
      : purchases.filter(p => (p.supplierId === formData.partyId || p.supplierName?.toLowerCase() === formData.partyName?.toLowerCase()) && (p.paymentStatus !== 'Paid'))
  ) : [];

  const handleOpenNewVoucher = (type) => {
    const vType = type || activeTab;
    setFormData({
      voucherType: vType,
      voucherNo: `${vType === 'payment_in' ? 'REC' : 'PAY'}-${Date.now().toString().slice(-6)}`,
      partyId: '',
      partyName: '',
      partyPhone: '',
      amount: '',
      paymentMode: 'Cash',
      accountId: accounts[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      referenceNo: '',
      linkedInvoiceNo: '',
      linkedInvoiceId: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount) || 0;
    if (amt <= 0) {
      toast.error('Please enter a valid settlement amount');
      return;
    }
    if (!formData.partyName) {
      toast.error('Please select or specify the party');
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);

      const newVoucher = {
        ...formData,
        amount: amt,
        companyId,
        createdAt: new Date(),
        recordedBy: userData?.name || 'Staff'
      };

      // 1. Create Payment Voucher doc
      const voucherRef = doc(collection(db, 'payment_vouchers'));
      batch.set(voucherRef, newVoucher);

      // 2. Update Party Credit/Due Balance in customers or suppliers collection
      if (formData.partyId) {
        const collectionName = formData.voucherType === 'payment_in' ? 'customers' : 'suppliers';
        const partyRef = doc(db, collectionName, formData.partyId);
        batch.update(partyRef, {
          creditBalance: increment(-amt),
          lastPaymentDate: new Date(),
          updatedAt: new Date()
        });
      }

      // 3. Update Bank/Cash Account balance
      if (formData.accountId) {
        const accRef = doc(db, 'bank_accounts', formData.accountId);
        const delta = formData.voucherType === 'payment_in' ? amt : -amt;
        batch.update(accRef, {
          currentBalance: increment(delta),
          updatedAt: new Date()
        });
      }

      // 4. If linked to a sales invoice, update the invoice's payment status & balances
      if (formData.voucherType === 'payment_in') {
        let saleDocRef = null;
        let targetSale = null;
        if (formData.linkedInvoiceId) {
          saleDocRef = doc(db, 'sales', formData.linkedInvoiceId);
          targetSale = sales.find(s => s.id === formData.linkedInvoiceId);
        } else if (formData.linkedInvoiceNo) {
          const matched = sales.find(s => s.invoiceNumber === formData.linkedInvoiceNo || s.invoiceNo === formData.linkedInvoiceNo);
          if (matched) {
            saleDocRef = doc(db, 'sales', matched.id);
            targetSale = matched;
          }
        }

        if (saleDocRef) {
          const billTotal = parseFloat(targetSale?.grandTotal || targetSale?.total || amt) || 0;
          const prevPaid = parseFloat(targetSale?.paidAmount != null ? targetSale.paidAmount : (targetSale?.paymentStatus === 'Paid' ? billTotal : (targetSale?.cashAmount || 0))) || 0;
          const newPaid = prevPaid + amt;
          const newDue = Math.max(0, billTotal - newPaid);
          const newStatus = newDue <= 0.01 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');

          batch.update(saleDocRef, {
            paymentStatus: newStatus,
            paymentMode: formData.paymentMode || 'Cash',
            paidAmount: newPaid,
            creditAmount: newDue,
            cashAmount: newPaid,
            lastPaymentDate: new Date(),
            paidAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else if (formData.voucherType === 'payment_out') {
        let purchaseDocRef = null;
        let targetPurchase = null;
        if (formData.linkedInvoiceId) {
          purchaseDocRef = doc(db, 'purchases', formData.linkedInvoiceId);
          targetPurchase = purchases.find(p => p.id === formData.linkedInvoiceId);
        } else if (formData.linkedInvoiceNo) {
          const matched = purchases.find(p => p.invoiceNumber === formData.linkedInvoiceNo || p.invoiceNo === formData.linkedInvoiceNo || p.billNumber === formData.linkedInvoiceNo);
          if (matched) {
            purchaseDocRef = doc(db, 'purchases', matched.id);
            targetPurchase = matched;
          }
        }

        if (purchaseDocRef) {
          const billTotal = parseFloat(targetPurchase?.grandTotal || targetPurchase?.total || targetPurchase?.totalAmount || amt) || 0;
          const prevPaid = parseFloat(targetPurchase?.paidAmount != null ? targetPurchase.paidAmount : (targetPurchase?.paymentStatus === 'Paid' ? billTotal : 0)) || 0;
          const newPaid = prevPaid + amt;
          const newDue = Math.max(0, billTotal - newPaid);
          const newStatus = newDue <= 0.01 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');

          batch.update(purchaseDocRef, {
            paymentStatus: newStatus,
            paymentMode: formData.paymentMode || 'Bank Transfer',
            paidAmount: newPaid,
            dueAmount: newDue,
            lastPaymentDate: new Date(),
            paidAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      await batch.commit();

      setShowModal(false);
      // Clear URL params if any
      setSearchParams({});
      toast.success(`${formData.voucherType === 'payment_in' ? 'Payment In (Receipt)' : 'Payment Out (Payout)'} of ${formatCurrency(amt)} recorded successfully!`);
    } catch (err) {
      console.error('Payment Voucher Error:', err);
      toast.error(`Failed to save payment voucher: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesTab = (p.voucherType || 'payment_in') === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      p.partyName?.toLowerCase().includes(q) || 
      p.voucherNo?.toLowerCase().includes(q) ||
      p.referenceNo?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const totalIn = payments
    .filter(p => (p.voucherType || 'payment_in') === 'payment_in')
    .reduce((s, p) => s + (parseFloat(p.amount || 0)), 0);

  const totalOut = payments
    .filter(p => p.voucherType === 'payment_out')
    .reduce((s, p) => s + (parseFloat(p.amount || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
              <DollarSign className="w-5 h-5" />
            </div>
            Payment In & Out Vouchers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Record customer settlements (Payment In) and vendor payouts (Payment Out) to balance party ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenNewVoucher('payment_in')}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Payment In (Receipt)</span>
          </button>
          <button
            onClick={() => handleOpenNewVoucher('payment_out')}
            className="btn-secondary text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
            <span>+ Payment Out (Payout)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total In */}
        <div className="card p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Total Payment In (Receipts)
            </span>
            <span className="badge badge-success text-[10px]">
              {payments.filter(p => (p.voucherType || 'payment_in') === 'payment_in').length} Vouchers
            </span>
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {formatCurrency(totalIn)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Customer dues collected</span>
        </div>

        {/* Total Out */}
        <div className="card p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-rose-500" /> Total Payment Out (Payouts)
            </span>
            <span className="badge badge-danger text-[10px]">
              {payments.filter(p => p.voucherType === 'payment_out').length} Vouchers
            </span>
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2 tabular-nums">
            {formatCurrency(totalOut)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Vendor dues settled</span>
        </div>

        {/* Net Cash Flow */}
        <div className="card p-4 border-l-4 border-l-slate-700 dark:border-l-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-slate-600 dark:text-zinc-300" /> Net Settlement Flow
            </span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", totalIn >= totalOut ? "badge-success" : "badge-danger")}>
              {totalIn >= totalOut ? "Net Inflow" : "Net Outflow"}
            </span>
          </div>
          <p className={cn("text-xl font-black mt-2 tabular-nums", totalIn >= totalOut ? "text-slate-900 dark:text-zinc-100" : "text-rose-600")}>
            {formatCurrency(totalIn - totalOut)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Receipts minus payouts</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('payment_in')}
          className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'payment_in'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          Payment In (Customer Receipts: {formatCurrency(totalIn)})
        </button>
        <button
          onClick={() => setActiveTab('payment_out')}
          className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'payment_out'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-rose-500" />
          Payment Out (Supplier Payouts: {formatCurrency(totalOut)})
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voucher no, party name, ref..."
            className="input-field pl-8 text-xs py-1.5"
          />
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredPayments.length} of {payments.length} vouchers
        </span>
      </div>

      {/* Payments Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading payment vouchers...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <Receipt className="w-10 h-10 stroke-1 mb-2 opacity-40" />
            <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">
              No {activeTab === 'payment_in' ? 'receipts' : 'payouts'} recorded yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Use the "+ Record {activeTab === 'payment_in' ? 'Payment In' : 'Payment Out'}" button above to settle credit sales and vendor invoices.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Ref / Notes</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary-600">
                      {p.voucherNo}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                      {p.date}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800 dark:text-zinc-100">{p.partyName}</p>
                      {p.partyPhone && <p className="text-[10px] text-slate-400 font-mono">{p.partyPhone}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        (p.voucherType || 'payment_in') === 'payment_in'
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/50"
                      )}>
                        {(p.voucherType || 'payment_in') === 'payment_in' ? 'Receipt In' : 'Payout Out'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium text-[11px]">
                        {p.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {p.referenceNo || p.notes || '---'}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right font-bold text-sm tabular-nums",
                      (p.voucherType || 'payment_in') === 'payment_in'
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}>
                      {(p.voucherType || 'payment_in') === 'payment_in' ? '+' : '-'}{formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PAYMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                {formData.voucherType === 'payment_in' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-rose-600" />
                )}
                Record {formData.voucherType === 'payment_in' ? 'Payment In (Customer Receipt)' : 'Payment Out (Supplier Payout)'}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setSearchParams({});
                }} 
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5">
              {/* Voucher Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      voucherType: 'payment_in',
                      voucherNo: `REC-${Date.now().toString().slice(-6)}`,
                      partyId: '',
                      partyName: ''
                    }));
                  }}
                  className={cn(
                    "py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                    formData.voucherType === 'payment_in' 
                      ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                      : "text-slate-500"
                  )}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Payment In (Customer)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      voucherType: 'payment_out',
                      voucherNo: `PAY-${Date.now().toString().slice(-6)}`,
                      partyId: '',
                      partyName: ''
                    }));
                  }}
                  className={cn(
                    "py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                    formData.voucherType === 'payment_out' 
                      ? "bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm" 
                      : "text-slate-500"
                  )}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Payment Out (Supplier)
                </button>
              </div>

              {/* Number and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Voucher No</label>
                  <input
                    type="text"
                    required
                    value={formData.voucherNo}
                    onChange={(e) => setFormData({...formData, voucherNo: e.target.value})}
                    className="input-field text-xs font-mono py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="input-field text-xs py-1.5"
                  />
                </div>
              </div>

              {/* Select Party */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    Select {formData.voucherType === 'payment_in' ? 'Customer (Debtor)' : 'Supplier (Vendor)'} *
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {activeParties.length} {formData.voucherType === 'payment_in' ? 'customers' : 'suppliers'} available
                  </span>
                </div>
                <select
                  required
                  value={formData.partyId}
                  onChange={(e) => {
                    const party = activeParties.find(p => p.id === e.target.value);
                    const dueAmt = parseFloat(party?.creditBalance || 0);
                    setFormData({
                      ...formData,
                      partyId: e.target.value,
                      partyName: party?.name || '',
                      partyPhone: party?.phone || '',
                      amount: dueAmt > 0 ? dueAmt : formData.amount
                    });
                  }}
                  className="input-field text-xs font-semibold py-2"
                >
                  <option value="">Choose {formData.voucherType === 'payment_in' ? 'customer...' : 'supplier...'}</option>
                  {activeParties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone && `(${p.phone})`} — {formData.voucherType === 'payment_in' ? 'Due:' : 'Payable:'} {formatCurrency(p.creditBalance || 0)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Linked Invoices (if available) */}
              {partyPendingInvoices.length > 0 && (
                <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700/60 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Pending Unpaid {formData.voucherType === 'payment_in' ? 'Sales Invoices' : 'Purchase Bills'}
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {partyPendingInvoices.map(inv => (
                      <div 
                        key={inv.id}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            linkedInvoiceId: inv.id,
                            linkedInvoiceNo: inv.invoiceNumber || inv.invoiceNo || inv.billNumber || '',
                            amount: inv.creditAmount || inv.grandTotal || prev.amount,
                            referenceNo: `Settlement for ${inv.invoiceNumber || inv.invoiceNo || inv.billNumber}`
                          }));
                        }}
                        className={cn(
                          "p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors",
                          formData.linkedInvoiceId === inv.id 
                            ? "bg-primary-50 dark:bg-primary-950/40 border border-primary-300 dark:border-primary-800" 
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300"
                        )}
                      >
                        <div>
                          <span className="font-mono font-bold text-primary-600">
                            {inv.invoiceNumber || inv.invoiceNo || inv.billNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            {inv.date ? (inv.date.seconds ? new Date(inv.date.seconds * 1000).toLocaleDateString() : new Date(inv.date).toLocaleDateString()) : ''}
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                          {formatCurrency(inv.grandTotal || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Settlement Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="input-field text-xs font-bold text-emerald-600 py-1.5 text-base"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Payment Mode</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({...formData, paymentMode: e.target.value})}
                    className="input-field text-xs py-1.5"
                  >
                    <option value="Cash">Cash Drawer</option>
                    <option value="UPI / QR">UPI / QR</option>
                    <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit / Debit Card">Card</option>
                  </select>
                </div>
              </div>

              {/* Bank/Cash Account */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  {formData.voucherType === 'payment_in' ? 'Deposit Into Bank / Cash Account' : 'Paid Out From Bank / Cash Account'}
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({...formData, accountId: e.target.value})}
                  className="input-field text-xs py-1.5"
                >
                  <option value="">Select Account (Optional)...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName || a.name} (Balance: {formatCurrency(a.currentBalance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">Reference / UTR / Cheque No</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98218172"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({...formData, referenceNo: e.target.value})}
                    className="input-field text-xs py-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Part payment settled"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="input-field text-xs py-1"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSearchParams({});
                  }}
                  className="flex-1 btn-secondary text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex-1 text-xs py-2 font-bold text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm",
                    formData.voucherType === 'payment_in'
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save {formData.voucherType === 'payment_in' ? 'Receipt Voucher' : 'Payout Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVouchers;
