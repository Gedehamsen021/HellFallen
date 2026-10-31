// Armazenamento chave/valor persistente.
// Padrão: arquivos JSON em server/data. Opcional: Upstash Redis (REST) — defina
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para dados que sobrevivem a reinícios
// em hospedagens com disco efêmero (Render, Railway, etc.).
import fs from 'node:fs';
import path from 'node:path';

function fileStore(dir) {
  const fileFor = (key) => {
    const parts = String(key).split(':').map((p) => p.replace(/[^a-zA-Z0-9_-]/g, '_'));
    const name = parts.pop() + '.json';
    return path.join(dir, ...parts, name);
  };
  return {
    kind: 'arquivos',
    async get(key) {
      try { return JSON.parse(await fs.promises.readFile(fileFor(key), 'utf8')); } catch { return null; }
    },
    async set(key, value) {
      const f = fileFor(key);
      await fs.promises.mkdir(path.dirname(f), { recursive: true });
      const tmp = f + '.' + process.pid + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(value));
      await fs.promises.rename(tmp, f);
    },
    async del(key) {
      try { await fs.promises.unlink(fileFor(key)); } catch {}
    },
  };
}

function upstashStore(url, token) {
  const base = url.replace(/\/$/, '');
  const call = async (cmd, key, body) => {
    const res = await fetch(`${base}/${cmd}/${encodeURIComponent(key)}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!res.ok) throw new Error(`Upstash ${cmd} ${res.status}`);
    return (await res.json()).result;
  };
  return {
    kind: 'upstash',
    async get(key) {
      const r = await call('get', key);
      if (r === null || r === undefined) return null;
      try { return JSON.parse(r); } catch { return null; }
    },
    async set(key, value) { await call('set', key, JSON.stringify(value)); },
    async del(key) { await call('del', key); },
  };
}

export function createStore(dataDir) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return upstashStore(url, token);
  return fileStore(dataDir);
}
