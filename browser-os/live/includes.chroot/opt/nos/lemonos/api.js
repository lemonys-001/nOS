const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

const USER_ID_RE = /^[A-Za-z0-9._-]{3,128}$/;
const APP_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_VALUE_BYTES = 10 * 1024 * 1024;
const QUOTA_BYTES = 50 * 1024 * 1024;
const CHAT_APP = 'chat';
const CHAT_LIMIT = 100;
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;
const COMMUNITY_PREFIX = '__pub__';
const COMMUNITY_ID_RE = /^[A-Za-z0-9]{4,32}$/;
const MAX_APP_CODE_BYTES = 128 * 1024;
const MAX_PUBLISHED_PER_USER = 25;
const MAX_GLYPH_CHARS = 8;

const JS_HEADERS = {
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff'
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function error(status, message) {
  return json(status, { ok: false, error: message });
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, '').slice(0, 12);
}

function sanitizeGlyph(value) {
  return String(value == null ? '' : value).trim().slice(0, MAX_GLYPH_CHARS).replace(/[<>&"'`]/g, '');
}

function getUserId(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/);
  if (!match) return null;
  const userId = match[1];
  return USER_ID_RE.test(userId) ? userId : null;
}

async function listKeys(env, prefix) {
  const keys = [];
  let cursor;
  let complete = false;
  while (!complete) {
    const page = await env.USER_STORAGE.list({ prefix, cursor });
    for (const item of page.keys) keys.push(item.name);
    complete = page.list_complete !== false;
    cursor = page.cursor;
  }
  return keys;
}

async function measure(env, prefix) {
  const sizes = {};
  let total = 0;
  let cursor;
  let complete = false;
  while (!complete) {
    const page = await env.USER_STORAGE.list({ prefix, cursor });
    for (const item of page.keys) {
      const size = (item.metadata && Number(item.metadata.size)) || 0;
      sizes[item.name] = size;
      total += size;
    }
    complete = page.list_complete !== false;
    cursor = page.cursor;
  }
  return { sizes, total };
}

async function readJson(env, key, fallback) {
  const raw = await env.USER_STORAGE.get(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function communityList(env) {
  const apps = [];
  let cursor;
  let complete = false;
  while (!complete) {
    const page = await env.USER_STORAGE.list({ prefix: COMMUNITY_PREFIX, cursor });
    for (const item of page.keys) {
      const md = item.metadata || {};
      apps.push({
        id: item.name.slice(COMMUNITY_PREFIX.length),
        name: md.name || 'Untitled',
        author: md.author || '',
        glyph: md.glyph || '',
        size: Number(md.size) || 0,
        created: Number(md.created) || 0
      });
    }
    complete = page.list_complete !== false;
    cursor = page.cursor;
  }
  apps.sort((a, b) => b.created - a.created);
  return apps;
}

async function handleCommunity(request, env, path) {
  const method = request.method;

  if (path.length === 1 && method === 'GET') {
    const apps = await communityList(env);
    return json(200, { ok: true, apps: apps.slice(0, 200) });
  }

  if (path.length === 1 && method === 'POST') {
    const userId = getUserId(request);
    if (!userId) return error(401, 'Sign in to publish an app');
    let body;
    try { body = await request.json(); } catch { return error(400, 'Invalid JSON body'); }
    const name = String((body && body.name) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const code = String((body && body.code) || '');
    const glyph = sanitizeGlyph(body && body.glyph);
    if (!name) return error(400, 'App name is required');
    if (!code.trim()) return error(400, 'There is no code to publish');
    const size = new TextEncoder().encode(code).length;
    if (size > MAX_APP_CODE_BYTES) return error(413, 'App code is over the ' + Math.round(MAX_APP_CODE_BYTES / 1024) + ' KB limit');

    const publishedKey = userId + '__meta__published';
    const mine = await readJson(env, publishedKey, []);
    const owned = Array.isArray(mine) ? mine.filter((id) => typeof id === 'string') : [];
    if (owned.length >= MAX_PUBLISHED_PER_USER) {
      return error(429, 'You have published the maximum of ' + MAX_PUBLISHED_PER_USER + ' apps. Delete one to make room.');
    }

    let id = uid();
    for (let i = 0; i < 5 && (await env.USER_STORAGE.get(COMMUNITY_PREFIX + id)) !== null; i += 1) id = uid();

    const author = (await env.USER_STORAGE.get(userId + '__meta__username')) || '';
    const created = Date.now();
    const record = { id, name, author, glyph, owner: userId, code, created, updated: created };
    await env.USER_STORAGE.put(COMMUNITY_PREFIX + id, JSON.stringify(record), {
      metadata: { name, author, glyph, size, created }
    });
    owned.push(id);
    await env.USER_STORAGE.put(publishedKey, JSON.stringify(owned));
    return json(200, { ok: true, app: { id, name, author, glyph, size, created } });
  }

  if (path.length === 2) {
    let id = path[1];
    const wantScript = /\.js$/i.test(id);
    if (wantScript) id = id.slice(0, -3);
    if (!COMMUNITY_ID_RE.test(id)) return error(400, 'Invalid app id');

    if (method === 'GET' && wantScript) {
      const raw = await env.USER_STORAGE.get(COMMUNITY_PREFIX + id);
      let rec = null;
      try { rec = raw === null ? null : JSON.parse(raw); } catch { rec = null; }
      if (!rec || typeof rec.code !== 'string') return new Response('/* app not found */', { status: 404, headers: JS_HEADERS });
      return new Response(rec.code, { status: 200, headers: JS_HEADERS });
    }

    if (method === 'DELETE' && !wantScript) {
      const userId = getUserId(request);
      if (!userId) return error(401, 'Sign in to manage your apps');
      const kvKey = COMMUNITY_PREFIX + id;
      const raw = await env.USER_STORAGE.get(kvKey);
      if (raw === null) return error(404, 'App not found');
      let rec = null;
      try { rec = JSON.parse(raw); } catch { rec = null; }
      if (!rec || rec.owner !== userId) return error(403, 'You can only delete apps you published');
      await env.USER_STORAGE.delete(kvKey);
      const publishedKey = userId + '__meta__published';
      const mine = await readJson(env, publishedKey, []);
      if (Array.isArray(mine)) await env.USER_STORAGE.put(publishedKey, JSON.stringify(mine.filter((x) => x !== id)));
      return json(200, { ok: true });
    }
  }

  return error(404, 'Unknown community route');
}

export async function handleApi(request, env, segments) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const path = segments || [];

  if (path[0] === 'community') return handleCommunity(request, env, path);

  const userId = getUserId(request);
  if (!userId) return error(401, 'Missing or invalid Authorization bearer token');

  const userPrefix = userId + '__';

  if (path[0] === 'usage' && method === 'GET') {
    const { total } = await measure(env, userPrefix);
    return json(200, { ok: true, used: total, quota: QUOTA_BYTES });
  }

  if (path[0] === 'chat') {
    if (method === 'GET' && path.length === 1) {
      const names = await listKeys(env, userPrefix + CHAT_APP + '__');
      const convos = names
        .map((name) => name.slice((userPrefix + CHAT_APP + '__').length))
        .filter(Boolean)
        .sort();
      return json(200, { ok: true, conversations: convos });
    }
    if ((method === 'GET' || method === 'POST' || method === 'DELETE') && path.length === 2) {
      const convo = path[1];
      if (!KEY_RE.test(convo)) return error(400, 'Invalid conversation');
      const kvKey = userPrefix + CHAT_APP + '__' + convo;
      if (method === 'GET') {
        const raw = await env.USER_STORAGE.get(kvKey);
        const messages = raw === null ? [] : (() => { try { return JSON.parse(raw); } catch { return []; } })();
        return json(200, { ok: true, conversation: convo, messages });
      }
      if (method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return error(400, 'Invalid JSON body'); }
        const { from, to, message } = body || {};
        if (!from || !to || typeof message !== 'string') return error(400, 'from, to, and message are required');
        const raw = await env.USER_STORAGE.get(kvKey);
        let messages = raw === null ? [] : (() => { try { return JSON.parse(raw); } catch { return []; } })();
        messages.push({ id: uid(), from, to, message, ts: Date.now() });
        messages.sort((a, b) => a.ts - b.ts);
        if (messages.length > CHAT_LIMIT) messages = messages.slice(messages.length - CHAT_LIMIT);
        await env.USER_STORAGE.put(kvKey, JSON.stringify(messages), { metadata: { size: new TextEncoder().encode(JSON.stringify(messages)).length } });
        return json(200, { ok: true, messages });
      }
      if (method === 'DELETE') {
        const existing = await env.USER_STORAGE.get(kvKey);
        if (existing === null) return error(404, 'Conversation not found');
        await env.USER_STORAGE.delete(kvKey);
        return json(200, { ok: true });
      }
    }
    return error(404, 'Unknown chat route');
  }

  if (path[0] === 'username') {
    const GLOBAL_PREFIX = '__un__';
    if (method === 'GET' && path.length === 2 && path[1] === 'search') {
      const raw = (new URL(request.url).searchParams.get('q') || '').trim();
      const query = raw.replace(/[^A-Za-z0-9._-]/g, '');
      const usernames = [];
      if (query) {
        const mine = await env.USER_STORAGE.get(userPrefix + 'meta__username');
        let cursor;
        let complete = false;
        while (!complete && usernames.length < 20) {
          const page = await env.USER_STORAGE.list({ prefix: GLOBAL_PREFIX + query, cursor, limit: 20 });
          for (const item of page.keys) {
            const name = item.name.slice(GLOBAL_PREFIX.length);
            if (name !== mine) usernames.push(name);
          }
          complete = page.list_complete !== false;
          cursor = page.cursor;
        }
      }
      return json(200, { ok: true, usernames: usernames.slice(0, 20) });
    }
    if (method === 'GET' && path.length === 1) {
      const raw = await env.USER_STORAGE.get(userPrefix + 'meta__username');
      return json(200, { ok: true, username: raw || null });
    }
    if (method === 'POST' && path.length === 1) {
      let body;
      try { body = await request.json(); } catch { return error(400, 'Invalid JSON body'); }
      const { username } = body || {};
      if (!username || !USERNAME_RE.test(username)) return error(400, 'Username must be 3-32 characters, letters/numbers/._- only');
      const taken = await env.USER_STORAGE.get(GLOBAL_PREFIX + username);
      if (taken && taken !== userId) return error(409, 'Username already taken');
      await env.USER_STORAGE.put(GLOBAL_PREFIX + username, userId);
      await env.USER_STORAGE.put(userPrefix + 'meta__username', username);
      return json(200, { ok: true, username });
    }
    return error(404, 'Unknown username route');
  }

  if (path[0] === 'account' && method === 'DELETE' && path.length === 1) {
    const username = await env.USER_STORAGE.get(userPrefix + 'meta__username');
    const published = await readJson(env, userPrefix + 'meta__published', []);
    const names = await listKeys(env, userPrefix);
    for (const name of names) await env.USER_STORAGE.delete(name);
    if (username) await env.USER_STORAGE.delete('__un__' + username);
    if (Array.isArray(published)) {
      for (const id of published) {
        if (COMMUNITY_ID_RE.test(String(id))) await env.USER_STORAGE.delete(COMMUNITY_PREFIX + id);
      }
    }
    return json(200, { ok: true });
  }

  if (path[0] !== 'store') return error(404, 'Unknown API route');

  const app = path[1];
  const key = path[2];
  const extra = path[3];

  if (app !== undefined && !APP_RE.test(app)) return error(400, 'Invalid app name');
  if (key !== undefined && !KEY_RE.test(key)) return error(400, 'Invalid key');
  if (extra !== undefined) return error(404, 'Unknown API route');
  if ((method === 'POST' || method === 'DELETE') && (app === undefined || key === undefined)) {
    return error(400, 'App and key are required');
  }

  const appPrefix = userPrefix + app + '__';
  const kvKey = appPrefix + key;

  if (method === 'GET') {
    if (key === undefined) {
      const names = await listKeys(env, app ? appPrefix : userPrefix);
      const strip = app ? appPrefix.length : userPrefix.length;
      const keys = names.map((name) => name.slice(strip)).filter(Boolean).sort();
      return json(200, { ok: true, keys });
    }
    const value = await env.USER_STORAGE.get(kvKey);
    if (value === null) return error(404, 'Key not found');
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    return json(200, { ok: true, value: parsed });
  }

  if (method === 'POST') {
    let body;
    try {
      body = await request.text();
    } catch {
      return error(400, 'Unable to read request body');
    }
    const size = new TextEncoder().encode(body).length;
    if (size > MAX_VALUE_BYTES) return error(413, 'Item exceeds the per-file limit');
    try {
      JSON.parse(body);
    } catch {
      return error(400, 'Body must be valid JSON');
    }
    const { sizes, total } = await measure(env, userPrefix);
    const next = total - (sizes[kvKey] || 0) + size;
    if (next > QUOTA_BYTES) {
      return error(413, 'Storage full — ' + Math.round(QUOTA_BYTES / 1048576) + ' MB per account');
    }
    await env.USER_STORAGE.put(kvKey, body, { metadata: { size } });
    return json(200, { ok: true, used: next, quota: QUOTA_BYTES });
  }

  if (method === 'DELETE') {
    const existing = await env.USER_STORAGE.get(kvKey);
    if (existing === null) return error(404, 'Key not found');
    const freed = new TextEncoder().encode(existing).length;
    await env.USER_STORAGE.delete(kvKey);
    return json(200, { ok: true, freed });
  }

  return error(405, 'Method not allowed');
}
