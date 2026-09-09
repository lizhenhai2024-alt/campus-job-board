// Vercel Serverless Function — GET/POST /api/state
//
// Stores the "我的投递" pipeline (status + offers) so it can sync across devices instead of
// living only in one browser's localStorage. Backed by Vercel KV (Upstash Redis) via its plain
// REST API, so no npm dependency / build step is needed for this otherwise build-free static site.
//
// Required setup in the Vercel project dashboard (one-time, see README "云端同步设置"):
//   1. Storage tab -> Create Database -> KV. This auto-injects KV_REST_API_URL / KV_REST_API_TOKEN.
//   2. Settings -> Environment Variables -> add BOARD_SYNC_SECRET (any passphrase you choose).
//      The same passphrase must be entered once in the board's "我的投递" tab on each device.
//
// Without KV connected, this endpoint returns 501 and the frontend silently falls back to
// localStorage-only mode (same as if the network fetch for live jobs fails).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SECRET = process.env.BOARD_SYNC_SECRET;
const KEY = 'campus-job-board:pipeline-state';

async function kv(path, options = {}) {
  const res = await fetch(`${KV_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${KV_TOKEN}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  return res.json();
}

function checkSecret(req) {
  if (!SECRET) return true; // no secret configured: sync is open (not recommended, but not our call to force)
  return req.headers['x-board-secret'] === SECRET;
}

module.exports = async (req, res) => {
  if (!KV_URL || !KV_TOKEN) {
    res.status(501).json({ error: 'KV not configured. See README 云端同步设置.' });
    return;
  }
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'invalid secret' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await kv(`/get/${KEY}`);
      const value = result?.result ? JSON.parse(result.result) : null;
      res.status(200).json(value || { status: {}, offers: [], updatedAt: 0 });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || '{}');
      const payload = {
        status: data.status || {},
        offers: Array.isArray(data.offers) ? data.offers : [],
        updatedAt: Number(data.updatedAt) || Date.now(),
      };
      await kv(`/set/${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(payload)),
      });
      res.status(200).json(payload);
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
