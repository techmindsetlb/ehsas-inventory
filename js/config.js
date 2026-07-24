const CONFIG = {
  // === GitHub Repository Settings ===
  owner: 'techmindsetlb',
  repo: 'ehsas-inventory',
  branch: 'master',
  dataPath: 'data/products.json',

  // === GitHub API Proxy (Cloudflare Worker) ===
  // Set this to your Worker URL after deploying worker.js
  // Leave empty to use direct GitHub API (requires token below)
  workerUrl: 'https://ehsas-proxy.techmindset-leb.workers.dev',

  // === GitHub Personal Access Token (only if NOT using a Worker) ===
  token: 'YOUR_GITHUB_TOKEN',

  // === App Settings ===
  appName: 'Ehsas Store',
  defaultPin: '1234',
  lowStockThreshold: 5,
  currency: '$',

  // === LocalStorage Keys ===
  cacheKey: 'ehsas_store_cache',
  sessionKey: 'ehsas_store_session',
  pinHashKey: 'ehsas_store_pin_hash'
};
