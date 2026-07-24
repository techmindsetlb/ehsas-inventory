/**
 * Data management layer.
 * Provides CRUD operations, search, filter, export, and caching.
 */
const DB = (() => {
  // In-memory data store
  let data = {
    products: [],
    categories: [],
    statuses: [],
    sales: [],
    usage: [],
    notes: [],
    settings: {}
  };
  let isDirty = false;
  let lastSavedData = '';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  function now() {
    return new Date().toISOString();
  }

  async function load() {
    const remote = await GitHubAPI.getData();
    if (remote) {
      data = { ...data, ...remote };
      data.notes = data.notes || [];
      data.statuses = data.statuses || [];
      data.usage = data.usage || [];
      // Ensure outOfStockStatusId exists (backward compat)
      if (!data.settings.outOfStockStatusId) {
        const unavailSt = (data.statuses || []).find(s => s.name === 'Unavailable');
        if (unavailSt) data.settings.outOfStockStatusId = unavailSt.id;
      }
      // Sync PIN hash from synced data to localStorage
      if (data.settings && data.settings.pinHash) {
        localStorage.setItem(CONFIG.pinHashKey, data.settings.pinHash);
      }
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify(data));
      lastSavedData = JSON.stringify(data);
      isDirty = false;
      return data;
    }
    const cached = localStorage.getItem(CONFIG.cacheKey);
    if (cached) {
      try {
        data = JSON.parse(cached);
      } catch {}
    }
    return data;
  }

  async function save() {
    const currentStr = JSON.stringify(data);
    if (currentStr === lastSavedData) return true;
    try {
      await GitHubAPI.saveData(data);
      localStorage.setItem(CONFIG.cacheKey, currentStr);
      lastSavedData = currentStr;
      isDirty = false;
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      isDirty = true;
      return false;
    }
  }

  function hasUnsavedChanges() {
    return isDirty || JSON.stringify(data) !== lastSavedData;
  }

  // ====== Products ======

  function getProducts() { return data.products || []; }
  function getProduct(id) { return (data.products || []).find(p => p.id === id); }

  function addProduct(product) {
    const newProduct = { id: uid(), ...product, createdAt: now(), updatedAt: now() };
    if (!data.products) data.products = [];
    data.products.unshift(newProduct);
    isDirty = true;
    return newProduct;
  }

  function updateProduct(id, updates) {
    const idx = (data.products || []).findIndex(p => p.id === id);
    if (idx === -1) return null;
    data.products[idx] = { ...data.products[idx], ...updates, id: data.products[idx].id, createdAt: data.products[idx].createdAt, updatedAt: now() };
    isDirty = true;
    return data.products[idx];
  }

  function deleteProduct(id) {
    data.products = (data.products || []).filter(p => p.id !== id);
    data.sales = (data.sales || []).filter(s => s.productId !== id);
    data.usage = (data.usage || []).filter(u => u.productId !== id);
    isDirty = true;
  }

  function getLowStockProducts() {
    const globalThreshold = data.settings?.lowStockThreshold || CONFIG.lowStockThreshold;
    return (data.products || []).filter(p => {
      const stock = parseInt(p.stock) || 0;
      if (stock <= 0) return false;
      const threshold = p.lowStockThreshold != null ? parseInt(p.lowStockThreshold) : globalThreshold;
      return stock <= threshold;
    });
  }

  function getOutOfStockProducts() {
    return (data.products || []).filter(p => (parseInt(p.stock) || 0) <= 0);
  }

  // ====== Categories ======

  function getCategories() { return data.categories || []; }

  function addCategory(name, color) {
    const newCat = { id: uid(), name: name.trim(), color: color || '#6B7280' };
    data.categories.push(newCat);
    isDirty = true;
    return newCat;
  }

  function deleteCategory(id) {
    data.categories = (data.categories || []).filter(c => c.id !== id);
    (data.products || []).forEach(p => { if (p.categoryId === id) p.categoryId = ''; });
    isDirty = true;
  }

  function getCategoryName(id) {
    const cat = (data.categories || []).find(c => c.id === id);
    return cat ? cat.name : 'Uncategorized';
  }

  // ====== Custom Statuses ======

  function getStatuses() { return data.statuses || []; }

  function getStatusName(id) {
    const st = (data.statuses || []).find(s => s.id === id);
    return st ? st.name : 'Available';
  }

  function addStatus(name, color) {
    const newSt = { id: uid(), name: name.trim(), color: color || '#6B7280' };
    data.statuses.push(newSt);
    isDirty = true;
    return newSt;
  }

  function deleteStatus(id) {
    data.statuses = (data.statuses || []).filter(s => s.id !== id);
    (data.products || []).forEach(p => { if (p.status === id) delete p.status; });
    isDirty = true;
  }

  // ====== Notes ======

  function getNotes() {
    return (data.notes || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function addNote(title, content) {
    const note = { id: uid(), title: title.trim(), content: content.trim(), createdAt: now(), updatedAt: now() };
    if (!data.notes) data.notes = [];
    data.notes.unshift(note);
    isDirty = true;
    return note;
  }

  function updateNote(id, title, content) {
    const idx = (data.notes || []).findIndex(n => n.id === id);
    if (idx === -1) return null;
    data.notes[idx] = { ...data.notes[idx], title: title.trim(), content: content.trim(), updatedAt: now() };
    isDirty = true;
    return data.notes[idx];
  }

  function deleteNote(id) {
    data.notes = (data.notes || []).filter(n => n.id !== id);
    isDirty = true;
  }

  // ====== Usage (Orders + Usage) ======

  function getUsage() {
    return (data.usage || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Add a usage entry. type = 'sold' | 'used' | 'donated' | 'other'
   * Auto-deducts from product stock.
   */
  function addUsage(entry) {
    const newEntry = {
      id: uid(),
      productId: entry.productId,
      type: entry.type || 'sold',
      quantity: parseInt(entry.quantity) || 1,
      revenue: entry.type === 'sold' ? (parseFloat(entry.revenue) || 0) : 0,
      reason: entry.reason || '',
      date: entry.date || now(),
      notes: entry.notes || ''
    };
    if (!data.usage) data.usage = [];
    data.usage.unshift(newEntry);

    // Auto-deduct from stock
    const product = getProduct(entry.productId);
    if (product) {
      const oldStock = parseInt(product.stock) || 0;
      product.stock = Math.max(0, oldStock - newEntry.quantity);
      product.updatedAt = now();
      // Auto-set to Unavailable when stock hits 0
      if (product.stock === 0 && oldStock > 0) {
        const outOfStockId = data.settings?.outOfStockStatusId;
        if (outOfStockId) {
          product.status = outOfStockId;
        }
      }
    }

    // Also log to sales for backward compat
    if (newEntry.type === 'sold') {
      if (!data.sales) data.sales = [];
      data.sales.unshift({
        id: uid(),
        productId: entry.productId,
        quantity: newEntry.quantity,
        revenue: newEntry.revenue,
        date: newEntry.date,
        notes: entry.notes || ''
      });
    }

    isDirty = true;
    return newEntry;
  }

  function deleteUsage(id) {
    data.usage = (data.usage || []).filter(u => u.id !== id);
    isDirty = true;
  }

  function getUsageByProduct(productId) {
    return (data.usage || []).filter(u => u.productId === productId);
  }

  // ====== Sales (legacy) ======

  function getSales() {
    return (data.sales || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function addSale(sale) {
    const newSale = { id: uid(), ...sale, date: sale.date || now() };
    if (!data.sales) data.sales = [];
    data.sales.unshift(newSale);
    const product = getProduct(sale.productId);
    if (product) {
      product.stock = Math.max(0, (parseInt(product.stock) || 0) - (sale.quantity || 1));
      product.updatedAt = now();
    }
    isDirty = true;
    return newSale;
  }

  function deleteSale(id) {
    data.sales = (data.sales || []).filter(s => s.id !== id);
    isDirty = true;
  }

  function getTotalRevenue() {
    const salesRev = (data.sales || []).reduce((sum, s) => sum + (parseFloat(s.revenue) || 0), 0);
    const usageRev = (data.usage || []).filter(u => u.type === 'sold').reduce((sum, u) => sum + (parseFloat(u.revenue) || 0), 0);
    return Math.max(salesRev, usageRev);
  }

  // ====== Dashboard Stats ======

  function getStats() {
    const products = data.products || [];
    const usage = data.usage || [];
    const totalItems = products.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0);
    const lowStock = getLowStockProducts();

    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthSold = usage.filter(u => {
      const d = new Date(u.date);
      return u.type === 'sold' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const monthUsed = usage.filter(u => {
      const d = new Date(u.date);
      return u.type !== 'sold' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const monthlyRevenue = monthSold.reduce((sum, u) => sum + (parseFloat(u.revenue) || 0), 0);

    return {
      totalProducts: products.length,
      totalItems,
      totalSales: usage.filter(u => u.type === 'sold').length,
      totalRevenue: getTotalRevenue(),
      monthlyRevenue,
      monthlyUsage: monthUsed.length + monthSold.length,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock,
      outOfStockCount: getOutOfStockProducts().length,
      notesCount: (data.notes || []).length,
      usageCount: usage.length
    };
  }

  // ====== Export ======

  function exportToCSV() {
    const products = data.products || [];
    if (products.length === 0) return '';
    const headers = ['Name', 'Price', 'Category', 'Stock', 'Status', 'Description', 'Tags', 'Created'];
    const rows = products.map(p => [
      escapeCSV(p.name || ''),
      p.price || '',
      getCategoryName(p.categoryId),
      p.stock || 0,
      getStatusName(p.status),
      escapeCSV(p.description || ''),
      (p.tags || []).join('; '),
      new Date(p.createdAt).toLocaleDateString()
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  function escapeCSV(str) {
    if (!str) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ====== Settings ======

  function getSettings() { return data.settings || {}; }

  function updateSettings(updates) {
    data.settings = { ...(data.settings || {}), ...updates };
    isDirty = true;
  }

  function getData() { return data; }

  return {
    load, save, hasUnsavedChanges,
    getProducts, getProduct, addProduct, updateProduct, deleteProduct,
    getLowStockProducts, getOutOfStockProducts,
    getCategories, addCategory, deleteCategory, getCategoryName,
    getStatuses, getStatusName, addStatus, deleteStatus,
    getNotes, addNote, updateNote, deleteNote,
    getUsage, addUsage, deleteUsage, getUsageByProduct,
    getSales, addSale, deleteSale, getTotalRevenue,
    getStats,
    exportToCSV,
    getSettings, updateSettings,
    getData, uid, now
  };
})();
