/**
 * GitHub API wrapper
 * Reads and writes data via GitHub Contents API.
 * Uses Cloudflare Worker proxy if CONFIG.workerUrl is set (secure).
 * Falls back to direct GitHub API with CONFIG.token if no worker.
 */

const GitHubAPI = (() => {
  const BASE = 'https://api.github.com';

  /**
   * Get the base URL for API calls.
   * Uses the Worker proxy if configured, otherwise uses direct GitHub API.
   */
  function apiUrl(path) {
    if (CONFIG.workerUrl) {
      // Worker already constructs the GitHub API URL with /contents/ internally
      return `${CONFIG.workerUrl}/${path}`;
    }
    return `${BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  }

  function getToken() {
    return CONFIG.token;
  }

  async function apiFetch(url, options = {}) {
    // If using Worker proxy, no auth header needed (token is in Worker)
    if (CONFIG.workerUrl) {
      return fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Direct GitHub API — attach token
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `token ${getToken()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch the JSON data file from GitHub.
   */
  async function getData() {
    try {
      const res = await apiFetch(apiUrl(CONFIG.dataPath));
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 401 || res.status === 403) return null;
        console.warn('GitHub API error:', res.status);
        return null;
      }
      const body = await res.json();
      const decoded = atob(body.content.replace(/\n/g, ''));
      return JSON.parse(decoded);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Save JSON data to GitHub.
   */
  async function saveData(data) {
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const payload = {
        message: `Update inventory data [${new Date().toLocaleString()}]`,
        content: content,
        branch: CONFIG.branch
      };

      const res = await apiFetch(apiUrl(CONFIG.dataPath), {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `GitHub API error: ${res.status}`);
      }

      return true;
    } catch (err) {
      console.error('GitHubAPI.saveData failed:', err);
      throw err;
    }
  }

  /**
   * Upload an image to the images/ folder.
   */
  async function uploadImage(filename, base64Content) {
    const path = `images/${filename}`;
    try {
      const payload = {
        message: `Upload image: ${filename} [${new Date().toLocaleString()}]`,
        content: base64Content,
        branch: CONFIG.branch
      };

      const res = await apiFetch(apiUrl(path), {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `GitHub API error: ${res.status}`);
      }

      return path;
    } catch (err) {
      console.error('GitHubAPI.uploadImage failed:', err);
      return null;
    }
  }

  return { getData, saveData, uploadImage };
})();
