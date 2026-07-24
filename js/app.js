/**
 * Ehsas Store — Inventory Manager
 * Main application logic.
 */
const App = (() => {
  let currentView = 'dashboard';
  let isInitialized = false;
  let pinBuffer = '';
  let uploadedImageData = null;

  async function init() {
    if (isInitialized) return;
    document.getElementById('lock-keypad').addEventListener('click', (e) => {
      const key = e.target.dataset.key;
      if (!key) return;
      handleKeypadInput(key);
    });
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('login-screen') || document.getElementById('login-screen').classList.contains('hidden')) return;
      if (e.key >= '0' && e.key <= '9') { handleKeypadInput(e.key); return; }
      if (e.key === 'Enter') { e.preventDefault(); handleKeypadInput('enter'); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); handleKeypadInput('clear'); return; }
      if (e.key === 'Escape') { e.preventDefault(); pinBuffer = ''; updateDots(); }
    });
    if (Auth.checkSession()) {
      showApp();
      await loadData();
    }
    isInitialized = true;
  }

  function handleKeypadInput(key) {
    if (key === 'clear') { pinBuffer = pinBuffer.slice(0, -1); updateDots(); return; }
    if (key === 'enter') { doLogin(); return; }
    if (pinBuffer.length >= 10) return;
    pinBuffer += key;
    updateDots();
  }

  function updateDots() {
    const dots = document.querySelectorAll('#lock-dots .lock-dot');
    dots.forEach((dot, i) => { dot.classList.toggle('filled', i < pinBuffer.length); dot.classList.remove('wrong'); });
    document.getElementById('login-error').classList.remove('show');
  }

  async function doLogin() {
    if (!pinBuffer) return;
    const isValid = await Auth.verify(pinBuffer);
    if (isValid) {
      Auth.createSession();
      document.getElementById('login-error').classList.remove('show');
      showApp();
      await loadData();
      pinBuffer = '';
      updateDots();
    } else {
      document.getElementById('login-error').classList.add('show');
      const dots = document.querySelectorAll('#lock-dots .lock-dot');
      dots.forEach(d => d.classList.add('wrong'));
      pinBuffer = '';
      setTimeout(() => { dots.forEach(d => d.classList.remove('wrong')); updateDots(); }, 500);
    }
  }

  function logout() { Auth.destroySession(); location.reload(); }
  function showApp() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('app').style.display = ''; }
  function showLoading(show) { const el = document.getElementById('loading-screen'); if (el) el.style.display = show ? 'flex' : 'none'; }

  async function loadData() {
    showLoading(true);
    await DB.load();
    await Auth.init();
    renderAll();
    showLoading(false);
    updateSaveStatus();
    navigate('dashboard');
  }

  function navigate(view) {
    currentView = view;
    const titles = {
      dashboard: 'Dashboard', products: 'Products', categories: 'Categories',
      notes: 'Notes', usage: 'Orders & Usage', settings: 'Settings'
    };
    const icons = {
      dashboard: '📊', products: '📦', categories: '🏷️',
      notes: '📝', usage: '💰', settings: '⚙️'
    };

    document.querySelectorAll('.view').forEach(el => el.style.display = 'none');
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.style.display = '';

    document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    document.getElementById('header-title').textContent = titles[view] || 'Dashboard';
    document.getElementById('header-icon').textContent = icons[view] || '📊';

    closeSidebar();
    renderView(view);
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').style.display = 'none';
  }

  function renderAll() {
    renderDashboard();
    renderProducts();
    renderCategories();
    renderNotes();
    renderUsage();
    renderSettings();
    updateNavCounts();
    updateSaveStatus();
  }

  function renderView(view) {
    switch (view) {
      case 'dashboard': renderDashboard(); break;
      case 'products': renderProducts(); break;
      case 'categories': renderCategories(); break;
      case 'notes': renderNotes(); break;
      case 'usage': renderUsage(); break;
      case 'settings': renderSettings(); break;
    }
  }

  // ====== Dashboard ======
  function renderDashboard() {
    const stats = DB.getStats();
    document.getElementById('stat-products').textContent = stats.totalProducts;
    document.getElementById('stat-items').textContent = stats.totalItems;
    document.getElementById('stat-revenue').textContent = formatCurrency(stats.totalRevenue);
    document.getElementById('stat-lowstock').textContent = stats.lowStockCount;
    document.getElementById('stat-outofstock').textContent = stats.outOfStockCount;
    document.getElementById('stat-notes').textContent = stats.notesCount;
    document.getElementById('stat-usage').textContent = stats.usageCount;

    const recentProducts = DB.getProducts().slice(0, 5);
    document.getElementById('recent-products').innerHTML = recentProducts.length === 0
      ? '<div class="empty-state" style="padding:20px 0"><div class="empty-state-text">No products yet</div></div>'
      : recentProducts.map(p => `<div class="sale-item"><div class="sale-info"><span class="sale-product">${esc(p.name)}</span><span class="sale-date">${DB.getCategoryName(p.categoryId)} · Stock: ${p.stock || 0}</span></div><span style="font-weight:600">${formatCurrency(p.price)}</span></div>`).join('');

    const lowStock = DB.getLowStockProducts();
    document.getElementById('low-stock-list').innerHTML = lowStock.length === 0
      ? '<div class="empty-state" style="padding:20px 0"><div class="empty-state-text" style="color:var(--green)">✅ All items well-stocked!</div></div>'
      : lowStock.map(p => `<div class="sale-item"><div class="sale-info"><span class="sale-product">${esc(p.name)}</span><span class="sale-date">Only ${p.stock} left! ${p.lowStockThreshold ? `(threshold: ${p.lowStockThreshold})` : ''}</span></div><span class="badge badge-low-stock">⚠️ Low</span></div>`).join('');

    const outOfStock = DB.getOutOfStockProducts();
    document.getElementById('outofstock-list').innerHTML = outOfStock.length === 0
      ? '<div class="empty-state" style="padding:20px 0"><div class="empty-state-text" style="color:var(--green)">✅ All items in stock!</div></div>'
      : outOfStock.map(p => `<div class="sale-item"><div class="sale-info"><span class="sale-product">${esc(p.name)}</span><span class="sale-date">${DB.getCategoryName(p.categoryId)} · Status: ${DB.getStatusName(p.status)}</span></div><span class="badge badge-out-of-stock">🚫 Out</span></div>`).join('');
  }

  // ====== Products ======
  function renderProducts() {
    const categoryFilter = document.getElementById('category-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const searchQuery = document.getElementById('product-search').value;

    let products = DB.getProducts();
    if (categoryFilter && categoryFilter !== 'all') products = products.filter(p => p.categoryId === categoryFilter);
    if (statusFilter && statusFilter !== 'all') products = products.filter(p => p.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q)));
    }

    const tbody = document.getElementById('products-tbody');
    const emptyEl = document.getElementById('products-empty');
    const tableContainer = document.getElementById('products-table-container');

    if (products.length === 0) {
      tbody.innerHTML = ''; tableContainer.style.display = 'none'; emptyEl.style.display = 'block';
    } else {
      tableContainer.style.display = ''; emptyEl.style.display = 'none';
      tbody.innerHTML = products.map(p => `<tr>
        <td><div class="product-name-cell">${p.image ? (p.image.startsWith('images/') ? `<img src="https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${p.image}" alt="" class="product-thumb" onerror="this.style.display='none'">` : `<img src="${esc(p.image)}" alt="" class="product-thumb" onerror="this.style.display='none'">`) : ''}<div class="product-info"><span class="product-name">${esc(p.name)}</span><span class="product-category">${DB.getCategoryName(p.categoryId)}</span></div></div></td>
        <td style="font-weight:600">${formatCurrency(p.price)}</td>
        <td><span class="badge ${getStockBadgeClass(p)}">${p.stock ?? 0}</span></td>
        <td><span class="badge" style="background:${getStatusColor(p.status)};color:white">${DB.getStatusName(p.status)}</span></td>
        <td style="color:var(--plum-muted);font-size:12px">${formatDate(p.createdAt)}</td>
        <td><div class="actions-cell"><button class="btn btn-ghost btn-sm" onclick="App.editProduct('${p.id}')" style="font-size:13px">✏️</button><button class="btn btn-ghost btn-sm" onclick="App.confirmDeleteProduct('${p.id}')" style="font-size:13px;color:var(--red)">🗑️</button></div></td>
      </tr>`).join('');
    }
    updateSaveStatus();
  }

  function searchProducts() { renderProducts(); }
  function getStockBadgeClass(p) {
    const stock = parseInt(p.stock) || 0;
    if (stock <= 0) return 'badge-out-of-stock';
    const threshold = p.lowStockThreshold != null ? parseInt(p.lowStockThreshold) : (DB.getSettings().lowStockThreshold || 5);
    return stock <= threshold ? 'badge-low-stock' : 'badge-available';
  }
  function getStatusColor(statusId) {
    const st = DB.getStatuses().find(s => s.id === statusId);
    return st ? st.color : '#66BB6A';
  }

  // ====== Image Upload ======
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'err'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image too large. Max 10MB.', 'err'); return; }
    try {
      showToast('Processing image...', 'ok');
      const result = await processImage(file);
      uploadedImageData = result;
      showImagePreview(result.dataUrl);
      showToast('Image ready ✓', 'ok');
    } catch (err) { showToast('Failed to process image.', 'err'); }
  }

  function processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > 1200) { h = (h * 1200) / w; w = 1200; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          const base64 = dataUrl.split(',')[1];
          const filename = `product_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.webp`;
          resolve({ base64, filename, dataUrl });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function showImagePreview(dataUrl) {
    const preview = document.getElementById('image-preview');
    document.getElementById('image-preview-img').src = dataUrl;
    preview.classList.add('show');
    document.getElementById('image-upload-zone').style.display = 'none';
  }

  function removeImage() {
    uploadedImageData = null;
    document.getElementById('image-preview').classList.remove('show');
    document.getElementById('image-upload-zone').style.display = '';
    document.getElementById('product-image-input').value = '';
  }

  // ====== Product CRUD ======
  function showAddProductModal() {
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-save-btn').textContent = 'Add Product';
    document.getElementById('product-id').value = '';
    clearProductForm();
    populateCategorySelect('product-category');
    populateStatusSelect('product-status');
    document.getElementById('product-modal').classList.add('active');
  }

  function editProduct(id) {
    const p = DB.getProduct(id);
    if (!p) return;
    document.getElementById('product-modal-title').textContent = '✏️ Edit Product';
    document.getElementById('product-save-btn').textContent = 'Save Changes';
    document.getElementById('product-id').value = id;
    document.getElementById('product-name').value = p.name || '';
    document.getElementById('product-price').value = p.price || '';
    document.getElementById('product-stock').value = p.stock ?? 0;
    document.getElementById('product-lowstock-threshold').value = p.lowStockThreshold != null ? p.lowStockThreshold : '';
    uploadedImageData = null;
    if (p.image) {
      showImagePreview(p.image.startsWith('images/') ? `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${p.image}` : p.image);
    } else { removeImage(); }
    document.getElementById('product-tags').value = (p.tags || []).join(', ');
    document.getElementById('product-status').value = p.status || '';
    document.getElementById('product-description').value = p.description || '';
    document.getElementById('product-notes-text').value = p.notes || '';
    populateCategorySelect('product-category', p.categoryId);
    populateStatusSelect('product-status', p.status);
    document.getElementById('product-modal').classList.add('active');
  }

  async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value) || 0;
    const categoryId = document.getElementById('product-category').value;
    const stock = parseInt(document.getElementById('product-stock').value) || 0;
    const tagsStr = document.getElementById('product-tags').value.trim();
    const status = document.getElementById('product-status').value;
    const description = document.getElementById('product-description').value.trim();
    const notes = document.getElementById('product-notes-text').value.trim();
    if (!name) { showToast('Please enter a product name.', 'err'); return; }
    const lowStockThreshold = document.getElementById('product-lowstock-threshold').value;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    const productData = { name, price, categoryId, stock, tags, status, description, notes };
    if (lowStockThreshold !== '' && parseInt(lowStockThreshold) > 0) productData.lowStockThreshold = parseInt(lowStockThreshold);
    else productData.lowStockThreshold = null;

    if (uploadedImageData) {
      showToast('Uploading image...', 'ok');
      const path = await GitHubAPI.uploadImage(uploadedImageData.filename, uploadedImageData.base64);
      if (path) { productData.image = path; }
      else { showToast('Image upload failed.', 'err'); if (id) { const ex = DB.getProduct(id); if (ex) productData.image = ex.image; } }
      uploadedImageData = null; removeImage();
    } else if (!id) { productData.image = ''; }

    if (id) { 
      // Auto-set to Unavailable if stock manually set to 0
      if (parseInt(stock) === 0) {
        const outOfStockId = DB.getSettings().outOfStockStatusId;
        if (outOfStockId && !productData.status) productData.status = outOfStockId;
      }
      DB.updateProduct(id, productData); showToast('Product updated! ✅', 'ok'); 
    }
    else { DB.addProduct(productData); showToast('Product added! ✅', 'ok'); }
    closeModal('product-modal');
    renderProducts();
    updateNavCounts();
    autosave();
  }

  function confirmDeleteProduct(id) {
    const p = DB.getProduct(id);
    if (!p) return;
    if (confirm(`Delete "${p.name}"?`)) { DB.deleteProduct(id); renderProducts(); updateNavCounts(); showToast('Product deleted.', 'ok'); autosave(); }
  }

  function clearProductForm() {
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '1';
    document.getElementById('product-tags').value = '';
    document.getElementById('product-status').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-notes-text').value = '';
    document.getElementById('product-lowstock-threshold').value = '';
    removeImage();
  }

  // ====== Categories ======
  function renderCategories() {
    const cats = DB.getCategories();
    const statuses = DB.getStatuses();
    const filterEl = document.getElementById('category-filter');
    const currentVal = filterEl.value;
    filterEl.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    filterEl.value = currentVal;

    // Status filter
    const statusFilter = document.getElementById('status-filter');
    const curStatus = statusFilter.value;
    statusFilter.innerHTML = '<option value="all">All Status</option>' + statuses.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    statusFilter.value = curStatus;

    document.getElementById('categories-list').innerHTML = cats.length === 0
      ? '<div class="empty-state" style="padding:20px 0"><div class="empty-state-text">No categories yet.</div></div>'
      : `<div class="categories-list">${cats.map(c => `<span class="category-chip"><span class="category-color" style="background:${c.color}"></span>${esc(c.name)}<span class="category-remove" onclick="App.removeCategory('${c.id}')">✕</span></span>`).join('')}</div>`;

    document.getElementById('statuses-list').innerHTML = statuses.length === 0
      ? '<div class="empty-state" style="padding:20px 0"><div class="empty-state-text">No custom statuses yet.</div></div>'
      : `<div class="categories-list">${statuses.map(s => `<span class="category-chip"><span class="category-color" style="background:${s.color}"></span>${esc(s.name)}<span class="category-remove" onclick="App.removeStatus('${s.id}')">✕</span></span>`).join('')}</div>`;
  }

  function showAddCategoryModal() {
    document.getElementById('category-name').value = '';
    document.getElementById('category-color').value = '#FF6B9D';
    document.getElementById('category-modal').classList.add('active');
  }

  function saveCategory() {
    const name = document.getElementById('category-name').value.trim();
    const color = document.getElementById('category-color').value;
    if (!name) { showToast('Enter a category name.', 'err'); return; }
    DB.addCategory(name, color);
    closeModal('category-modal');
    renderCategories(); renderProducts();
    showToast('Category added! ✅', 'ok');
    autosave();
  }

  function removeCategory(id) {
    if (confirm('Remove this category?')) { DB.deleteCategory(id); renderCategories(); renderProducts(); showToast('Category removed.', 'ok'); autosave(); }
  }

  // ====== Custom Statuses ======
  function showAddStatusModal() {
    document.getElementById('status-name').value = '';
    document.getElementById('status-color').value = '#FF6B9D';
    document.getElementById('status-modal').classList.add('active');
  }

  function saveStatus() {
    const name = document.getElementById('status-name').value.trim();
    const color = document.getElementById('status-color').value;
    if (!name) { showToast('Enter a status name.', 'err'); return; }
    DB.addStatus(name, color);
    closeModal('status-modal');
    renderCategories(); renderProducts();
    showToast('Status added! ✅', 'ok');
    autosave();
  }

  function removeStatus(id) {
    const st = DB.getStatuses().find(s => s.id === id);
    if (!st) return;
    if (confirm(`Remove status "${st.name}"? Products with this status will be unlabeled.`)) { DB.deleteStatus(id); renderCategories(); renderProducts(); showToast('Status removed.', 'ok'); autosave(); }
  }

  // ====== Notes ======
  function renderNotes() {
    const notes = DB.getNotes();
    const el = document.getElementById('notes-list');
    if (notes.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">No notes yet</div><div class="empty-state-sub">Add notes for ideas, reminders, or anything you want to remember.</div><button class="btn btn-pink" style="margin-top:16px" onclick="App.showAddNoteModal()">+ Add Note</button></div>';
      return;
    }
    el.innerHTML = notes.map(n => `
      <div class="card" style="margin-bottom:10px;cursor:default">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:var(--plum)">${esc(n.title)}</div>
            <div style="font-size:13px;color:var(--plum-muted);white-space:pre-wrap;line-height:1.6;max-height:120px;overflow:hidden">${esc(n.content)}</div>
            <div style="font-size:11px;color:var(--plum-muted);margin-top:8px">${formatDate(n.createdAt)}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" onclick="App.editNote('${n.id}')" style="font-size:12px">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="App.deleteNote('${n.id}')" style="font-size:12px;color:var(--red)">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function showAddNoteModal() {
    document.getElementById('note-modal-title').textContent = 'Add Note';
    document.getElementById('note-save-btn').textContent = 'Save Note';
    document.getElementById('note-id').value = '';
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-modal').classList.add('active');
  }

  function editNote(id) {
    const notes = DB.getNotes();
    const n = notes.find(nt => nt.id === id);
    if (!n) return;
    document.getElementById('note-modal-title').textContent = 'Edit Note';
    document.getElementById('note-save-btn').textContent = 'Update Note';
    document.getElementById('note-id').value = id;
    document.getElementById('note-title').value = n.title || '';
    document.getElementById('note-content').value = n.content || '';
    document.getElementById('note-modal').classList.add('active');
  }

  function saveNote() {
    const id = document.getElementById('note-id').value;
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    if (!title) { showToast('Please enter a note title.', 'err'); return; }
    if (id) { DB.updateNote(id, title, content); showToast('Note updated! ✅', 'ok'); }
    else { DB.addNote(title, content); showToast('Note added! ✅', 'ok'); }
    closeModal('note-modal');
    renderNotes(); renderDashboard();
    autosave();
  }

  function deleteNote(id) {
    if (confirm('Delete this note?')) { DB.deleteNote(id); renderNotes(); renderDashboard(); showToast('Note deleted.', 'ok'); autosave(); }
  }

  // ====== Usage (Orders + Usage) ======
  function renderUsage() {
    // Populate product filter
    const filterSelect = document.getElementById('usage-filter-product');
    const curVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Products</option>' +
      DB.getProducts().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    filterSelect.value = curVal;

    // Get filters
    const productFilter = document.getElementById('usage-filter-product').value;
    const typeFilter = document.getElementById('usage-filter-type').value;
    const fromDate = document.getElementById('usage-filter-from').value;
    const toDate = document.getElementById('usage-filter-to').value;

    // Apply filters
    let usage = DB.getUsage();
    if (productFilter && productFilter !== 'all') usage = usage.filter(u => u.productId === productFilter);
    if (typeFilter && typeFilter !== 'all') usage = usage.filter(u => u.type === typeFilter);
    if (fromDate) usage = usage.filter(u => new Date(u.date) >= new Date(fromDate));
    if (toDate) {
      const toEnd = new Date(toDate);
      toEnd.setHours(23, 59, 59, 999);
      usage = usage.filter(u => new Date(u.date) <= toEnd);
    }

    const sold = usage.filter(u => u.type === 'sold');
    const used = usage.filter(u => u.type !== 'sold');
    const totalRevenue = sold.reduce((sum, u) => sum + (parseFloat(u.revenue) || 0), 0);
    const totalUsed = used.reduce((sum, u) => sum + (parseInt(u.quantity) || 0), 0);

    document.getElementById('usage-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('usage-sold').textContent = sold.length;
    document.getElementById('usage-used').textContent = totalUsed;

    const el = document.getElementById('usage-list');
    if (usage.length === 0) {
      const totalUsage = DB.getUsage().length;
      if (totalUsage === 0) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No activity yet</div><div class="empty-state-sub">Log when you sell an order or use a product — stock will auto-deduct.</div><button class="btn btn-pink" style="margin-top:16px" onclick="App.showAddUsageModal()">+ Log Activity</button></div>';
      } else {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No activity matches your filters</div><div class="empty-state-sub">Try changing the filters or <a href="#" onclick="App.clearUsageFilters();return false" style="color:var(--pink)">clear all filters</a>.</div></div>';
      }
      return;
    }
    el.innerHTML = usage.map(u => {
      const product = DB.getProduct(u.productId);
      const typeLabel = { sold: '🛒 Sold', used: '🔧 Used', donated: '🎁 Donated', other: '📋 Other' }[u.type] || u.type;
      const rev = u.type === 'sold' ? formatCurrency(u.revenue) : '';
      return `<div class="sale-item">
        <div class="sale-info">
          <span class="sale-product">${product ? esc(product.name) : 'Unknown'} <span style="font-size:11px;color:var(--plum-muted)">${typeLabel}</span></span>
          <span class="sale-date">${formatDate(u.date)} · Qty: ${u.quantity} ${u.reason ? '· ' + esc(u.reason) : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${rev ? `<span class="sale-amount">${rev}</span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.deleteUsage('${u.id}')" style="font-size:11px">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function searchUsage() { renderUsage(); }

  function clearUsageFilters() {
    document.getElementById('usage-filter-product').value = 'all';
    document.getElementById('usage-filter-type').value = 'all';
    document.getElementById('usage-filter-from').value = '';
    document.getElementById('usage-filter-to').value = '';
    renderUsage();
  }

  function showAddUsageModal() {
    populateAllProductSelect('usage-product');
    document.getElementById('usage-type').value = 'sold';
    document.getElementById('usage-quantity').value = '1';
    document.getElementById('usage-revenue').value = '';
    document.getElementById('usage-reason').value = '';
    document.getElementById('usage-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('usage-modal').classList.add('active');
    toggleUsageRevenue();

    document.getElementById('usage-product').onchange = function() {
      const p = DB.getProduct(this.value);
      if (p && p.price && !document.getElementById('usage-revenue').value) {
        document.getElementById('usage-revenue').value = p.price;
      }
    };
  }

  function toggleUsageRevenue() {
    const type = document.getElementById('usage-type').value;
    const group = document.getElementById('usage-revenue-group');
    group.style.display = type === 'sold' ? '' : 'none';
  }

  function saveUsage() {
    const productId = document.getElementById('usage-product').value;
    const type = document.getElementById('usage-type').value;
    const quantity = parseInt(document.getElementById('usage-quantity').value) || 1;
    const revenue = type === 'sold' ? (parseFloat(document.getElementById('usage-revenue').value) || 0) : 0;
    const reason = document.getElementById('usage-reason').value.trim();
    const date = document.getElementById('usage-date').value || new Date().toISOString();
    const notes = '';

    if (!productId) { showToast('Select a product.', 'err'); return; }
    if (type === 'sold' && revenue <= 0) { showToast('Enter sale revenue.', 'err'); return; }

    const product = DB.getProduct(productId);
    if (product && quantity > (parseInt(product.stock) || 0)) {
      if (!confirm(`Only ${product.stock} in stock. Log ${quantity} anyway (stock will go negative)?`)) return;
    }

    DB.addUsage({ productId, type, quantity, revenue, reason, date, notes });
    closeModal('usage-modal');
    renderUsage();
    renderProducts();
    renderDashboard();
    showToast('Activity logged! Stock updated ✅', 'ok');
    autosave();
  }

  function deleteUsage(id) {
    if (confirm('Delete this activity record?')) { DB.deleteUsage(id); renderUsage(); renderDashboard(); showToast('Activity deleted.', 'ok'); autosave(); }
  }

  // ====== Settings ======
  function renderSettings() {
    const settings = DB.getSettings();
    document.getElementById('settings-threshold').value = settings.lowStockThreshold || 5;
    document.getElementById('settings-currency').value = settings.currency || '$';
    const savedToken = localStorage.getItem('ehsas_github_token') || '';
    document.getElementById('settings-github-token').value = savedToken ? savedToken.substring(0, 10) + '...' : '';
    document.getElementById('settings-github-token').placeholder = savedToken ? 'Token saved ✓' : 'Paste your GitHub token...';
    document.getElementById('pin-change-msg').style.display = 'none';
  }

  async function changePin() {
    const current = document.getElementById('settings-current-pin').value;
    const newPin = document.getElementById('settings-new-pin').value;
    const confirmPin = document.getElementById('settings-confirm-pin').value;
    const msgEl = document.getElementById('pin-change-msg');
    if (!current || !newPin || !confirmPin) { showToast('Fill in all PIN fields.', 'err'); return; }
    if (newPin !== confirmPin) { showToast('PINs do not match.', 'err'); return; }
    if (newPin.length < 4) { showToast('PIN must be 4+ characters.', 'err'); return; }
    const success = await Auth.changePin(current, newPin);
    if (success) {
      msgEl.textContent = '✅ PIN changed!'; msgEl.style.color = 'var(--green)'; msgEl.style.display = 'block';
      document.getElementById('settings-current-pin').value = ''; document.getElementById('settings-new-pin').value = ''; document.getElementById('settings-confirm-pin').value = '';
      showToast('PIN changed! ✅', 'ok');
    } else { msgEl.textContent = '❌ Current PIN is incorrect.'; msgEl.style.color = 'var(--red)'; msgEl.style.display = 'block'; }
  }

  function saveSettings() {
    const threshold = parseInt(document.getElementById('settings-threshold').value) || 5;
    const currency = document.getElementById('settings-currency').value || '$';
    const tokenInput = document.getElementById('settings-github-token');
    const rawToken = tokenInput.value.trim();
    if (rawToken === '') {
      localStorage.removeItem('ehsas_github_token');
      tokenInput.placeholder = 'Paste your GitHub token...';
      showToast('Token removed.', 'ok');
    } else if (rawToken.includes('...') && localStorage.getItem('ehsas_github_token')) {
      // Already saved and masked — skip token update
    } else if (rawToken.startsWith('ghp_') && rawToken.length >= 36) {
      localStorage.setItem('ehsas_github_token', rawToken);
      tokenInput.value = rawToken.substring(0, 10) + '...';
      tokenInput.placeholder = 'Token saved ✓';
      showToast('Token saved! ✅', 'ok');
    } else if (!rawToken.includes('...')) {
      showToast('Invalid token format. Must start with ghp_', 'err');
      return;
    }
    DB.updateSettings({ lowStockThreshold: threshold, currency });
    showToast('Settings saved! ✅', 'ok');
    renderAll();
    autosave();
  }

  function exportCSV() {
    const csv = DB.exportToCSV();
    if (!csv) { showToast('No products to export.', 'err'); return; }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Ehsas_Store_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV exported! ✅', 'ok');
  }

  async function saveNow() {
    const btn = document.getElementById('save-btn');
    btn.disabled = true; btn.textContent = '⏳ Saving...';
    try {
      if (await DB.save()) showToast('Synced to GitHub! ✅', 'ok');
      else showToast('Sync failed. Check token.', 'err');
    } catch (err) { showToast('Sync error: ' + err.message, 'err'); }
    btn.disabled = false; btn.textContent = '💾 Save';
    updateSaveStatus();
  }

  let autosaveTimer = null;
  function autosave() {
    updateSaveStatus();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => { DB.save().then(success => { if (success) updateSaveStatus(); }).catch(() => {}); }, 3000);
  }

  function updateSaveStatus() {
    const indicator = document.getElementById('unsaved-indicator');
    const saveBtn = document.getElementById('save-btn');
    if (DB.hasUnsavedChanges()) { indicator.classList.add('show'); saveBtn.style.display = ''; }
    else { indicator.classList.remove('show'); saveBtn.style.display = 'none'; }
  }

  // ====== Utility ======
  function populateCategorySelect(elId, selectedId) {
    const el = document.getElementById(elId);
    const cats = DB.getCategories();
    while (el.options.length > 0) el.remove(0);
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Uncategorized'; el.appendChild(empty);
    cats.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; if (c.id === selectedId) o.selected = true; el.appendChild(o); });
  }

  function populateStatusSelect(elId, selectedId) {
    const el = document.getElementById(elId);
    const statuses = DB.getStatuses();
    while (el.options.length > 0) el.remove(0);
    statuses.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; if (s.id === selectedId) o.selected = true; el.appendChild(o); });
  }

  function populateAllProductSelect(elId) {
    const el = document.getElementById(elId);
    const products = DB.getProducts();
    while (el.options.length > 0) el.remove(0);
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Select a product...'; el.appendChild(empty);
    products.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.name} (${p.stock || 0} in stock)`; el.appendChild(o); });
  }

  function closeModal(id) { document.getElementById(id).classList.remove('active'); }

  function formatCurrency(amount) {
    const c = DB.getSettings().currency || '$';
    if (amount === undefined || amount === null) return `${c}0`;
    return `${c}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return dateStr; }
  }

  function showToast(message, type = 'ok') {
    const container = document.getElementById('toast-c');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
  }

  function updateNavCounts() {
    const count = DB.getProducts().length;
    const badge = document.getElementById('product-count-badge');
    if (count > 0) { badge.textContent = count; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init, logout, navigate, toggleSidebar, closeSidebar,
    showAddProductModal, editProduct, saveProduct, confirmDeleteProduct,
    searchProducts, handleImageUpload, removeImage,
    showAddCategoryModal, saveCategory, removeCategory,
    showAddStatusModal, saveStatus, removeStatus,
    showAddNoteModal, editNote, saveNote, deleteNote,
    showAddUsageModal, toggleUsageRevenue, saveUsage, deleteUsage, searchUsage, clearUsageFilters,
    changePin, saveSettings,
    exportCSV, saveNow, closeModal
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
