import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jmgglejmljalszuzdvwo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZ2dsZWptbGphbHN6dXpkdndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTQ3MDgsImV4cCI6MjEwNzAzMDcwOH0.-o9k1Ypv5FJi_tzCOAVOX1QeAujaE7Gs2PW6Wkxt5fE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper to convert camelCase to snake_case for PostgreSQL
export const toSnakeCase = (str) => {
  if (!str) return str;
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
};

// Helper to convert snake_case to camelCase
export const toCamelCase = (str) => {
  if (!str) return str;
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
};

// Transform JS object keys to snake_case for DB insert/update
export const objectToSnake = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value instanceof Date) {
        newObj[toSnakeCase(key)] = value.toISOString();
      } else {
        newObj[toSnakeCase(key)] = value;
      }
    }
  }
  return newObj;
};

// Transform DB row to camelCase for React components
export const objectToCamel = (row) => {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(objectToCamel);
  const newObj = {};
  for (const [key, value] of Object.entries(row)) {
    newObj[toCamelCase(key)] = value;
  }
  // Ensure id is always present
  if (row.id) newObj.id = row.id;
  return newObj;
};

// ==============================================================================
// Firestore -> Supabase Compatibility Adapter
// Allows seamless operation across the 40+ UI components without regressions
// ==============================================================================

class SupabaseDocRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
  }
}

class SupabaseCollectionRef {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }
}

class SupabaseQuery {
  constructor(collectionRef) {
    this.collectionName = collectionRef.collectionName;
    this.clauses = [];
    this.orderings = [];
    this.limitCount = null;
  }
}

export const collection = (dbInstance, collectionName) => {
  return new SupabaseCollectionRef(collectionName);
};

export const doc = (dbInstance, collectionName, id) => {
  if (dbInstance instanceof SupabaseCollectionRef) {
    return new SupabaseDocRef(dbInstance.collectionName, collectionName);
  }
  const finalId = id || crypto.randomUUID();
  return new SupabaseDocRef(collectionName, finalId);
};

export const where = (field, op, value) => {
  return { type: 'where', field: toSnakeCase(field), op, value };
};

export const orderBy = (field, direction = 'asc') => {
  return { type: 'orderBy', field: toSnakeCase(field), ascending: direction.toLowerCase() === 'asc' };
};

export const limit = (n) => {
  return { type: 'limit', value: n };
};

export const query = (colRef, ...constraints) => {
  const q = new SupabaseQuery(colRef);
  for (const c of constraints) {
    if (!c) continue;
    if (c.type === 'where') q.clauses.push(c);
    if (c.type === 'orderBy') q.orderings.push(c);
    if (c.type === 'limit') q.limitCount = c.value;
  }
  return q;
};

// Build Supabase select query from Query or CollectionRef
const buildSelectQuery = (target) => {
  const tableName = target.collectionName;
  let q = supabase.from(tableName).select('*');

  if (target instanceof SupabaseQuery) {
    for (const clause of target.clauses) {
      const { field, op, value } = clause;
      if (op === '==' || op === '===') q = q.eq(field, value);
      else if (op === '!=') q = q.neq(field, value);
      else if (op === '>') q = q.gt(field, value);
      else if (op === '>=') q = q.gte(field, value);
      else if (op === '<') q = q.lt(field, value);
      else if (op === '<=') q = q.lte(field, value);
      else if (op === 'in') q = q.in(field, Array.isArray(value) ? value : [value]);
      else if (op === 'array-contains') q = q.contains(field, [value]);
    }

    for (const ord of target.orderings) {
      q = q.order(ord.field, { ascending: ord.ascending });
    }

    if (target.limitCount) {
      q = q.limit(target.limitCount);
    }
  }

  return q;
};

// ==============================================================================
// High-Performance Query & Document In-Memory Cache (SWR)
// ==============================================================================
const queryCache = new Map();
const docCache = new Map();
const CACHE_TTL_MS = 5000; // 5s fresh TTL with stale-while-revalidate

