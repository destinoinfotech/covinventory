import React, { useState, useEffect } from 'react';
import { 
  db, 
  createSecondaryAuth,
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  getDocs, 
  where, 
  orderBy, 
  limit, 
  writeBatch 
} from '../../lib/supabase';
import { 
  Building2, 
  Plus, 
  Search, 
  UserPlus, 
  Shield, 
  Mail, 
  Key, 
  Loader2, 
  ArrowRight,
  Package,
  Users,
  Settings as SettingsIcon,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  ExternalLink,
  User,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { cn, formatCurrency } from '../../lib/utils';

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qComp = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const unsubComp = onSnapshot(qComp, (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const counts = {};
      snapshot.docs.forEach(doc => {
        const cid = doc.data().companyId;
        if (cid) counts[cid] = (counts[cid] || 0) + 1;
      });
      setUserCounts(counts);
      setLoading(false);
    });

    return () => {
      unsubComp();
      unsubUsers();
    };
  }, []);

  const handleManageCompany = (company) => {
    setSelectedCompany(company);
    setShowManageModal(true);
  };

  const handleDeleteCompanyClick = (company) => {
    setCompanyToDelete(company);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    setDeleting(true);
    try {
      const compId = companyToDelete.id;
      
      // Cascading deletion list for collections scoped by companyId
      const collectionsToClean = [
        'stock_adjustments',
        'stock_transfers',
        'sales_returns',
        'purchase_returns',
        'delivery_challans',
        'quotations',
        'sales',
        'purchases',
        'products',
        'categories',
        'units',
        'godowns',
        'transactions',
        'expenses',
        'orders',
        'coupons',
        'people',
        'accounts',
        'settings'
      ];

      for (const collName of collectionsToClean) {
        try {
          const q = query(collection(db, collName), where('companyId', '==', compId));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await deleteDoc(doc(db, collName, d.id));
          }
        } catch (err) {
          console.warn(`Error cleaning collection ${collName}:`, err);
        }
      }

      // Delete non-superadmin users belonging to this company
      try {
        const uQuery = query(collection(db, 'users'), where('companyId', '==', compId));
        const uSnap = await getDocs(uQuery);
        for (const uDoc of uSnap.docs) {
          if (uDoc.data()?.role !== 'superadmin') {
            await deleteDoc(doc(db, 'users', uDoc.id));
          }
        }
      } catch (err) {
        console.warn("Error deleting tenant users:", err);
      }

      // Finally delete the company itself
      await deleteDoc(doc(db, 'companies', compId));

      toast.success(`Company "${companyToDelete.name}" and all associated records deleted successfully.`);
      setShowDeleteModal(false);
      setShowManageModal(false);
      setSelectedCompany(null);
      setCompanyToDelete(null);
    } catch (error) {
      console.error("Failed to delete company:", error);
      toast.error(error.message || 'Failed to delete company.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalActive = companies.filter(c => c.status === 'active').length;
  const totalSuspended = companies.filter(c => c.status === 'suspended').length;
  const totalUsers = Object.values(userCounts).reduce((acc, count) => acc + count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black font-display text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              Superadmin Control Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Manage tenant companies, license states, and global administrative access.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 shadow-sm"
        >
          <Building2 className="w-4 h-4" />
          <span>Register New Company</span>
        </button>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Companies</p>
            <span className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-100/60 dark:border-primary-900/40">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-2">{companies.length}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Tenant organizations</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Active Companies</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/40">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{totalActive}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Operating normally</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Registered Users</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/60 dark:border-blue-900/40">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{totalUsers}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Total staff & admins</p>
        </div>

        <div className="card p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Suspended</p>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/60 dark:border-rose-900/40">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{totalSuspended}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Locked / suspended</p>
        </div>
      </div>

      {/* Companies List */}
      <div className="card border border-slate-200/80 dark:border-zinc-800/80 p-0 shadow-sm overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search companies by name or ID..."
              className="input-field pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
            Showing <strong className="text-slate-800 dark:text-zinc-200">{filteredCompanies.length}</strong> of {companies.length} companies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-zinc-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 text-center w-14">#</th>
                <th className="px-6 py-3.5">Company Name</th>
                <th className="px-6 py-3.5">Members</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
              {filteredCompanies.map((company, index) => (
                <tr key={company.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-zinc-700 group-hover:text-primary-600 transition-colors border border-slate-200/60 dark:border-zinc-700">
                          <Building2 className="w-4 h-4" />
                       </div>
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm">{company.name}</span>
                         <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{company.id}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Users className="w-3.5 h-3.5 text-slate-400" />
                       <span className="font-bold text-slate-700 dark:text-zinc-300">
                         {userCounts[company.id] || 0}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {company.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <XCircle className="w-3 h-3" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleManageCompany(company)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                      >
                        Manage <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCompanyClick(company)}
                        title="Delete Company"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400 dark:text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>No companies found matching "{searchTerm}"</p>
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
        title="Register Company & Master Admin"
      >
        <AddCompanyForm onSuccess={() => setShowAddModal(false)} />
      </Modal>

      <Modal 
        isOpen={showManageModal} 
        onClose={() => setShowManageModal(false)}
        title="Manage Company Details"
        maxWidth="max-w-3xl"
      >
        {selectedCompany && (
          <ManageCompanyTabs 
            company={selectedCompany} 
            onUpdate={(updated) => {
              setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
              setSelectedCompany(updated);
            }}
            onDelete={() => handleDeleteCompanyClick(selectedCompany)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="Delete Company"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/50 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">Permanent Action Warning</h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                You are about to permanently delete <strong>{companyToDelete?.name}</strong>. This will erase all products, sales records, invoices, staff accounts, and configurations associated with this company.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-zinc-400">
            This action <strong>cannot be undone</strong>. Please confirm you want to proceed.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setShowDeleteModal(false)}
              className="btn-secondary flex-1 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="flex-[1.5] py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Company</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const ManageCompanyTabs = ({ company, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState('details');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('details')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg font-bold transition-all",
            activeTab === 'details' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          )}
        >
          <SettingsIcon className="w-3.5 h-3.5" /> Details & Admin
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg font-bold transition-all",
            activeTab === 'members' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          )}
        >
          <Users className="w-3.5 h-3.5" /> Staff Members
        </button>
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'details' ? (
          <CompanyDetailsForm company={company} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <CompanyMembersList companyId={company.id} />
        )}
      </div>
    </div>
  );
};

const CompanyDetailsForm = ({ company, onUpdate, onDelete }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingAdmin, setFetchingAdmin] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [formData, setFormData] = useState({
    name: company.name || '',
    status: company.status || 'active',
    adminName: '',
    adminEmail: ''
  });

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('companyId', '==', company.id),
          where('role', '==', 'admin'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const adminData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setAdminUser(adminData);
          setFormData(prev => ({
            ...prev,
            adminName: adminData.name || '',
            adminEmail: adminData.email || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching admin:", error);
      } finally {
        setFetchingAdmin(false);
      }
    };
    fetchAdmin();
  }, [company.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = writeBatch(db);

      const companyRef = doc(db, 'companies', company.id);
      batch.update(companyRef, {
        name: formData.name,
        status: formData.status
      });

      if (adminUser) {
        const userRef = doc(db, 'users', adminUser.id);
        batch.update(userRef, {
          name: formData.adminName,
          email: formData.adminEmail 
        });
      }

      await batch.commit();
      
      toast.success('Company and Admin updated successfully');
      onUpdate({ ...company, name: formData.name, status: formData.status });
    } catch (error) {
      toast.error('Failed to update details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingAdmin) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Section */}
        <div className="space-y-3 p-4 bg-slate-50/80 dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-primary-600" /> Company Info
          </h3>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Company Name</label>
            <input
              required
              className="input-field text-xs"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Account Status</label>
            <select
              className="input-field text-xs font-semibold"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Master Admin Section */}
        <div className="space-y-3 p-4 bg-primary-50/30 dark:bg-primary-950/20 rounded-2xl border border-primary-100/60 dark:border-primary-900/30">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Master Admin Details
          </h3>
          {adminUser ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Admin Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    className="input-field pl-9 text-xs"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Admin Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    className="input-field pl-9 text-xs"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Firestore reference email.
                </p>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
              No admin account found for this company.
            </div>
          )}
        </div>
      </div>
      
      <button 
        type="submit" 
        disabled={loading}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-xs shadow-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Global Changes'}
      </button>

      {/* Danger Zone */}
      {onDelete && (
        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
              </p>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                Permanently delete this company and all its data.
              </p>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="py-2 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Company
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

const CompanyMembersList = ({ companyId }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const q = query(collection(db, 'users'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [companyId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      <p className="text-slate-400 text-xs font-semibold">Fetching members...</p>
    </div>
  );

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {members.map(member => (
        <div key={member.id} className="flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm",
              member.role === 'admin' ? "bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200/40" : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
            )}>
              {member.name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs">{member.name}</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">{member.email}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              member.role === 'admin' ? "bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200/60 dark:border-primary-900/60" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
            )}>
              {member.role}
            </span>
            <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">{member.id}</span>
          </div>
        </div>
      ))}
      {members.length === 0 && (
        <div className="text-center py-10 text-slate-400 dark:text-zinc-500 text-xs">
          No members found for this company.
        </div>
      )}
    </div>
  );
};

const AddCompanyForm = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailQuery = query(collection(db, 'users'), where('email', '==', formData.adminEmail.trim()));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        toast.error('Email already exists! Please use a different email.');
        setLoading(false);
        return;
      }

      const companyId = crypto.randomUUID();

      // Create Company in public.companies
      await setDoc(doc(db, 'companies', companyId), {
        id: companyId,
        name: formData.companyName.trim(),
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      // Create Initial Company Settings
      await setDoc(doc(db, 'settings', companyId), {
        id: companyId,
        companyId: companyId,
        businessName: formData.companyName.trim(),
        email: formData.adminEmail.trim(),
        createdAt: new Date().toISOString()
      });

      // Register Master Admin in Supabase Auth
      const secondaryAuth = createSecondaryAuth();
      const res = await secondaryAuth.createUser(formData.adminEmail.trim(), formData.adminPassword, {
        name: formData.adminName.trim(),
        role: 'admin',
        company_id: companyId
      });

      const adminUserId = res?.user?.id || crypto.randomUUID();

      // Create Master Admin profile in public.users
      await setDoc(doc(db, 'users', adminUserId), {
        id: adminUserId,
        name: formData.adminName.trim(),
        email: formData.adminEmail.trim(),
        role: 'admin',
        companyId: companyId,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
      toast.success('Company and Admin created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-slate-50/80 dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
           <Building2 className="w-3.5 h-3.5 text-primary-600" /> Company Information
        </h3>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Company / Business Name *</label>
          <input 
            required 
            className="input-field text-xs"
            placeholder="Global Tech Solutions"
            value={formData.companyName}
            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
          />
        </div>
      </div>

      <div className="p-4 bg-primary-50/30 dark:bg-primary-950/20 rounded-2xl border border-primary-100/60 dark:border-primary-900/30">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-3 flex items-center gap-2">
           <Shield className="w-3.5 h-3.5" /> Master Admin Details
        </h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Admin Full Name *</label>
            <div className="relative">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                required 
                className="input-field pl-9 text-xs"
                placeholder="John Admin"
                value={formData.adminName}
                onChange={(e) => setFormData({...formData, adminName: e.target.value})}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email"
                  required 
                  className="input-field pl-9 text-xs"
                  placeholder="admin@company.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Password *</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required 
                  className="input-field pl-9 text-xs font-mono"
                  placeholder="••••••••"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 flex gap-3">
        <button 
          type="button" 
          disabled={loading}
          onClick={() => onSuccess()} 
          className="btn-secondary flex-1 text-xs"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary flex-[2] flex items-center justify-center gap-2 py-3 text-xs shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Company & Admin'}
        </button>
      </div>
    </form>
  );
};

export default SuperAdminDashboard;
