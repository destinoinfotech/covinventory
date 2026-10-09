import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/supabase';
import { collection, query, where, getDocs, doc, getDoc } from '../../lib/supabase';
import { 
  Barcode, 
  Printer, 
  Search, 
  Plus, 
  Minus, 
  Layers, 
  CheckSquare, 
  Square,
  QrCode,
  Tag,
  Store,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  RefreshCw,
  Box,
  Eye,
  Trash2,
  Settings2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

// Subcomponent for Optical SVG Barcode
const BarcodeRenderer = ({ value, format = 'CODE128', height = 30, width = 1.4, fontSize = 10, displayValue = true }) => {
  const svgRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    setHasError(false);
    
    let cleanVal = String(value || '').trim();
    if (!cleanVal) cleanVal = 'ITEM001';
    
    // Strip non-printable ASCII for Code 128 safety
    cleanVal = cleanVal.replace(/[^\x20-\x7E]/g, '');
    if (!cleanVal) cleanVal = 'ITEM001';

    try {
      JsBarcode(svgRef.current, cleanVal, {
        format: format === 'EAN13' && /^\d{13}$/.test(cleanVal) ? 'EAN13' : 'CODE128',
        width: width,
        height: height,
        displayValue: displayValue,
        fontSize: fontSize,
        margin: 2,
        font: 'JetBrains Mono, monospace',
        textMargin: 2,
        lineColor: '#000000',
        background: '#ffffff'
      });
    } catch (e) {
      try {
        // Fallback with standardized formatting
        JsBarcode(svgRef.current, cleanVal.slice(0, 16), {
          format: 'CODE128',
          width: 1.1,
          height: height,
          displayValue: displayValue,
          fontSize: fontSize,
          margin: 1,
          font: 'JetBrains Mono, monospace',
          lineColor: '#000000',
          background: '#ffffff'
        });
      } catch (err) {
        console.warn('Barcode generation warning:', err);
        setHasError(true);
      }
    }
  }, [value, format, height, width, fontSize, displayValue]);

  if (hasError) {
    return <span className="text-[10px] font-mono text-slate-600 block py-1">{value || '---'}</span>;
  }

  return (
    <div className="w-full flex justify-center items-center overflow-hidden py-0.5">
      <svg ref={svgRef} className="max-w-full h-auto block mx-auto select-none" />
    </div>
  );
};

// Subcomponent for Crisp QR Code
const QRCodeRenderer = ({ value, size = 52 }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(String(value), {
      width: Math.max(120, size * 2),
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => setDataUrl(url)).catch(err => console.error(err));
  }, [value, size]);

  if (!dataUrl) {
    return <div className="w-10 h-10 bg-slate-100 animate-pulse rounded my-0.5 mx-auto" />;
  }

  return (
    <div className="flex justify-center items-center my-0.5">
      <img 
        src={dataUrl} 
        alt={value} 
        style={{ width: `${size}px`, height: `${size}px`, maxWidth: '100%' }} 
        className="object-contain image-rendering-pixelated block mx-auto"
      />
    </div>
  );
};

