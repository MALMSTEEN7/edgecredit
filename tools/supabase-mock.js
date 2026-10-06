// Simulador mínimo de supabase-js v2 para PRUEBAS sin internet (no se usa en producción).
// Guarda la "base de datos" en localStorage ('mock-supabase-db') y emite los cambios en
// tiempo real con BroadcastChannel, así dos pestañas se comportan como dos dispositivos.
// Emula RLS de forma simple: el trabajador solo lee/escribe filas de su ruta.
(() => {
  const DB_KEY = 'mock-supabase-db';
  const TABLE_KEYS = { profiles: 'user_id', routes: 'id', route_state: 'route_id', clients: 'id', pending_requests: 'id', app_settings: 'key' };
  const bus = new BroadcastChannel('mock-supabase');
  const listeners = new Set();
  const load = () => JSON.parse(localStorage.getItem(DB_KEY) || 'null') || { users: [], factors: [], tables: Object.fromEntries(Object.keys(TABLE_KEYS).map(t => [t, []])) };
  const save = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
  const uuid = () => crypto.randomUUID();
  const emit = change => { bus.postMessage(change); setTimeout(() => listeners.forEach(fn => fn(change)), 10); };
  bus.onmessage = event => listeners.forEach(fn => fn(event.data));

  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32decode(text) { let bits = 0, value = 0; const out = []; for (const c of text.replace(/=+$/, '')) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
  async function totp(secret, step) {
    const key = await crypto.subtle.importKey('raw', b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const buf = new ArrayBuffer(8); new DataView(buf).setUint32(4, step);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const o = mac[19] & 15; const bin = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
    return String(bin % 1e6).padStart(6, '0');
  }

  function createClient(url, anonKey, options = {}) {
    let currentUser = null;
    const storageKey = options.auth?.storageKey;
    if (options.auth?.persistSession !== false && storageKey) { try { currentUser = JSON.parse(localStorage.getItem(`mock-session-${storageKey}`) || 'null'); } catch { /* */ } }
    const setUser = user => { currentUser = user; if (options.auth?.persistSession !== false && storageKey) localStorage.setItem(`mock-session-${storageKey}`, JSON.stringify(user)); };
    const profileOf = db => currentUser && db.tables.profiles.find(p => p.user_id === currentUser.id);
    const isAdmin = db => profileOf(db)?.role === 'admin';
    const scheduleOk = db => { const s = db.tables.app_settings.find(r => r.key === 'worker_access')?.data; if (!s?.enabled) return true; const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes(); const [sh, sm] = s.start.split(':').map(Number); const [eh, em] = s.end.split(':').map(Number); return s.days.includes(now.getDay()) && cur >= sh * 60 + sm && cur < eh * 60 + em; };
    const canRoute = (db, routeId) => { const p = profileOf(db); if (!p) return false; if (p.role === 'admin') return true; return p.role === 'worker' && p.access_enabled !== false && scheduleOk(db) && p.route_id === routeId; };
    const visible = (db, table, row) => {
      if (!currentUser) return false;
      if (table === 'profiles') return row.user_id === currentUser.id || isAdmin(db);
      if (table === 'app_settings') return true;
      const route = table === 'routes' ? row.id : row.route_id;
      return canRoute(db, route);
    };
    const writable = (db, table, row) => {
      if (table === 'profiles' || table === 'app_settings') return isAdmin(db);
      const route = table === 'routes' ? row.id : row.route_id;
      return canRoute(db, route);
    };

    function query(table) {
      const filters = [];
      let action = 'select'; let payload = null; let opts = {}; let single = null;
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push(r => r[col] === val); return builder; },
        in(col, vals) { filters.push(r => vals.includes(r[col])); return builder; },
        maybeSingle() { single = 'maybe'; return builder; },
        single() { single = 'one'; return builder; },
        upsert(rows, o) { action = 'upsert'; payload = rows; opts = o || {}; return builder; },
        update(obj) { action = 'update'; payload = obj; return builder; },
        delete() { action = 'delete'; return builder; },
        then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
      };
      function run() {
        if (!currentUser) return { data: null, error: { message: 'permission denied for table ' + table } };
        const db = load();
        const rows = db.tables[table];
        const key = TABLE_KEYS[table];
        const match = r => filters.every(f => f(r));
        if (action === 'select') {
          const data = rows.filter(r => visible(db, table, r) && match(r)).map(r => structuredClone(r));
          if (single) return { data: data[0] || null, error: single === 'one' && !data[0] ? { message: 'not found' } : null };
          return { data, error: null };
        }
        if (action === 'upsert') {
          const list = Array.isArray(payload) ? payload : [payload];
          if (list.some(r => !writable(db, table, r))) return { data: null, error: { message: 'new row violates row-level security policy for table "' + table + '"' } };
          list.forEach(r => {
            const index = rows.findIndex(x => x[key] === r[key]);
            if (index >= 0 && !writable(db, table, rows[index])) return;
            const row = { ...(index >= 0 ? rows[index] : {}), ...structuredClone(r) };
            if (index >= 0) rows[index] = row; else rows.push(row);
            emit({ table, eventType: index >= 0 ? 'UPDATE' : 'INSERT', new: row });
          });
          save(db); return { data: null, error: null };
        }
        if (action === 'update') {
          rows.filter(r => match(r) && visible(db, table, r)).forEach(r => {
            if (!writable(db, table, r)) return;
            Object.assign(r, structuredClone(payload));
            emit({ table, eventType: 'UPDATE', new: r });
          });
          save(db); return { data: null, error: null };
        }
        if (action === 'delete') {
          const removed = rows.filter(r => match(r) && writable(db, table, r) && (isAdmin(db)));
          db.tables[table] = rows.filter(r => !removed.includes(r));
          removed.forEach(r => emit({ table, eventType: 'DELETE', old: { [key]: r[key] } }));
          save(db); return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      return builder;
    }

    const auth = {
      async signInWithPassword({ email, password }) {
        const db = load();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (!user) return { data: {}, error: { message: 'Invalid login credentials' } };
        setUser({ id: user.id, email: user.email });
        return { data: { user: { id: user.id, email: user.email } }, error: null };
      },
      async signUp({ email, password }) {
        const db = load();
        if (db.users.some(u => u.email === email)) return { data: { user: { id: uuid(), identities: [] } }, error: null };
        const user = { id: uuid(), email, password };
        db.users.push(user);
        db.tables.profiles.push({ user_id: user.id, email, username: email.split('@')[0], role: 'pending', route_id: null, access_enabled: true, data: {} });
        save(db);
        return { data: { user: { id: user.id, email, identities: [{}] } }, error: null };
      },
      async signOut() { setUser(null); return { error: null }; },
      async getUser() { return { data: { user: currentUser }, error: null }; },
      mfa: {
        async listFactors() {
          const db = load();
          const all = db.factors.filter(f => f.user_id === currentUser?.id);
          return { data: { all, totp: all.filter(f => f.status === 'verified') }, error: null };
        },
        async enroll() {
          const db = load();
          const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => B32[b % 32]).join('');
          const factor = { id: uuid(), user_id: currentUser.id, secret, status: 'unverified' };
          db.factors.push(factor); save(db);
          return { data: { id: factor.id, totp: { secret, uri: `otpauth://totp/EdgeCredit:${currentUser.email}?secret=${secret}&issuer=EdgeCredit`, qr_code: '' } }, error: null };
        },
        async unenroll({ factorId }) { const db = load(); db.factors = db.factors.filter(f => f.id !== factorId); save(db); return { error: null }; },
        async challengeAndVerify({ factorId, code }) {
          const db = load();
          const factor = db.factors.find(f => f.id === factorId && f.user_id === currentUser?.id);
          if (!factor) return { error: { message: 'factor not found' } };
          const step = Math.floor(Date.now() / 30000);
          for (const s of [step, step - 1, step + 1]) if (await totp(factor.secret, s) === code) { factor.status = 'verified'; save(db); return { data: {}, error: null }; }
          return { error: { message: 'Invalid TOTP code entered' } };
        },
      },
    };

    async function rpc(name, params) {
      const db = load();
      const me = currentUser && db.users.find(u => u.id === currentUser.id);
      const clean = key => String(key || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
      if (name === 'recover_password') {
        await new Promise(r => setTimeout(r, 50));
        const user = db.users.find(u => u.email === String(params.login_email).toLowerCase());
        if (!user || !user.recoveryKey || user.recoveryKey !== clean(params.recovery_key)) return { data: null, error: { message: 'Usuario o clave de recuperación incorrectos' } };
        user.password = params.new_password; delete user.recoveryKey; delete user.recoveryAt;
        db.factors = db.factors.filter(f => f.user_id !== user.id); save(db);
        return { data: null, error: null };
      }
      if (['change_my_password', 'create_my_recovery_key', 'my_recovery_key_date'].includes(name)) {
        if (!me) return { data: null, error: { message: 'Inicia sesión primero' } };
        if (name === 'my_recovery_key_date') return { data: me.recoveryAt || null, error: null };
        if (me.password !== params.current_password) return { data: null, error: { message: 'La contraseña actual no es correcta' } };
        if (name === 'change_my_password') { me.password = params.new_password; save(db); return { data: null, error: null }; }
        const raw = Array.from(crypto.getRandomValues(new Uint8Array(15)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        me.recoveryKey = raw; me.recoveryAt = new Date().toISOString(); save(db);
        return { data: raw.match(/.{6}/g).join('-'), error: null };
      }
      if (!isAdmin(db)) return { error: { message: 'Solo el administrador' } };
      if (name === 'admin_create_user') {
        const email = `${params.new_username}@${params.email_domain}`;
        if (db.users.some(u => u.email === email)) return { data: null, error: { message: 'Ese usuario ya existe' } };
        const user = { id: uuid(), email, password: params.new_password };
        db.users.push(user);
        db.tables.profiles.push({ user_id: user.id, email, username: params.new_username, role: 'pending', route_id: null, access_enabled: true, data: {} });
        save(db);
        return { data: user.id, error: null };
      }
      if (name === 'admin_set_password') { const u = db.users.find(x => x.id === params.target); if (u) u.password = params.new_password; }
      if (name === 'admin_reset_mfa') db.factors = db.factors.filter(f => f.user_id !== params.target);
      if (name === 'admin_delete_user') { db.users = db.users.filter(u => u.id !== params.target); db.tables.profiles = db.tables.profiles.filter(p => p.user_id !== params.target); }
      if (name === 'admin_set_username') { const u = db.users.find(x => x.id === params.target); const p = db.tables.profiles.find(x => x.user_id === params.target); u.email = `${params.new_username}@${params.email_domain}`; p.username = params.new_username; p.email = u.email; }
      save(db);
      return { data: null, error: null };
    }

    function channel() {
      const handlers = [];
      const listener = change => {
        const db = load();
        const row = change.new || change.old;
        if (change.eventType !== 'DELETE' && !visible(db, change.table, row)) return;
        handlers.filter(h => h.table === change.table).forEach(h => h.cb(change));
      };
      const ch = {
        on(type, filter, cb) { handlers.push({ table: filter.table, cb }); return ch; },
        subscribe() { listeners.add(listener); return ch; },
        unsubscribe() { listeners.delete(listener); },
      };
      return ch;
    }

    return { auth, from: query, rpc, channel };
  }

  window.supabase = { createClient };
  window.__mockSupabase = { load, save, reset: () => localStorage.removeItem(DB_KEY) };
})();
