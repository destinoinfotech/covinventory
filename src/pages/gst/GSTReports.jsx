import React, { useState, useEffect } from 'react';
import { db } from '../../lib/supabase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc 
} from '../../lib/supabase';
import { 
  FileCheck2, 
  Download, 
  FileSpreadsheet, 
  Truck, 
  QrCode, 
  Layers, 
  Search, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  DollarSign,
  TrendingUp,
  X,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { 
  aggregateGSTR1, 
  aggregateGSTR3B, 
  buildEWayBillJSON, 
  generateMockEInvoiceIRN 
} from '../../utils/taxEngine';

const GSTReports = () => {
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState('gstr1'); // 'gstr1', 'gstr3b', 'eway', 'einvoice'
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // E-Way Bill Form
  const [selectedInvoiceForEWay, setSelectedInvoiceForEWay] = useState('');
  const [transporterData, setTransporterData] = useState({
    name: 'Safe Cargo Logistics',
    id: '27AAACG0000A1Z5',
    vehicleNo: 'MH-04-AB-1234',
    distance: 120,
    docNo: `LR-${Date.now().toString().slice(-6)}`
  });

  // E-Invoice State
  const [selectedInvoiceForIRN, setSelectedInvoiceForIRN] = useState('');
  const [generatedIRN, setGeneratedIRN] = useState(null);

  useEffect(() => {
    if (!companyId) return;

    // 1. Fetch Company Settings
    const fetchCompany = async () => {
      try {
        const compSnap = await getDoc(doc(db, 'settings', companyId));
        if (compSnap.exists()) {
          setCompanyProfile(compSnap.data());
        } else {
          const cSnap = await getDoc(doc(db, 'companies', companyId));
          if (cSnap.exists()) setCompanyProfile(cSnap.data());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCompany();

    // 2. Live subscriptions
    const unsubSales = onSnapshot(query(collection(db, 'sales'), where('companyId', '==', companyId)), snap => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPur = onSnapshot(query(collection(db, 'purchases'), where('companyId', '==', companyId)), snap => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubExp = onSnapshot(query(collection(db, 'expenses'), where('companyId', '==', companyId)), snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubNotes = onSnapshot(query(collection(db, 'returns_notes'), where('companyId', '==', companyId)), snap => {
      setCreditNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubSales();
      unsubPur();
      unsubExp();
      unsubNotes();
    };
  }, [companyId]);

  const companyState = companyProfile?.state || 'Maharashtra';
  const gstr1Data = aggregateGSTR1(sales, creditNotes, companyState);
  const gstr3bData = aggregateGSTR3B(sales, purchases, expenses, companyState);

  // Download GSTR-1 JSON
  const downloadGSTR1JSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstr1Data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `GSTR1_${companyProfile?.gstin || 'GST'}_${new Date().toISOString().slice(0, 7)}.json`);
    dlAnchor.click();
    toast.success('GSTR-1 JSON downloaded!');
  };

  // Download GSTR-1 CSV
  const downloadGSTR1CSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Section,Invoice No,Date,Customer Name,GSTIN,Taxable Value,CGST,SGST,IGST,Invoice Value\n";
    
    gstr1Data.b2b.forEach(r => {
      csvContent += `B2B,${r.invoiceNo},${r.date},"${r.customerName}",${r.gstin},${r.taxableValue.toFixed(2)},${r.cgst.toFixed(2)},${r.sgst.toFixed(2)},${r.igst.toFixed(2)},${r.invoiceValue.toFixed(2)}\n`;
    });
    gstr1Data.b2cs.forEach(r => {
      csvContent += `B2CS,${r.invoiceNo},${r.date},"${r.customerName}",${r.gstin},${r.taxableValue.toFixed(2)},${r.cgst.toFixed(2)},${r.sgst.toFixed(2)},${r.igst.toFixed(2)},${r.invoiceValue.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GSTR1_Export_${new Date().toISOString().slice(0, 7)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('GSTR-1 CSV Exported!');
  };

  // Generate E-Way Bill JSON
  const handleGenerateEWayBill = () => {
    const inv = sales.find(s => s.id === selectedInvoiceForEWay);
    if (!inv) {
      toast.error('Please select an invoice');
      return;
    }
    const ewayJson = buildEWayBillJSON({
      invoice: inv,
      company: companyProfile || {},
      party: { name: inv.customerName, gstin: inv.customerGSTIN, address: inv.deliveryAddress },
      transporter: transporterData
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ewayJson, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `EWayBill_${inv.invoiceNumber || inv.invoiceNo}.json`);
    dlAnchor.click();
    toast.success('E-Way Bill JSON downloaded for NIC portal upload!');
  };

  // Generate E-Invoice Mock IRN
  const handleGenerateIRN = () => {
    const inv = sales.find(s => s.id === selectedInvoiceForIRN);
    if (!inv) {
      toast.error('Please select a B2B invoice');
      return;
    }
    const result = generateMockEInvoiceIRN(inv.invoiceNumber || inv.invoiceNo, companyProfile?.gstin || '27AAACG0000A1Z5', inv.date || new Date().toISOString());
    setGeneratedIRN(result);
    toast.success('E-Invoice IRN & Signed QR generated!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">GST Returns & Compliance Portal</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            GSTR-1 return filing tables, GSTR-3B summary, NIC E-Way Bill JSON generator, and E-Invoice IRN generation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadGSTR1CSV}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>CSV Export</span>
          </button>
          <button
            onClick={downloadGSTR1JSON}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download GSTR-1 JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('gstr1')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all",
            activeTab === 'gstr1'
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <FileCheck2 className="w-3.5 h-3.5" /> GSTR-1 Return (Sales)
        </button>
        <button
          onClick={() => setActiveTab('gstr3b')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all",
            activeTab === 'gstr3b'
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Layers className="w-3.5 h-3.5" /> GSTR-3B (Liability & ITC)
        </button>
        <button
          onClick={() => setActiveTab('eway')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all",
            activeTab === 'eway'
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Truck className="w-3.5 h-3.5" /> E-Way Bill Generator
        </button>
        <button
          onClick={() => setActiveTab('einvoice')}
          className={cn(
            "pb-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all",
            activeTab === 'einvoice'
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <QrCode className="w-3.5 h-3.5" /> E-Invoice (IRN & QR)
        </button>
      </div>

      {/* TAB 1: GSTR-1 BREAKDOWN */}
      {activeTab === 'gstr1' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">Total Taxable Value</span>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100 mt-1">
                {formatCurrency(gstr1Data.summary.totalTaxable)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Outward Supplies</p>
            </div>
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">CGST Collected</span>
              <h3 className="text-xl font-bold font-display text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(gstr1Data.summary.totalCGST)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Central Tax Liability</p>
            </div>
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">SGST Collected</span>
              <h3 className="text-xl font-bold font-display text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(gstr1Data.summary.totalSGST)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">State Tax Liability</p>
            </div>
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">IGST Collected</span>
              <h3 className="text-xl font-bold font-display text-indigo-600 dark:text-indigo-400 mt-1">
                {formatCurrency(gstr1Data.summary.totalIGST)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Interstate Tax Liability</p>
            </div>
          </div>

          {/* B2B Table */}
          <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
            <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 rounded text-[10px] font-bold">4A</span>
                B2B Invoices (Registered Customers with GSTIN)
              </h3>
              <span className="text-xs font-bold text-slate-400">{gstr1Data.b2b.length} Invoices</span>
            </div>

            {gstr1Data.b2b.length === 0 ? (
              <p className="text-xs text-slate-400 p-8 text-center">No B2B sales registered with customer GSTIN.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Invoice No</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Customer & GSTIN</th>
                      <th className="px-5 py-3.5">Place of Supply</th>
                      <th className="px-5 py-3.5 text-right">Taxable Val</th>
                      <th className="px-5 py-3.5 text-right">CGST</th>
                      <th className="px-5 py-3.5 text-right">SGST</th>
                      <th className="px-5 py-3.5 text-right">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {gstr1Data.b2b.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono font-bold text-primary-600">{r.invoiceNo}</td>
                        <td className="px-5 py-3.5 text-slate-500">{r.date}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-800 dark:text-white">{r.customerName}</span>
                          <span className="block font-mono text-[10px] text-slate-400">{r.gstin}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{r.placeOfSupply}</td>
                        <td className="px-5 py-3.5 text-right font-bold">{formatCurrency(r.taxableValue)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">{formatCurrency(r.cgst)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">{formatCurrency(r.sgst)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white font-display">{formatCurrency(r.invoiceValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* B2C Small Table */}
          <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
            <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded text-[10px] font-bold">7</span>
                B2C Small Invoices (Unregistered Retail Consumers)
              </h3>
              <span className="text-xs font-bold text-slate-400">{gstr1Data.b2cs.length} Invoices</span>
            </div>

            {gstr1Data.b2cs.length === 0 ? (
              <p className="text-xs text-slate-400 p-8 text-center">No B2C retail invoices recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Invoice No</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5 text-right">Taxable Val</th>
                      <th className="px-5 py-3.5 text-right">CGST</th>
                      <th className="px-5 py-3.5 text-right">SGST</th>
                      <th className="px-5 py-3.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {gstr1Data.b2cs.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono font-bold text-primary-600">{r.invoiceNo}</td>
                        <td className="px-5 py-3.5 text-slate-500">{r.date}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-white">{r.customerName}</td>
                        <td className="px-5 py-3.5 text-right font-bold">{formatCurrency(r.taxableValue)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">{formatCurrency(r.cgst)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">{formatCurrency(r.sgst)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white font-display">{formatCurrency(r.invoiceValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* HSN Summary (Section 12) */}
          <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
            <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 rounded text-[10px] font-bold">12</span>
                HSN-wise Summary of Outward Supplies
              </h3>
              <span className="text-xs font-bold text-slate-400">{gstr1Data.hsn.length} HSN Codes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[11px] font-bold uppercase text-slate-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-5 py-3.5">HSN Code</th>
                    <th className="px-5 py-3.5">Description</th>
                    <th className="px-5 py-3.5 text-center">Total Qty</th>
                    <th className="px-5 py-3.5 text-right">Taxable Value</th>
                    <th className="px-5 py-3.5 text-right">CGST</th>
                    <th className="px-5 py-3.5 text-right">SGST</th>
                    <th className="px-5 py-3.5 text-right">IGST</th>
                    <th className="px-5 py-3.5 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {gstr1Data.hsn.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-5 py-8 text-center text-slate-400 dark:text-zinc-500">
                        No outward supply HSN records found for this period.
                      </td>
                    </tr>
                  ) : (
                    gstr1Data.hsn.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{h.hsn}</td>
                        <td className="px-5 py-3.5 text-slate-800 dark:text-zinc-200 font-medium">{h.desc}</td>
                        <td className="px-5 py-3.5 text-center font-bold text-slate-700 dark:text-zinc-300">{h.totalQty} {h.unit}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(h.taxableValue)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500 dark:text-zinc-400">{formatCurrency(h.cgst)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500 dark:text-zinc-400">{formatCurrency(h.sgst)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500 dark:text-zinc-400">{formatCurrency(h.igst || 0)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white font-display">{formatCurrency(h.totalValue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GSTR-3B SUMMARY */}
      {activeTab === 'gstr3b' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outward Tax Liability (3.1)</span>
              <h3 className="text-2xl font-bold font-display text-indigo-600 dark:text-indigo-400 mt-1">
                {formatCurrency(gstr3bData.outward.totalTax)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Total GST collected on Sales</p>
            </div>

            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Eligible Input Tax Credit (4A)</span>
              <h3 className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(gstr3bData.itc.totalTax)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Purchases & Expenses ITC claim</p>
            </div>

            <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net GST Payable (5.1)</span>
              <h3 className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(gstr3bData.netPayable.total)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">After adjusting eligible ITC credit</p>
            </div>
          </div>

          <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm">
            <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Table 3.1 & Table 4 Tax Schedule Breakdown</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Nature of Supply</th>
                    <th className="px-5 py-3.5 text-right">Taxable Value</th>
                    <th className="px-5 py-3.5 text-right">Integrated Tax (IGST)</th>
                    <th className="px-5 py-3.5 text-right">Central Tax (CGST)</th>
                    <th className="px-5 py-3.5 text-right">State Tax (SGST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      3.1 (a) Outward Taxable supplies (other than zero rated)
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold">{formatCurrency(gstr3bData.outward.taxable)}</td>
                    <td className="px-5 py-3.5 text-right text-indigo-600 font-bold">{formatCurrency(gstr3bData.outward.igst)}</td>
                    <td className="px-5 py-3.5 text-right text-primary-600 font-bold">{formatCurrency(gstr3bData.outward.cgst)}</td>
                    <td className="px-5 py-3.5 text-right text-primary-600 font-bold">{formatCurrency(gstr3bData.outward.sgst)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      4. (A) Eligible Input Tax Credit (All other ITC)
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold">{formatCurrency(gstr3bData.itc.taxable)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-bold">{formatCurrency(gstr3bData.itc.igst)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-bold">{formatCurrency(gstr3bData.itc.cgst)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-bold">{formatCurrency(gstr3bData.itc.sgst)}</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-800/40 font-bold">
                    <td className="px-5 py-3.5 text-slate-900 dark:text-white">
                      5.1 Net Tax Payable in Cash
                    </td>
                    <td className="px-5 py-3.5 text-right">---</td>
                    <td className="px-5 py-3.5 text-right text-indigo-600">{formatCurrency(gstr3bData.netPayable.igst)}</td>
                    <td className="px-5 py-3.5 text-right text-primary-600">{formatCurrency(gstr3bData.netPayable.cgst)}</td>
                    <td className="px-5 py-3.5 text-right text-primary-600">{formatCurrency(gstr3bData.netPayable.sgst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: E-WAY BILL GENERATOR */}
      {activeTab === 'eway' && (
        <div className="card p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" /> NIC E-Way Bill JSON Generator
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate government-compliant E-Way Bill JSON for consignment movement greater than ₹50,000.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Select Invoice (Value &gt; ₹50,000 recommended) *
                </label>
                <select
                  value={selectedInvoiceForEWay}
                  onChange={(e) => setSelectedInvoiceForEWay(e.target.value)}
                  className="input-field text-xs font-semibold"
                >
                  <option value="">Choose sales invoice...</option>
                  {sales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.invoiceNumber || s.invoiceNo} - {s.customerName} ({formatCurrency(s.grandTotal || s.total || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={transporterData.name}
                    onChange={(e) => setTransporterData({...transporterData, name: e.target.value})}
                    className="input-field text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Transporter GSTIN / ID</label>
                  <input
                    type="text"
                    value={transporterData.id}
                    onChange={(e) => setTransporterData({...transporterData, id: e.target.value})}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={transporterData.vehicleNo}
                    onChange={(e) => setTransporterData({...transporterData, vehicleNo: e.target.value})}
                    className="input-field text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Distance (KM Approx)</label>
                  <input
                    type="number"
                    value={transporterData.distance}
                    onChange={(e) => setTransporterData({...transporterData, distance: parseInt(e.target.value) || 0})}
                    className="input-field text-xs font-bold"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateEWayBill}
                disabled={!selectedInvoiceForEWay}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                <Download className="w-4 h-4" /> Export E-Way Bill JSON for NIC Portal
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">How to Upload to ewaybillgst.gov.in</h4>
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4">
                <li>Select the invoice and vehicle transport details on the left.</li>
                <li>Click <strong>Export E-Way Bill JSON</strong> to download the standard payload file.</li>
                <li>Log in to the official <a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer" className="text-primary-600 underline font-bold">ewaybillgst.gov.in</a> portal.</li>
                <li>Go to <strong>E-Waybill &gt; Generate Bulk</strong> and upload the downloaded JSON file.</li>
                <li>Your official E-Way Bill is generated immediately without manual typing!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: E-INVOICE (IRN & QR) */}
      {activeTab === 'einvoice' && (
        <div className="card p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600" /> B2B E-Invoicing (IRN & Signed QR Code)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate 64-character Invoice Reference Number (IRN) and B2B Signed QR code for GST compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Select B2B Sales Invoice *
                </label>
                <select
                  value={selectedInvoiceForIRN}
                  onChange={(e) => setSelectedInvoiceForIRN(e.target.value)}
                  className="input-field text-xs font-semibold"
                >
                  <option value="">Choose invoice...</option>
                  {sales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.invoiceNumber || s.invoiceNo} - {s.customerName} ({formatCurrency(s.grandTotal || s.total || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateIRN}
                disabled={!selectedInvoiceForIRN}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                <QrCode className="w-4 h-4" /> Generate E-Invoice IRN & Signed QR
              </button>
            </div>

            {/* Generated Output */}
            {generatedIRN && (
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> IRN Generated Successfully
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">64-Character IRN Hash:</span>
                  <span className="text-xs font-mono font-bold break-all text-slate-900 dark:text-white">
                    {generatedIRN.irn}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Ack Number</span>
                    <span className="font-mono font-bold">{generatedIRN.ackNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Ack Date</span>
                    <span className="font-mono">{new Date(generatedIRN.ackDate).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col items-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(generatedIRN.signedQR)}`}
                    alt="Signed QR"
                    className="w-28 h-28 border p-1 rounded-xl bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1">Signed B2B QR Code for Invoice Print</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTReports;
