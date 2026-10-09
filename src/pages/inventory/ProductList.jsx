import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc,
  where
} from '../../lib/supabase';
import { db } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Filter, 
  Upload,
  Layers,
  Barcode,
  ArrowRightLeft,
  Calendar,
  Clock,
  Warehouse
} from 'lucide-react';
import { formatCurrency, formatIndianNumber, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import ProductForm from './ProductForm';
import BulkImport from './BulkImport';
import { Link } from 'react-router-dom';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { isAdmin, companyId } = useAuth();
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, 'products'), 
      where('companyId', '==', companyId)
    );
    
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const productData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productData);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error in ProductList:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      toast.success('Product deleted successfully');
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  // Helper to check expiry status (within 30 days or expired)
  const getExpiryStatus = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Expired', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' };
    if (diffDays <= 30) return { label: `Expiring in ${diffDays}d`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return null;
  };

  const filteredProducts = products.filter(product => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = product.name?.toLowerCase().includes(q) || 
                          product.sku?.toLowerCase().includes(q) ||
                          product.barcode?.toLowerCase().includes(q) ||
                          product.batchNumber?.toLowerCase().includes(q) ||
                          product.brand?.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black font-display text-slate-900 dark:text-zinc-100 tracking-tight">
              Products & Inventory Master
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Track catalog items, stock levels, pricing, batches, barcodes, and warehouse godowns in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/inventory/barcodes"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Barcode className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span>Barcodes</span>
          </Link>
          <Link
            to="/inventory/adjustments"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Adjust Stock</span>
          </Link>
          <Link
            to="/inventory/godowns"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Warehouse className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Godowns</span>
          </Link>
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-1.5 text-xs py-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Products</p>
            <span className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-100/60 dark:border-primary-900/40">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-2">{products.length}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Catalog items tracked</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Low Stock Alert</p>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-emerald-100/60 dark:border-amber-900/40">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)).length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Below minimum threshold</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Out of Stock</p>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/60 dark:border-rose-900/40">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {products.filter(p => (p.stock || 0) <= 0).length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Immediate reorder required</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Inventory Valuation</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/40">
              <Barcode className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(products.reduce((sum, p) => sum + ((p.stock || 0) * (p.buyingPrice || p.sellingPrice || 0)), 0))}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Total stock asset value</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm bg-white dark:bg-zinc-900 rounded-2xl">
        <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by name, SKU, barcode, brand, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-8 text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field py-1.5 px-2.5 text-xs w-auto font-medium h-9"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-zinc-900/80 border-b border-slate-100 dark:border-zinc-800">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="px-6 py-3.5">Product & SKU</th>
                <th className="px-6 py-3.5">Category & Brand</th>
                <th className="px-6 py-3.5">Batch / Expiry</th>
                <th className="px-6 py-3.5">Pricing & GST</th>
                <th className="px-6 py-3.5">Stock Level</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
              {filteredProducts.map((product) => {
                const expStatus = getExpiryStatus(product.expiryDate);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm">{product.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-400 dark:text-zinc-500 font-mono text-[11px]">
                          <span>SKU: {product.sku || '---'}</span>
                          {product.hsn && <span>• HSN: {product.hsn}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-full text-[10px] font-bold w-fit border border-slate-200/60 dark:border-zinc-700">
                          {product.category || 'General'}
                        </span>
                        {product.brand && (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Brand: {product.brand}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.batchNumber || product.expiryDate ? (
                        <div className="flex flex-col gap-1">
                          {product.batchNumber && (
                            <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-zinc-300">
                              Batch: {product.batchNumber}
                            </span>
                          )}
                          {expStatus ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${expStatus.color}`}>
                              {expStatus.label}
                            </span>
                          ) : product.expiryDate ? (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">Exp: {product.expiryDate}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600 text-[11px]">---</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          Sell: {formatCurrency(product.sellingPrice)}
                        </span>
                        {isAdmin && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                            Buy: {formatCurrency(product.buyingPrice)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          GST: {product.gstPercent || 18}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-black text-xs sm:text-sm",
                          product.stock <= 0 
                            ? "text-rose-500 dark:text-rose-400" 
                            : product.stock <= (product.lowStockThreshold || 10) 
                              ? "text-amber-500 dark:text-amber-400" 
                              : "text-slate-900 dark:text-zinc-100"
                        )}>
                          {formatIndianNumber(product.stock || 0)} {product.unit || 'pcs'}
                        </span>
                        {product.secondaryUnit && (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                            (~{(product.stock / (product.conversionFactor || 1)).toFixed(1)} {product.secondaryUnit})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => setEditingProduct(product)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                          title="Edit product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteClick(product)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400 dark:text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <Layers className="w-8 h-8 opacity-20" />
                      <p>No products found matching "{searchTerm}"</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        title="Add New Product"
        maxWidth="max-w-2xl"
      >
        <ProductForm 
          onSuccess={() => setShowAddModal(false)} 
          onCancel={() => setShowAddModal(false)} 
        />
      </Modal>

      <Modal 
        isOpen={!!editingProduct} 
        onClose={() => setEditingProduct(null)}
        title="Edit Product"
        maxWidth="max-w-2xl"
      >
        <ProductForm 
          initialData={editingProduct}
          onSuccess={() => setEditingProduct(null)} 
          onCancel={() => setEditingProduct(null)} 
        />
      </Modal>

      <Modal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        title="Bulk Import Products"
        maxWidth="max-w-3xl"
      >
        <BulkImport 
          onComplete={() => setShowImportModal(false)} 
          onCancel={() => setShowImportModal(false)} 
        />
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Product Deletion"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/60 dark:border-rose-900/40 text-xs">
            <Trash2 className="w-5 h-5 shrink-0" />
            <p>
              Are you sure you want to delete <span className="font-bold">"{productToDelete?.name}"</span>? 
              This will permanently remove the product from catalog inventory.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setShowDeleteModal(false)}
              className="btn-secondary flex-1 text-xs"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDelete}
              className="flex-[2] py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
            >
              Delete Product
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductList;