const getQueryCacheKey = (target) => {
  if (target instanceof SupabaseDocRef) {
    return `doc:${target.collectionName}:${target.id}`;
  }
  const parts = [target.collectionName];
  if (target instanceof SupabaseQuery) {
    target.clauses.forEach(c => parts.push(`${c.field}_${c.op}_${c.value}`));
    target.orderings.forEach(o => parts.push(`${o.field}_${o.ascending}`));
    if (target.limitCount) parts.push(`lim_${target.limitCount}`);
  }
  return parts.join('|');
};

const invalidateCollectionCache = (collectionName) => {
  for (const key of queryCache.keys()) {
    if (key.startsWith(collectionName) || key.startsWith(`doc:${collectionName}:`)) {
      queryCache.delete(key);
    }
  }
  for (const key of docCache.keys()) {
    if (key.startsWith(`${collectionName}:`)) {
      docCache.delete(key);
    }
  }
};

// ==============================================================================
// Shared Realtime Table Channels Manager
// ==============================================================================
const tableListeners = new Map();
const activeChannels = new Map();

const subscribeToTable = (tableName, callback) => {
  if (!tableListeners.has(tableName)) {
    tableListeners.set(tableName, new Set());
  }
  tableListeners.get(tableName).add(callback);

  if (!activeChannels.has(tableName)) {
    const channel = supabase
      .channel(`table_${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          invalidateCollectionCache(tableName);
          const listeners = tableListeners.get(tableName);
          if (listeners) {
            listeners.forEach(cb => {
              try { cb(); } catch (e) { console.warn('Listener error:', e); }
            });
          }
        }
      )
      .subscribe();
    activeChannels.set(tableName, channel);
  }

  return () => {
    const listeners = tableListeners.get(tableName);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        tableListeners.delete(tableName);
        const chan = activeChannels.get(tableName);
        if (chan) {
          supabase.removeChannel(chan);
          activeChannels.delete(tableName);
        }
      }
    }
  };
};

export const getDocs = async (target) => {
  const cacheKey = getQueryCacheKey(target);
  const cached = queryCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  const { data, error } = await buildSelectQuery(target);
  if (error) {
    console.warn(`Supabase getDocs error on ${target.collectionName}:`, error.message);
    if (cached) return cached.result;
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: (cb) => {}
    };
  }

  const docs = (data || []).map((row) => {
    const camelData = objectToCamel(row);
    return {
      id: row.id,
      exists: () => true,
      data: () => camelData
    };
  });

  const result = {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb)
  };

  queryCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
};

export const getDoc = async (docRef) => {
  const cacheKey = `${docRef.collectionName}:${docRef.id}`;
  const cached = docCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  const { data, error } = await supabase
    .from(docRef.collectionName)
    .select('*')
    .eq('id', docRef.id)
    .maybeSingle();

  if (error || !data) {
    const emptyResult = {
      id: docRef.id,
      exists: () => false,
      data: () => null
    };
    return emptyResult;
  }

  const camelData = objectToCamel(data);
  const result = {
    id: data.id,
    exists: () => true,
    data: () => camelData
  };

  docCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
};

export const setDoc = async (docRef, data, options = {}) => {
  const rowData = objectToSnake({ ...data, id: docRef.id });
  rowData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from(docRef.collectionName)
    .upsert(rowData, { onConflict: 'id' });

  if (error) {
    console.error(`Supabase setDoc error on ${docRef.collectionName}:`, error);
    throw error;
  }
  invalidateCollectionCache(docRef.collectionName);
};

export const addDoc = async (colRef, data) => {
  const id = crypto.randomUUID();
  const rowData = objectToSnake({ ...data, id });
  rowData.created_at = new Date().toISOString();
  rowData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from(colRef.collectionName)
    .insert([rowData]);

  if (error) {
    console.error(`Supabase addDoc error on ${colRef.collectionName}:`, error);
    throw error;
  }
  invalidateCollectionCache(colRef.collectionName);
  return new SupabaseDocRef(colRef.collectionName, id);
};

export const updateDoc = async (docRef, data) => {
  const rowData = objectToSnake(data);
  rowData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from(docRef.collectionName)
    .update(rowData)
    .eq('id', docRef.id);

  if (error) {
    console.error(`Supabase updateDoc error on ${docRef.collectionName}:`, error);
    throw error;
  }
  invalidateCollectionCache(docRef.collectionName);
};

export const deleteDoc = async (docRef) => {
  const { error } = await supabase
    .from(docRef.collectionName)
    .delete()
    .eq('id', docRef.id);

  if (error) {
    console.error(`Supabase deleteDoc error on ${docRef.collectionName}:`, error);
    throw error;
  }
  invalidateCollectionCache(docRef.collectionName);
};

export const writeBatch = (dbInstance) => {
  const operations = [];

  return {
    set: (docRef, data) => {
      operations.push({ type: 'set', docRef, data });
    },
    update: (docRef, data) => {
      operations.push({ type: 'update', docRef, data });
    },
    delete: (docRef) => {
      operations.push({ type: 'delete', docRef });
    },
    commit: async () => {
      const collectionsAffected = new Set();
      for (const op of operations) {
        collectionsAffected.add(op.docRef.collectionName);
        if (op.type === 'set') {
          await setDoc(op.docRef, op.data);
        } else if (op.type === 'update') {
          await updateDoc(op.docRef, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(op.docRef);
        }
      }
      collectionsAffected.forEach(c => invalidateCollectionCache(c));
    }
  };
};

export const onSnapshot = (target, onNext, onError) => {
  let isCancelled = false;

  // Immediate cached hydration (0ms render!)
  const cacheKey = getQueryCacheKey(target);
  if (target instanceof SupabaseDocRef) {
    const docKey = `${target.collectionName}:${target.id}`;
    const cachedDoc = docCache.get(docKey);
    if (cachedDoc) {
      onNext(cachedDoc.result);
    }
  } else {
    const cachedQuery = queryCache.get(cacheKey);
    if (cachedQuery) {
      onNext(cachedQuery.result);
    }
  }

  const fetchData = async () => {
    try {
      if (target instanceof SupabaseDocRef) {
        const snap = await getDoc(target);
        if (!isCancelled) onNext(snap);
      } else {
        const snap = await getDocs(target);
        if (!isCancelled) onNext(snap);
      }
    } catch (err) {
      if (!isCancelled && onError) onError(err);
    }
  };

  // Perform background network revalidation
  fetchData();

  // Shared channel subscription
  const tableName = target.collectionName;
  const unsubscribe = subscribeToTable(tableName, () => {
    if (!isCancelled) fetchData();
  });

  return () => {
    isCancelled = true;
    unsubscribe();
  };
};

export const db = {
  // Mock db object for adapter compatibility
  name: 'supabase_db'
};

// Authentication compatibility helpers
export const onAuthStateChanged = (authInstance, callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(session?.user || null);
  });
  return () => subscription?.unsubscribe();
};

export const signInWithEmailAndPassword = async (authInstance, email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session };
};

export const createUserWithEmailAndPassword = async (authInstance, email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session };
};

export const signOut = async (authInstance) => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Firestore helper types
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n) => n;
export const arrayUnion = (...elements) => elements;
export const arrayRemove = (...elements) => elements;
export const Timestamp = {
  now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  fromDate: (date) => ({ toDate: () => date, toMillis: () => date.getTime() })
};

export const auth = {
  currentUser: null,
  signOut
};

export const createSecondaryAuth = () => {
  return {
    createUser: async (email, password, userMetadata = {}) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata
        }
      });
      if (error) throw error;
      return data;
    }
  };
};

export const initializeApp = () => ({});
export const getApp = () => ({});
export const getAuth = () => auth;
export const getFirestore = () => db;

export default supabase;