// Label Layout Preset Definitions
const LABEL_TEMPLATES = {
  '24-a4': {
    id: '24-a4',
    name: '24-Up Sheet (A4)',
    dimensions: '70 × 37 mm',
    desc: '3 Cols × 8 Rows • Standard Box / Retail Label',
    type: 'sheet',
    cols: 3,
    rows: 8,
    perPage: 24,
    gridClass: 'grid-cols-3',
    printGridClass: 'grid-cols-3',
    minHeight: '120px',
    barcodeHeight: 28,
    barcodeWidth: 1.4,
    qrSize: 52,
    padding: 'p-2.5',
    nameSize: 'text-[11px]',
    priceSize: 'text-xs',
    companySize: 'text-[9px]'
  },
  '40-a4': {
    id: '40-a4',
    name: '40-Up Sheet (A4)',
    dimensions: '48.5 × 25.4 mm',
    desc: '4 Cols × 10 Rows • Compact Shelf & Rack Tags',
    type: 'sheet',
    cols: 4,
    rows: 10,
    perPage: 40,
    gridClass: 'grid-cols-4',
    printGridClass: 'grid-cols-4',
    minHeight: '90px',
    barcodeHeight: 20,
    barcodeWidth: 1.1,
    qrSize: 38,
    padding: 'p-1.5',
    nameSize: 'text-[9px]',
    priceSize: 'text-[10px]',
    companySize: 'text-[8px]'
  },
  '12-a4': {
    id: '12-a4',
    name: '12-Up Sheet (A4)',
    dimensions: '105 × 48 mm',
    desc: '2 Cols × 6 Rows • Large Shipping / Box Labels',
    type: 'sheet',
    cols: 2,
    rows: 6,
    perPage: 12,
    gridClass: 'grid-cols-2',
    printGridClass: 'grid-cols-2',
    minHeight: '150px',
    barcodeHeight: 44,
    barcodeWidth: 1.8,
    qrSize: 68,
    padding: 'p-3.5',
    nameSize: 'text-xs font-bold',
    priceSize: 'text-sm font-black',
    companySize: 'text-[10px]'
  },
  '65-a4': {
    id: '65-a4',
    name: '65-Up Sheet (A4)',
    dimensions: '38.1 × 21.2 mm',
    desc: '5 Cols × 13 Rows • Jewelry / Mini Hardware Tags',
    type: 'sheet',
    cols: 5,
    rows: 13,
    perPage: 65,
    gridClass: 'grid-cols-5',
    printGridClass: 'grid-cols-5',
    minHeight: '75px',
    barcodeHeight: 16,
    barcodeWidth: 0.9,
    qrSize: 30,
    padding: 'p-1',
    nameSize: 'text-[8px] leading-tight',
    priceSize: 'text-[9px] font-bold',
    companySize: 'text-[7px]'
  },
  'thermal-50x25': {
    id: 'thermal-50x25',
    name: 'Thermal Roll (50 × 25 mm)',
    dimensions: '2" × 1"',
    desc: 'Continuous Roll • TSC, Zebra, TVS, Xprinter POS',
    type: 'thermal',
    cols: 1,
    rows: 1,
    perPage: 1,
    gridClass: 'grid-cols-1 max-w-[260px] mx-auto',
    printGridClass: 'grid-cols-1',
    minHeight: '96px',
    barcodeHeight: 22,
    barcodeWidth: 1.2,
    qrSize: 42,
    padding: 'p-2',
    nameSize: 'text-[10px]',
    priceSize: 'text-xs',
    companySize: 'text-[8px]'
  },
  'thermal-50x38': {
    id: 'thermal-50x38',
    name: 'Thermal Roll (50 × 38 mm)',
    dimensions: '2" × 1.5"',
    desc: 'Continuous Roll • Apparel & Retail Price Tag',
    type: 'thermal',
    cols: 1,
    rows: 1,
    perPage: 1,
    gridClass: 'grid-cols-1 max-w-[280px] mx-auto',
    printGridClass: 'grid-cols-1',
    minHeight: '130px',
    barcodeHeight: 32,
    barcodeWidth: 1.4,
    qrSize: 52,
    padding: 'p-2.5',
    nameSize: 'text-xs',
    priceSize: 'text-xs font-black',
    companySize: 'text-[9px]'
  }
};

