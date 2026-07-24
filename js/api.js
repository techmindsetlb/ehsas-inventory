/**
 * GitHub API wrapper
 * Reads and writes data/products.json via the GitHub Contents API.
 */

const GitHubAPI = (() => {
  const BASE = 'https://api.github.com';

  function getToken() {
    return localStorage.getItem('ehsas_github_token') || CONFIG.token;
  }

  function headers() {
    return {
      'Authorization': `token ${getToken()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function contentUrl() {
    return `${BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}`;
  }

  /**
   * Fetch the JSON data file from GitHub.
   * Returns parsed JSON, or null on error.
   */
  async function getData() {
    try {
      const res = await fetch(contentUrl(), { headers: headers() });
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
   * Performs a PUT request with the file content and SHA.
   */
  async function saveData(data) {
    try {
      // First get the current file info to obtain the SHA
      const getRes = await fetch(contentUrl(), { headers: headers() });
      let sha = null;
      if (getRes.ok) {
        const body = await getRes.json();
        sha = body.sha;
      }

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

      const payload = {
        message: `Update inventory data [${new Date().toLocaleString()}]`,
        content: content,
        branch: CONFIG.branch
      };
      if (sha) payload.sha = sha;

      const res = await fetch(contentUrl(), {
        method: 'PUT',
        headers: headers(),
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
   * Upload an image to GitHub as a file in the images/ folder.
   * Uses the Contents API to create/update the file.
   * @param {string} filename - e.g., "product-abc123.webp"
   * @param {string} base64Content - base64-encoded image data (without data: prefix)
   * @returns {string|null} The path to the image file, or null on failure
   */
  async function uploadImage(filename, base64Content) {
    const path = `images/${filename}`;
    const url = `${BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;

    try {
      // Get current file SHA if it exists
      const getRes = await fetch(url, { headers: headers() });
      let sha = null;
      if (getRes.ok) {
        const body = await getRes.json();
        sha = body.sha;
      }

      const payload = {
        message: `Upload image: ${filename} [${new Date().toLocaleString()}]`,
        content: base64Content,
        branch: CONFIG.branch
      };
      if (sha) payload.sha = sha;

      const res = await fetch(url, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `GitHub API error: ${res.status}`);
      }

      // Return the relative path for storing in product data
      return path;
    } catch (err) {
      console.error('GitHubAPI.uploadImage failed:', err);
      return null;
    }
  }

  return { getData, saveData, uploadImage };
})();
