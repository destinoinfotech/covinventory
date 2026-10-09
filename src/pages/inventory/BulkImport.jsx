import React, { useState } from 'react';
import Papa from 'papaparse';
import { db } from '../../lib/supabase';
import { collection, writeBatch, doc } from '../../lib/supabase';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const BulkImport = ({ onComplete, onCancel }) => {
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const downloadSample = () => {
    const csv = Papa.unparse([
      {
        "Product Name": "Example Product",
        "SKU/Code": "EX-101",
        "Category": "Electronics",
        "Unit": "pcs",
        "Buying Price": "1000",
        "Selling Price": "1500",
        "GST %": "18",
        "Stock Quantity": "50",
        "Low Stock Threshold": "10"
      }
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory_sample.csv';
    link.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateData(results.data);
      }
    });
  };

  const validateData = (rows) => {
    const validatedData = [];
    const validationErrors = [];

    rows.forEach((row, index) => {
      const error = {};
      if (!row["Product Name"]) error.name = "Missing Name";
      if (!row["SKU/Code"]) error.sku = "Missing SKU";
      
      const sellingPrice = parseFloat(row["Selling Price"]);
      const buyingPrice = parseFloat(row["Buying Price"]);
      
      if (isNaN(sellingPrice)) error.sellingPrice = "Invalid Price";
      if (isNaN(buyingPrice)) error.buyingPrice = "Invalid Price";

      validatedData.push({
        name: row["Product Name"],
        sku: row["SKU/Code"],
        category: row["Category"] || 'Others',
        unit: row["Unit"] || 'pcs',
        buyingPrice: buyingPrice || 0,
        sellingPrice: sellingPrice || 0,
        gstPercent: parseInt(row["GST %"]) || 18,
        stock: parseInt(row["Stock Quantity"]) || 0,
        lowStockThreshold: parseInt(row["Low Stock Threshold"]) || 10,
        error: Object.keys(error).length > 0 ? error : null
      });

      if (Object.keys(error).length > 0) {
        validationErrors.push({ row: index + 1, error });
      }
    });

    setData(validatedData);
    setErrors(validationErrors);
  };

  const handleImport = async () => {
    const validRows = data.filter(d => !d.error);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      validRows.forEach(row => {
        const productRef = doc(collection(db, 'products'));
        const { error, ...productData } = row;
        batch.set(productRef, { ...productData, createdAt: new Date() });
      });
      await batch.commit();
      toast.success(`Successfully imported ${validRows.length} products`);
      onComplete();
    } catch (error) {
      toast.error('Failed to import products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary-50/50 dark:bg-primary-950/20 rounded-2xl border border-primary-100/60 dark:border-primary-900/40 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-600 rounded-xl text-white shadow-sm">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">Sample CSV Template</h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Download formatted CSV template for batch product upload.</p>
          </div>
        </div>
        <button 
          onClick={downloadSample}
          className="btn-secondary text-xs font-bold py-2 shadow-sm"
        >
          Download Sample
        </button>
      </div>

      {!data.length ? (
        <div className="relative border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-colors hover:border-primary-500 group bg-slate-50/50 dark:bg-zinc-900/50">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            id="csv-upload"
          />
          <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110">
            <Upload className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">Upload CSV file</h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">Drag and drop or click to select your inventory spreadsheet.</p>
          <label htmlFor="csv-upload" className="mt-4 px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 z-20 shadow-sm">
            Browse Files
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs sm:text-sm flex items-center gap-2 text-slate-900 dark:text-zinc-100">
              <span>Preview Data ({data.length} items)</span>
              {errors.length > 0 && <span className="text-[10px] px-2 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full font-bold">{errors.length} errors</span>}
            </h4>
            <button onClick={() => setData([])} className="text-xs text-rose-500 hover:text-rose-600 font-bold">Clear All</button>
          </div>

          <div className="max-h-[350px] overflow-auto border border-slate-200/80 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 dark:bg-zinc-900/80 sticky top-0 shadow-sm text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Selling (₹)</th>
                  <th className="py-2.5 px-3 text-center">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {data.map((row, i) => (
                  <tr key={i} className={row.error ? "bg-rose-50/50 dark:bg-rose-950/20" : "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"}>
                    <td className="py-2.5 px-3">
                      {row.error ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-zinc-200">{row.name || <span className="text-rose-500 font-bold">MISSING</span>}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400">{row.sku || <span className="text-rose-500 font-bold">MISSING</span>}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold uppercase">{row.category}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{row.sellingPrice}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{row.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button 
              onClick={onCancel}
              className="btn-secondary flex-1 text-xs"
            >
              Cancel
            </button>
            <button 
              onClick={handleImport}
              disabled={loading || data.filter(d => !d.error).length === 0}
              className="btn-primary flex-[2] text-xs flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${data.filter(d => !d.error).length} Products`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImport;
