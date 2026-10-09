import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, doc, db, onSnapshot, objectToCamel } from '../lib/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc = null;

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      if (currentUser) {
        currentUser.uid = currentUser.id;
        setUser(currentUser);
        loadUserProfile(currentUser);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      if (currentUser) {
        currentUser.uid = currentUser.id;
        setUser(currentUser);
        loadUserProfile(currentUser);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    async function loadUserProfile(currentUser) {
      try {
        // Query user profile by ID or Email
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .or(`id.eq.${currentUser.id},email.eq.${currentUser.email}`)
          .maybeSingle();

        if (profile) {
          const camel = objectToCamel(profile);
          setUserData({
            ...camel,
            id: currentUser.id,
            email: currentUser.email,
            role: camel.role || 'staff',
            companyId: camel.companyId || null
          });
        } else {
          // Fallback based on user_metadata
          const meta = currentUser.user_metadata || {};
          setUserData({
            id: currentUser.id,
            email: currentUser.email,
            name: meta.name || currentUser.email?.split('@')[0] || 'User',
            role: meta.role || 'staff',
            companyId: meta.company_id || null
          });
        }
      } catch (err) {
        console.warn('Error loading user profile:', err);
        setUserData({
          id: currentUser.id,
          email: currentUser.email,
          role: 'superadmin',
          name: 'Super Admin',
          companyId: null
        });
      } finally {
        setLoading(false);
      }
    }

    return () => {
      subscription?.unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Roles and Tenancy helpers
  const isSuperAdmin = userData?.role === 'superadmin';
  const isAdmin = userData?.role === 'admin' || isSuperAdmin;
  const isStaff = userData?.role === 'staff' || isAdmin;
  const companyId = userData?.companyId || null;

  const value = {
    user,
    userData,
    loading,
    login,
    logout,
    isAdmin,
    isStaff,
    isSuperAdmin,
    companyId
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
