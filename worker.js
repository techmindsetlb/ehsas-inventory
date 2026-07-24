/**
 * Ehsas Store — GitHub API Proxy
 * 
 * Deploy this as a Cloudflare Worker.
 * The GitHub token is stored as a Worker secret (GITHUB_TOKEN),
 * never exposed to clients.
 *
 * === SETUP ===
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Paste this code
 * 3. Go to Settings → Variables → Add secret named GITHUB_TOKEN
 * 4. Paste your GitHub token as the secret value
 * 5. Deploy and copy your Worker URL (e.g., https://ehsas-proxy.xxxx.workers.dev)
 * 6. Paste that URL into js/config.js as workerUrl
 */

const OWNER = 'techmindsetlb';
const REPO = 'ehsas-inventory';
const BRANCH = 'master';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Read token from Worker secret (set in Cloudflare dashboard via env)
    const token = env.GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: 'GitHub token not configured. Set GITHUB_TOKEN as a Worker secret.' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents${path}`;

    // For write operations, get the SHA of the current file
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
