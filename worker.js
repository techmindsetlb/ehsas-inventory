/**
 * Ehsas Store — GitHub API Proxy
 * 
 * Deploy this as a Cloudflare Worker.
 * The GitHub token is stored as a Worker secret (GITHUB_TOKEN),
 * never exposed to clients.
 */

// CONFIG — update these for your repo
const OWNER = 'techmindsetlb';
const REPO = 'ehsas-inventory';
const BRANCH = 'master';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname; // e.g., /contents/data/products.json

    // Read token from Worker secret (set in Cloudflare dashboard)
    const token = GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: 'GitHub token not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build GitHub API URL
    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents${path}`;

    // For write operations, we need the SHA of the current file
    let sha = null;
    if (request.method === 'PUT') {
      const getRes = await fetch(githubUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const body = await getRes.json();
        sha = body.sha;
      }
    }

    // Prepare the payload
    let body;
    if (request.method === 'PUT') {
      const payload = await request.json();
      payload.sha = sha;
      payload.branch = BRANCH;
      body = JSON.stringify(payload);
    }

    // Forward to GitHub API
    const githubRes = await fetch(githubUrl, {
      method: request.method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: body
    });

    const responseBody = await githubRes.text();

    return new Response(responseBody, {
      status: githubRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
};
