import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc 
} from '../../lib/supabase';
import { 
  Building2, 
  Wallet, 
  Plus, 
  ArrowRightLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CreditCard, 
  Search, 
  History, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  CheckCircle2,
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

const Banking = () => {
  const { companyId, userData } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showContraModal, setShowContraModal] = useState(false);

  // Account Form
  const [accountForm, setAccountForm] = useState({
    accountName: '',
    accountType: 'Bank Account', // 'Bank Account', 'Cash Register', 'Digital Wallet'
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    openingBalance: 0
  });

  // Contra Transfer Form (Inter-account transfer)
  const [contraForm, setContraForm] = useState({
    transferNo: `CNT-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    fromAccountId: '',
    fromAccountName: '',
    toAccountId: '',
    toAccountName: '',
    amount: '',
    type: 'Bank to Cash', // 'Bank to Cash', 'Cash to Bank', 'Bank to Bank'
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;

    // 1. Live listener for Bank Accounts
    const qAcc = query(collection(db, 'bank_accounts'), where('companyId', '==', companyId));
    const unsubAcc = onSnapshot(qAcc, async (snap) => {
      let accList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Auto create default Cash in Hand if none exists
      if (accList.length === 0 && !snap.metadata.hasPendingWrites) {
        const defaultCash = {
          companyId,
          accountName: 'Cash in Hand (Petty Cash)',
          accountType: 'Cash Register',
          bankName: 'Cash Register',
          accountNumber: 'CASH-001',
          ifscCode: '',
          openingBalance: 10000,
          currentBalance: 10000,
          createdAt: new Date()
        };
        const ref = await addDoc(collection(db, 'bank_accounts'), defaultCash);
        accList = [{ id: ref.id, ...defaultCash }];
      }
      setAccounts(accList);
    });

    // 2. Live listener for Contra Transactions
    const qTx = query(collection(db, 'bank_transactions'), where('companyId', '==', companyId));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = parseItemDate(a).getTime();
        const timeB = parseItemDate(b).getTime();
        return timeB - timeA;
      });
      setTransactions(list);
      setLoading(false);
    });

    return () => {
      unsubAcc();
      unsubTx();
    };
  }, [companyId]);

  const metrics = useMemo(() => {
    let totalLiquid = 0;
    let bankTotal = 0;
    let cashTotal = 0;

    accounts.forEach(a => {
      const bal = parseFloat(a.currentBalance ?? a.openingBalance ?? 0);
      totalLiquid += bal;
      if (a.accountType === 'Cash Register') cashTotal += bal;
      else bankTotal += bal;
    });

    return {
      totalLiquid,
      bankTotal,
      cashTotal,
      accountsCount: accounts.length,
      contraCount: transactions.length
    };
  }, [accounts, transactions]);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.accountName) {
      toast.error('Please enter account name');
      return;
    }

    try {
      setLoading(true);
      const newAcc = {
        ...accountForm,
        companyId,
        currentBalance: parseFloat(accountForm.openingBalance) || 0,
        createdAt: new Date()
      };
      await addDoc(collection(db, 'bank_accounts'), newAcc);
      setShowAccountModal(false);
      toast.success('Account added successfully!');
    } catch (err) {
      toast.error('Failed to add account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContra = async (e) => {
    e.preventDefault();
    const amt = parseFloat(contraForm.amount) || 0;
    if (amt <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }
    if (!contraForm.fromAccountId || !contraForm.toAccountId) {
      toast.error('Please select both source and destination accounts');
      return;
    }
    if (contraForm.fromAccountId === contraForm.toAccountId) {
      toast.error('Source and destination accounts must be different');
      return;
    }

    try {
      setLoading(true);
      const fromAcc = accounts.find(a => a.id === contraForm.fromAccountId);
      const toAcc = accounts.find(a => a.id === contraForm.toAccountId);

      // 1. Update balances
      if (fromAcc) {
        await updateDoc(doc(db, 'bank_accounts', fromAcc.id), {
          currentBalance: (fromAcc.currentBalance ?? fromAcc.openingBalance ?? 0) - amt,
          updatedAt: new Date()
        });
      }
      if (toAcc) {
        await updateDoc(doc(db, 'bank_accounts', toAcc.id), {
          currentBalance: (toAcc.currentBalance ?? toAcc.openingBalance ?? 0) + amt,
          updatedAt: new Date()
        });
      }

      // 2. Save Transaction Record
      const contraTx = {
        ...contraForm,
        amount: amt,
        companyId,
        fromAccountName: fromAcc?.accountName || 'Account',
        toAccountName: toAcc?.accountName || 'Account',
        createdAt: new Date(),
        createdBy: userData?.name || 'Staff'
      };

      await addDoc(collection(db, 'bank_transactions'), contraTx);
      setShowContraModal(false);
      toast.success('Contra transfer completed successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process transfer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      t.transferNo?.toLowerCase().includes(q) || 
      t.fromAccountName?.toLowerCase().includes(q) || 
      t.toAccountName?.toLowerCase().includes(q) ||
      t.type?.toLowerCase().includes(q);
  });

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No contra transfer records to export');
      return;
    }

    const headers = ['Voucher No', 'Date', 'From Account', 'To Account', 'Transfer Type', 'Amount (INR)'];
    const rows = filteredTransactions.map(t => [
      `"${t.transferNo || ''}"`,
      `"${format(parseItemDate(t), 'yyyy-MM-dd')}"`,
      `"${(t.fromAccountName || '').replace(/"/g, '""')}"`,
      `"${(t.toAccountName || '').replace(/"/g, '""')}"`,
      `"${t.type || 'Contra'}"`,
      (parseFloat(t.amount) || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Contra_Transfers_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Contra transfers exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Cash Book & Bank Accounts</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage cash registers, bank accounts, digital wallets, and execute inter-account contra transfers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setContraForm({
                transferNo: `CNT-${Date.now().toString().slice(-6)}`,
                date: new Date().toISOString().split('T')[0],
                fromAccountId: '',
                fromAccountName: '',
                toAccountId: '',
                toAccountName: '',
                amount: '',
                type: 'Bank to Cash',
                notes: ''
              });
              setShowContraModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Contra Transfer</span>
          </button>
          <button
            onClick={() => {
              setAccountForm({ accountName: '', accountType: 'Bank Account', bankName: '', accountNumber: '', ifscCode: '', openingBalance: 0 });
              setShowAccountModal(true);
            }}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Liquid Balance</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalLiquid)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Cash in Hand + All Bank Accounts</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bank Balance</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">
              {formatCurrency(metrics.bankTotal)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Current & savings accounts balance</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Petty Cash In Hand</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              {formatCurrency(metrics.cashTotal)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Cash drawers & petty registers</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accounts & Contras</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-purple-600 dark:text-purple-400">
              {metrics.accountsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({metrics.contraCount} transfers)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total active cash & bank books</p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm relative">
            <div className="flex items-center justify-between mb-2">
              <div className={cn(
                "p-2 rounded-lg",
                acc.accountType === 'Cash Register'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                  : 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
              )}>
                {acc.accountType === 'Cash Register' ? <Wallet className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                {acc.accountType}
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{acc.accountName}</h4>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {acc.accountNumber ? `A/C: ${acc.accountNumber}` : acc.bankName}
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-slate-400">Available Balance:</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-display">
                {formatCurrency(acc.currentBalance ?? acc.openingBalance ?? 0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Contra Transfers & Transactions Table */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search contra transfers, accounts..."
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
                <th className="px-5 py-3.5">Voucher No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Transfer Route (From → To)</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                      <span>Loading contra transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <History className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-sm">No contra transfers recorded yet</p>
                      <p className="text-xs text-slate-400">Record cash deposits, withdrawals, or inter-bank transfers to balance accounts.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const tDate = parseItemDate(t);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-primary-600 dark:text-primary-400 text-xs">
                        {t.transferNo}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {format(tDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {t.fromAccountName} <span className="text-slate-400 mx-1">→</span> {t.toAccountName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded font-bold text-[10px]">
                          {t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs font-display whitespace-nowrap">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <Modal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          title="Add Bank or Cash Account"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Account Display Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Current A/C or Shop Cash"
                value={accountForm.accountName}
                onChange={(e) => setAccountForm({...accountForm, accountName: e.target.value})}
                className="input-field text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Account Type</label>
                <select
                  value={accountForm.accountType}
                  onChange={(e) => setAccountForm({...accountForm, accountType: e.target.value})}
                  className="input-field text-xs font-semibold"
                >
                  <option value="Bank Account">Bank Account</option>
                  <option value="Cash Register">Cash Register</option>
                  <option value="Digital Wallet">Digital Wallet (UPI/Paytm)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.openingBalance}
                  onChange={(e) => setAccountForm({...accountForm, openingBalance: parseFloat(e.target.value) || 0})}
                  className="input-field text-xs font-bold text-right text-emerald-600"
                />
              </div>
            </div>

            {accountForm.accountType === 'Bank Account' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="HDFC, SBI, ICICI"
                      value={accountForm.bankName}
                      onChange={(e) => setAccountForm({...accountForm, bankName: e.target.value})}
                      className="input-field text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="HDFC0001234"
                      value={accountForm.ifscCode}
                      onChange={(e) => setAccountForm({...accountForm, ifscCode: e.target.value})}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={accountForm.accountNumber}
                    onChange={(e) => setAccountForm({...accountForm, accountNumber: e.target.value})}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Save Account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Contra Transfer Modal */}
      {showContraModal && (
        <Modal
          isOpen={showContraModal}
          onClose={() => setShowContraModal(false)}
          title="Contra Entry (Inter-Account Transfer)"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateContra} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">From Account (Source) *</label>
              <select
                required
                value={contraForm.fromAccountId}
                onChange={(e) => setContraForm({...contraForm, fromAccountId: e.target.value})}
                className="input-field text-xs font-semibold"
              >
                <option value="">Select source account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.accountName} ({formatCurrency(a.currentBalance ?? a.openingBalance ?? 0)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">To Account (Destination) *</label>
              <select
                required
                value={contraForm.toAccountId}
                onChange={(e) => setContraForm({...contraForm, toAccountId: e.target.value})}
                className="input-field text-xs font-semibold"
              >
                <option value="">Select destination account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.accountName} ({formatCurrency(a.currentBalance ?? a.openingBalance ?? 0)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={contraForm.amount}
                  onChange={(e) => setContraForm({...contraForm, amount: e.target.value})}
                  className="input-field text-xs font-bold text-right text-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={contraForm.date}
                  onChange={(e) => setContraForm({...contraForm, date: e.target.value})}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transfer Type</label>
              <select
                value={contraForm.type}
                onChange={(e) => setContraForm({...contraForm, type: e.target.value})}
                className="input-field text-xs font-semibold"
              >
                <option value="Bank to Cash">Cash Withdrawal (Bank to Cash)</option>
                <option value="Cash to Bank">Cash Deposit (Cash to Bank)</option>
                <option value="Bank to Bank">Inter-Bank Transfer</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowContraModal(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 text-xs py-2"
              >
                Confirm Transfer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Banking;