const BarcodeGenerator = () => {
  const { companyId, userData } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItems, setSelectedItems] = useState({}); // { [productId]: count }
  
  // Customization States
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128'); // 'CODE128' or 'QR'
  const [templateId, setTemplateId] = useState('24-a4');
  const [includePrice, setIncludePrice] = useState(true);
  const [includeOrgName, setIncludeOrgName] = useState(true);
  const [includeSku, setIncludeSku] = useState(true);
  const [includeBarcodeText, setIncludeBarcodeText] = useState(true);
  const [customHeader, setCustomHeader] = useState('');
  const [customFooterNote, setCustomFooterNote] = useState('');
  const [borderStyle, setBorderStyle] = useState('dashed'); // 'dashed', 'solid', 'none'
  const [companyProfile, setCompanyProfile] = useState(null);

  // Preview Mode & Pagination States
  const [previewTab, setPreviewTab] = useState('sheet'); // 'sheet' or 'inspector'
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);

  const activeTemplate = LABEL_TEMPLATES[templateId] || LABEL_TEMPLATES['24-a4'];

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Load products
        const q = query(collection(db, 'products'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(list);

        // Load company profile
        const compSnap = await getDoc(doc(db, 'companies', companyId));
        if (compSnap.exists()) {
          const cData = compSnap.data();
          setCompanyProfile(cData);
          setCustomHeader(cData.companyName || cData.businessName || 'Covinventory Store');
        } else {
          setCustomHeader('Covinventory Store');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  // Categories list
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Bulk Selection Helpers
  const selectAll = () => {
    const all = {};
    products.forEach(p => { all[p.id] = 1; });
    setSelectedItems(all);
    toast.success(`Selected ${products.length} products (1 label each)`);
  };

  const matchStockQuantities = () => {
    const all = {};
    let count = 0;
    products.forEach(p => {
      const stock = Math.max(1, parseInt(p.currentStock ?? p.stockQuantity ?? p.stock ?? 1));
      all[p.id] = stock;
      count += stock;
    });
    setSelectedItems(all);
    toast.success(`Matched inventory counts: ${count} total labels ready`);
  };

  const clearSelection = () => {
    setSelectedItems({});
  };

  const updateCount = (pId, delta) => {
    setSelectedItems(prev => {
      const current = prev[pId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[pId];
        return copy;
      }
      return { ...prev, [pId]: next };
    });
  };

  const setCountDirect = (pId, val) => {
    const num = parseInt(val) || 0;
    setSelectedItems(prev => {
      if (num <= 0) {
        const copy = { ...prev };
        delete copy[pId];
        return copy;
      }
      return { ...prev, [pId]: num };
    });
  };

  const handlePrint = () => {
    if (printableLabels.length === 0) {
      toast.error('Please select at least one product label to print.');
      return;
    }
    window.print();
  };

  // Generate flat printable labels array based on counts
  const printableLabels = [];
  Object.entries(selectedItems).forEach(([pId, count]) => {
    const prod = products.find(p => p.id === pId);
    if (prod && count > 0) {
      for (let i = 0; i < count; i++) {
        printableLabels.push(prod);
      }
    }
  });

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q) || 
      p.barcode?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);
    
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate Sheets Pagination for Preview
  const perPage = activeTemplate.type === 'thermal' ? 1 : activeTemplate.perPage;
  const totalSheets = Math.max(1, Math.ceil(printableLabels.length / perPage));

  // Ensure currentSheetIndex is valid
  useEffect(() => {
    if (currentSheetIndex >= totalSheets) {
      setCurrentSheetIndex(Math.max(0, totalSheets - 1));
    }
  }, [totalSheets, currentSheetIndex]);

  // Items for the active sheet in preview
  const activeSheetStart = currentSheetIndex * perPage;
  const activeSheetLabels = printableLabels.slice(activeSheetStart, activeSheetStart + perPage);

  // Helper renderer for a single sticker item
  const renderStickerContent = (p, idx, isInspector = false) => {
    const codeVal = p.barcode || p.sku || `SKU-${(p.id || 'ITEM').slice(0, 6).toUpperCase()}`;
    const borderClass = borderStyle === 'dashed' 
      ? 'border border-dashed border-slate-300 dark:border-zinc-700' 
      : borderStyle === 'solid' 
      ? 'border border-slate-300 dark:border-zinc-700' 
      : 'border border-transparent';

    const paddingClass = isInspector ? 'p-6' : activeTemplate.padding;
    const nameClass = isInspector ? 'text-base font-bold' : activeTemplate.nameSize;
    const priceClass = isInspector ? 'text-lg font-black' : activeTemplate.priceSize;
    const companyClass = isInspector ? 'text-xs font-black' : activeTemplate.companySize;
    const bHeight = isInspector ? 46 : activeTemplate.barcodeHeight;
    const bWidth = isInspector ? 1.8 : activeTemplate.barcodeWidth;
    const qSize = isInspector ? 90 : activeTemplate.qrSize;

    return (
      <div 
        key={idx}
        className={cn(
          "rounded-md flex flex-col items-center justify-between text-center bg-white text-slate-900 select-none shadow-sm transition-all overflow-hidden box-border",
          paddingClass,
          borderClass
        )}
        style={{ 
          minHeight: isInspector ? '220px' : activeTemplate.minHeight,
          width: '100%'
        }}
      >
        {/* Top Company Header */}
        <div className="w-full">
          {includeOrgName && customHeader && (
            <span className={cn("font-black uppercase tracking-wider text-slate-600 truncate w-full block mb-0.5", companyClass)}>
              {customHeader}
            </span>
          )}

          {/* Product Title */}
          <span className={cn("font-bold text-slate-900 line-clamp-2 w-full block leading-tight", nameClass)}>
            {p.name || 'Sample Product'}
          </span>
        </div>

        {/* Optical Barcode / QR Code */}
        <div className="w-full my-auto flex flex-col items-center justify-center">
          {barcodeFormat === 'QR' ? (
            <QRCodeRenderer value={codeVal} size={qSize} />
          ) : (
            <BarcodeRenderer 
              value={codeVal} 
              height={bHeight} 
              width={bWidth}
              fontSize={activeTemplate.id === '40-a4' || activeTemplate.id === '65-a4' ? 8 : 10}
              displayValue={includeBarcodeText}
            />
          )}

          {includeSku && !includeBarcodeText && (
            <span className="text-[9px] font-mono tracking-wider text-slate-600 block mt-0.5">
              {codeVal}
            </span>
          )}
        </div>

        {/* Bottom Price & Optional Footer Note */}
        <div className="w-full mt-0.5">
          {includePrice && (
            <span className={cn("font-black text-slate-950 block tabular-nums", priceClass)}>
              MRP: {formatCurrency(p.sellingPrice || p.price || 0)}
            </span>
          )}

          {customFooterNote && (
            <span className="text-[8px] font-medium text-slate-500 block truncate w-full leading-tight mt-0.5">
              {customFooterNote}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print Specific CSS Stylesheet */}
      <style>{`
        @media screen {
          #barcode-print-container {
            display: none !important;
          }
        }
        @media print {
          @page {
            margin: ${activeTemplate.type === 'thermal' ? '0' : '4mm'} !important;
            size: ${activeTemplate.type === 'thermal' ? 'auto' : 'A4 portrait'} !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          #barcode-print-container,
          #barcode-print-container * {
            visibility: visible !important;
          }
          #barcode-print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .print-sheet-page {
            page-break-after: always !important;
            break-after: page !important;
            min-height: 100vh;
            box-sizing: border-box;
            background: #ffffff !important;
          }
          .print-sheet-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .print-label-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Screen Header (Hidden on Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-200/50 dark:border-primary-800/40">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              Barcode & Label Studio
              <span className="badge badge-neutral text-[10px] font-mono">PRO STUDIO</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Generate, preview, and print 100% scannable Code128 & QR stickers for sheets and thermal printers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={printableLabels.length === 0}
            className="btn-primary py-2.5 px-5 flex items-center gap-2 text-xs font-semibold shadow-md shadow-slate-900/10 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            Print {printableLabels.length} Label{printableLabels.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Main Workspace (Hidden on Print) */}
      <div className="no-print grid grid-cols-12 gap-6">
        {/* Left Column: Product Selection & Batch Counts (5 Cols) */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Product Selector Card */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Select Products ({products.length})
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400 px-2 py-1 rounded-md transition-colors"
                >
                  All (1x)
                </button>
                <button
                  type="button"
                  onClick={matchStockQuantities}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-1 rounded-md transition-colors"
                  title="Set label quantities matching available stock in warehouse"
                >
                  Match Stock
                </button>
                {Object.keys(selectedItems).length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-1 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Search & Category Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, SKU, barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-8 text-xs py-1.5"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field text-xs py-1.5"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Products List with Fast Counters */}
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-[340px] overflow-y-auto pr-1 space-y-0.5">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary-600" />
                  <span>Loading product catalog...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No products matching your search criteria.
                </div>
              ) : (
                filteredProducts.map(p => {
                  const count = selectedItems[p.id] || 0;
                  const stockQty = parseInt(p.currentStock ?? p.stockQuantity ?? p.stock ?? 0);
                  const codeVal = p.barcode || p.sku || 'No-Code';

                  return (
                    <div 
                      key={p.id} 
                      className={cn(
                        "py-2 px-2 rounded-lg flex items-center justify-between transition-colors",
                        count > 0 ? "bg-primary-50/40 dark:bg-primary-950/20" : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>{codeVal}</span>
                          <span>•</span>
                          <span className="text-slate-500 font-sans">Stock: <strong className="text-slate-700 dark:text-zinc-300">{stockQty}</strong></span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">{formatCurrency(p.sellingPrice || p.price || 0)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCount(p.id, -1)}
                          className="w-6 h-6 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md flex items-center justify-center text-xs font-bold text-slate-600 dark:text-zinc-300 transition-colors"
                          title="Decrease count"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={count || ''}
                          placeholder="0"
                          onChange={(e) => setCountDirect(p.id, e.target.value)}
                          className="w-11 text-center text-xs font-bold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md py-0.5 text-slate-900 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() => updateCount(p.id, 1)}
                          className="w-6 h-6 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/50 dark:hover:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-md flex items-center justify-center text-xs font-bold transition-colors"
                          title="Increase count"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Label Configuration Settings */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
              <Sliders className="w-4 h-4 text-primary-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Label Layout & Paper Template
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Paper / Sheet Preset
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="input-field text-xs py-1.5"
                >
                  {Object.values(LABEL_TEMPLATES).map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.dimensions})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 truncate">
                  {activeTemplate.desc}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Barcode Format
                </label>
                <select
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value)}
                  className="input-field text-xs py-1.5"
                >
                  <option value="CODE128">Code 128 (Universal Barcode)</option>
                  <option value="QR">QR Code (2D Matrix)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {barcodeFormat === 'CODE128' ? 'High-density 1D optical barcode' : 'Fast 2D smartphone & scanner QR'}
                </p>
              </div>
            </div>

            {/* Content Display Toggles */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Label Content Elements
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOrgName}
                    onChange={(e) => setIncludeOrgName(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>Store Name Header</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePrice}
                    onChange={(e) => setIncludePrice(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>Selling Price / MRP</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSku}
                    onChange={(e) => setIncludeSku(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>SKU / Product Code</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBarcodeText}
                    onChange={(e) => setIncludeBarcodeText(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>Barcode Text Label</span>
                </label>
              </div>
            </div>

            {/* Custom Texts & Border Options */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {includeOrgName && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                    Custom Store Header
                  </label>
                  <input
                    type="text"
                    value={customHeader}
                    onChange={(e) => setCustomHeader(e.target.value)}
                    placeholder="e.g. Apex Traders"
                    className="input-field text-xs py-1"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                  Sticker Border Outline
                </label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value)}
                  className="input-field text-xs py-1"
                >
                  <option value="dashed">Dashed Line (Cutting Guide)</option>
                  <option value="solid">Solid Line</option>
                  <option value="none">None (Pre-cut Sticker Sheet)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                  Optional Footer Tag / Note (e.g. "Incl. of all taxes" or Batch info)
                </label>
                <input
                  type="text"
                  value={customFooterNote}
                  onChange={(e) => setCustomFooterNote(e.target.value)}
                  placeholder="e.g. Incl. of all taxes • Non-returnable"
                  className="input-field text-xs py-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Sheet & Single Label Preview (7 Cols) */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm min-h-[600px] flex flex-col">
            {/* Preview Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('sheet')}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      previewTab === 'sheet' 
                        ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm" 
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                    )}
                  >
                    Sheet Layout
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('inspector')}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      previewTab === 'inspector' 
                        ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm" 
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                    )}
                  >
                    Sticker Inspector
                  </button>
                </div>

                <div className="hidden sm:block">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {printableLabels.length} queued • {activeTemplate.dimensions}
                  </span>
                </div>
              </div>

              {/* Controls: Zoom & Pagination */}
              <div className="flex items-center gap-2">
                {previewTab === 'sheet' && totalSheets > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg text-xs font-medium">
                    <button
                      type="button"
                      disabled={currentSheetIndex === 0}
                      onClick={() => setCurrentSheetIndex(prev => Math.max(0, prev - 1))}
                      className="p-0.5 hover:bg-white dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono px-1">
                      Page {currentSheetIndex + 1} / {totalSheets}
                    </span>
                    <button
                      type="button"
                      disabled={currentSheetIndex >= totalSheets - 1}
                      onClick={() => setCurrentSheetIndex(prev => Math.min(totalSheets - 1, prev + 1))}
                      className="p-0.5 hover:bg-white dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printableLabels.length === 0}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Now
                </button>
              </div>
            </div>

            {/* Preview Viewport */}
            {printableLabels.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                  <Barcode className="w-6 h-6 stroke-1 text-slate-400" />
                </div>
                <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">No stickers selected yet</p>
                <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                  Use the product list on the left to add quantities or click <strong>"All (1x)"</strong> or <strong>"Match Stock"</strong> to preview your printable stickers.
                </p>
              </div>
            ) : previewTab === 'inspector' ? (
              /* Single Sticker Magnifier View */
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100/70 dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div className="max-w-xs w-full bg-white p-2 rounded-2xl shadow-xl border border-slate-200">
                  {renderStickerContent(printableLabels[0], 0, true)}
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    High-Definition Inspection Preview
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Exact proportions for {activeTemplate.name} ({activeTemplate.dimensions})
                  </p>
                </div>
              </div>
            ) : (
              /* Authentic Sheet Layout View */
              <div className="bg-slate-100/70 dark:bg-zinc-950 p-4 sm:p-6 rounded-xl overflow-x-auto border border-slate-200/80 dark:border-zinc-800 flex justify-center">
                {/* Paper Sheet Container */}
                <div 
                  className={cn(
                    "bg-white text-slate-900 rounded-lg shadow-md border border-slate-200 box-border p-4 transition-all",
                    activeTemplate.type === 'thermal' ? "max-w-[320px] w-full" : "w-full max-w-[650px]"
                  )}
                  style={{ minHeight: '440px' }}
                >
                  {/* Sheet Header info tag */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 text-[10px] text-slate-400 font-mono">
                    <span>{activeTemplate.name} • {activeTemplate.dimensions}</span>
                    <span>Showing {activeSheetLabels.length} of {printableLabels.length}</span>
                  </div>

                  {/* Stickers Grid */}
                  <div className={cn("grid gap-2", activeTemplate.gridClass)}>
                    {activeSheetLabels.map((p, idx) => renderStickerContent(p, idx, false))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DEDICATED ISOLATED PRINT ENGINE (Rendered on window.print()) */}
      <div id="barcode-print-container">
        {Array.from({ length: totalSheets }).map((_, sheetIdx) => {
          const start = sheetIdx * perPage;
          const sheetItems = printableLabels.slice(start, start + perPage);

          return (
            <div 
              key={sheetIdx}
              className={cn(
                "print-sheet-page w-full bg-white text-black",
                activeTemplate.type === 'thermal' ? "p-0" : "p-2"
              )}
            >
              <div 
                className={cn(
                  "grid gap-2 w-full bg-white text-black",
                  activeTemplate.printGridClass
                )}
              >
                {sheetItems.map((p, idx) => {
                  const codeVal = p.barcode || p.sku || `SKU-${(p.id || 'ITEM').slice(0, 6).toUpperCase()}`;
                  const borderClass = borderStyle === 'dashed' 
                    ? 'border border-dashed border-black' 
                    : borderStyle === 'solid' 
                    ? 'border border-black' 
                    : 'border border-transparent';

                  return (
                    <div 
                      key={idx}
                      className={cn(
                        "print-label-item rounded flex flex-col items-center justify-between text-center bg-white text-black box-border overflow-hidden",
                        activeTemplate.padding,
                        borderClass
                      )}
                      style={{ 
                        minHeight: activeTemplate.minHeight,
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid'
                      }}
                    >
                      {/* Company Header */}
                      <div className="w-full">
                        {includeOrgName && customHeader && (
                          <span className={cn("font-black uppercase tracking-wider text-black truncate w-full block mb-0.5", activeTemplate.companySize)}>
                            {customHeader}
                          </span>
                        )}

                        {/* Product Name */}
                        <span className={cn("font-bold text-black line-clamp-2 w-full block leading-tight", activeTemplate.nameSize)}>
                          {p.name}
                        </span>
                      </div>

                      {/* Optical Barcode / QR Code */}
                      <div className="w-full my-auto flex flex-col items-center justify-center">
                        {barcodeFormat === 'QR' ? (
                          <QRCodeRenderer value={codeVal} size={activeTemplate.qrSize} />
                        ) : (
                          <BarcodeRenderer 
                            value={codeVal} 
                            height={activeTemplate.barcodeHeight} 
                            width={activeTemplate.barcodeWidth}
                            fontSize={activeTemplate.id === '40-a4' || activeTemplate.id === '65-a4' ? 8 : 10}
                            displayValue={includeBarcodeText}
                          />
                        )}

                        {includeSku && !includeBarcodeText && (
                          <span className="text-[9px] font-mono tracking-wider text-black block mt-0.5">
                            {codeVal}
                          </span>
                        )}
                      </div>

                      {/* MRP Price & Custom Note */}
                      <div className="w-full mt-0.5">
                        {includePrice && (
                          <span className={cn("font-black text-black block tabular-nums", activeTemplate.priceSize)}>
                            MRP: {formatCurrency(p.sellingPrice || p.price || 0)}
                          </span>
                        )}

                        {customFooterNote && (
                          <span className="text-[8px] font-medium text-black block truncate w-full leading-tight mt-0.5">
                            {customFooterNote}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarcodeGenerator;
