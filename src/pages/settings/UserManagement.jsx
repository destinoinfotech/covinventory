import React, { useState, useEffect } from 'react';
import { 
  db, 
  createSecondaryAuth, 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  where, 
  getDocs 
} from '../../lib/supabase';
import { 
  User, 
  Shield, 
  UserCog, 
  Trash2, 
  Mail, 
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user: currentUser, companyId } = useAuth();

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, 'users'),
      where('companyId', '==', companyId)
    );
    
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId]);

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser.uid) {
      toast.error("You cannot change your own role!");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        name: selectedUser.name
      });
      toast.success('User updated successfully');
      setShowEditModal(false);
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDeleteClick = (user) => {
    if (user.id === currentUser.uid) {
      toast.error("You cannot delete yourself!");
      return;
    }
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      toast.success('User removed from management');
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-zinc-100">Staff & Team Management</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Manage administrative permissions, cashier roles, and team access.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="card overflow-hidden border border-slate-200/80 dark:border-zinc-800 p-0 shadow-sm bg-white dark:bg-zinc-900 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-zinc-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center font-bold text-sm border border-primary-200/40 dark:border-primary-900/40">
                        {u.name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm">
                          {u.name || 'Anonymous User'} {u.id === currentUser.uid && <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">(You)</span>}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      disabled={u.id === currentUser.uid}
                      value={u.role || 'staff'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary-500/20 outline-none"
                    >
                      <option value="admin">Admin (Full Access)</option>
                      <option value="staff">Staff (Cashier / Billing)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEditClick(u)}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Edit profile"
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(u)}
                        disabled={u.id === currentUser.uid}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-20"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Staff Profile"
      >
        <AddStaffForm onSuccess={() => setShowAddModal(false)} />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User Profile"
      >
        {selectedUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  className="input-field pl-9 text-xs"
                  value={selectedUser.name}
                  onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Email (Read-only)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  disabled
                  className="input-field pl-9 opacity-50 text-xs"
                  value={selectedUser.email}
                />
              </div>
            </div>
            <div className="pt-3 flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowEditModal(false)} 
                className="btn-secondary flex-1 text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary flex-[2] text-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Remove Staff Access"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/60 dark:border-rose-900/40 text-xs">
            <Trash2 className="w-5 h-5 shrink-0" />
            <p>
              Are you sure you want to remove dashboard access for <span className="font-bold">"{userToDelete?.name}"</span>?
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
              Remove Access
            </button>
          </div>
        </div>
      </Modal>

      <div className="p-4 bg-primary-50/50 dark:bg-primary-950/20 rounded-2xl border border-primary-100/60 dark:border-primary-900/40 flex gap-3 text-xs">
        <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-primary-900 dark:text-primary-200">Admin Privileges & Multi-user Security</p>
          <p className="text-primary-700 dark:text-primary-400 leading-relaxed">
            As an Administrator, you can create new staff accounts directly. Each staff member will have isolated credentials and role permissions.
          </p>
        </div>
      </div>
    </div>
  );
};

const AddStaffForm = ({ onSuccess }) => {
  const { companyId } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if email already exists
      const emailQuery = query(collection(db, 'users'), where('email', '==', formData.email));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        toast.error('Email already exists! Please use a different email.');
        setLoading(false);
        return;
      }

      const secondaryAuth = createSecondaryAuth();
      const res = await secondaryAuth.createUser(formData.email, formData.password, {
        name: formData.name,
        role: formData.role,
        company_id: companyId
      });
      
      const newUserId = res?.user?.id || crypto.randomUUID();
      // Ensure user profile doc exists in users table
      await setDoc(doc(db, 'users', newUserId), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        companyId,
        createdAt: new Date().toISOString()
      });
      
      toast.success('Staff account created successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Full Name *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            required
            className="input-field pl-9 text-xs"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="John Doe"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Email Address *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="email"
            required
            className="input-field pl-9 text-xs"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="staff@example.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Temporary Password *</label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="password"
            required
            className="input-field pl-9 text-xs font-mono"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">System Role *</label>
        <select 
          className="input-field text-xs font-semibold"
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
        >
          <option value="staff">Staff (Billing & Orders)</option>
          <option value="admin">Admin (Full Access)</option>
        </select>
      </div>

      <div className="pt-3 flex gap-3">
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
          className="btn-primary flex-[2] flex items-center justify-center gap-2 text-xs"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
        </button>
      </div>
    </form>
  );
};

export default UserManagement;
