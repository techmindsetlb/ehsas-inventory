const CONFIG = {
  // === GitHub Repository Settings ===
  owner: 'techmindsetlb',
  repo: 'ehsas-inventory',
  branch: 'master',
  dataPath: 'data/products.json',

  // === GitHub Personal Access Token ===
  // Create a classic token with 'repo' scope at:
  // https://github.com/settings/tokens
  // Then paste it below:
  token: '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',

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
