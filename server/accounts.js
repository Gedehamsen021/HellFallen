// Contas de jogador: registro, login, sessões e progresso salvo
import crypto from 'node:crypto';

const USER_RE = /^[a-zA-Z0-9_]{3,16}$/;
const SESSION_DAYS = 60;
const MAX_PROFILE = 400 * 1024;

const scrypt = (password, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
});

export class Accounts {
  constructor(store) {
    this.store = store;
    this.attempts = new Map();
  }

  // limita tentativas por IP (10 por 5 minutos)
  limited(ip) {
    const now = Date.now();
    const list = (this.attempts.get(ip) || []).filter((t) => now - t < 5 * 60 * 1000);
    this.attempts.set(ip, list);
    return list.length >= 10;
  }
  fail(ip) {
    const list = this.attempts.get(ip) || [];
    list.push(Date.now());
    this.attempts.set(ip, list);
  }

  async newSession(username) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.store.set(`session:${token}`, { u: username, exp: Date.now() + SESSION_DAYS * 86400000 });
    return token;
  }

  async register(user, pass, profile, ip) {
    if (this.limited(ip)) return { error: 'Muitas tentativas. Aguarde alguns minutos.' };
    user = String(user || '').trim();
    pass = String(pass || '');
    if (!USER_RE.test(user)) return { error: 'Usuário deve ter de 3 a 16 caracteres (letras, números ou _).' };
    if (pass.length < 6 || pass.length > 128) return { error: 'A senha precisa ter pelo menos 6 caracteres.' };
    const key = `user:${user.toLowerCase()}`;
    if (await this.store.get(key)) { this.fail(ip); return { error: 'Esse usuário já existe.' }; }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scrypt(pass, salt)).toString('hex');
    const rec = { user, salt, hash, created: Date.now(), lastLogin: Date.now(), profile: this.cleanProfile(profile) };
    await this.store.set(key, rec);
    const token = await this.newSession(user);
    return { user, token, profile: rec.profile, created: true };
  }

  async login(user, pass, ip) {
    if (this.limited(ip)) return { error: 'Muitas tentativas. Aguarde alguns minutos.' };
    user = String(user || '').trim();
    const rec = USER_RE.test(user) ? await this.store.get(`user:${user.toLowerCase()}`) : null;
    if (!rec) { this.fail(ip); return { error: 'Usuário ou senha incorretos.' }; }
    const hash = await scrypt(String(pass || ''), rec.salt);
    const ok = crypto.timingSafeEqual(hash, Buffer.from(rec.hash, 'hex'));
    if (!ok) { this.fail(ip); return { error: 'Usuário ou senha incorretos.' }; }
    rec.lastLogin = Date.now();
    await this.store.set(`user:${rec.user.toLowerCase()}`, rec);
    const token = await this.newSession(rec.user);
    return { user: rec.user, token, profile: rec.profile || null };
  }

  async resume(token) {
    if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return { error: 'Sessão inválida.' };
    const s = await this.store.get(`session:${token}`);
    if (!s || s.exp < Date.now()) { if (s) await this.store.del(`session:${token}`); return { error: 'Sessão expirada. Entre novamente.' }; }
    const rec = await this.store.get(`user:${s.u.toLowerCase()}`);
    if (!rec) return { error: 'Conta não encontrada.' };
    return { user: rec.user, token, profile: rec.profile || null, resumed: true };
  }

  async logout(token) {
    if (/^[a-f0-9]{64}$/.test(String(token || ''))) await this.store.del(`session:${token}`);
  }

  cleanProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const json = JSON.stringify(profile);
    if (json.length > MAX_PROFILE) return null;
    return JSON.parse(json);
  }

  async saveProfile(user, profile) {
    const clean = this.cleanProfile(profile);
    if (!clean) return false;
    const key = `user:${user.toLowerCase()}`;
    const rec = await this.store.get(key);
    if (!rec) return false;
    // não deixa um save antigo sobrescrever um mais novo
    if (rec.profile && rec.profile.savedAt && clean.savedAt && clean.savedAt < rec.profile.savedAt) return false;
    rec.profile = clean;
    await this.store.set(key, rec);
    return true;
  }
}
