// Simulador mínimo de supabase-js v2 para PRUEBAS sin internet (no se usa en producción).
// Guarda la "base de datos" en localStorage ('mock-supabase-db') y emite los cambios en
// tiempo real con BroadcastChannel, así dos pestañas se comportan como dos dispositivos.
// Emula RLS de forma simple: el trabajador solo lee/escribe filas de su ruta.
// Como el servidor real: `updated_at` lo pone el «servidor» (con su propia hora, que puede
// ir desfasada del navegador: __mockSupabase.setServerSkew), los borrados quedan en
// `deleted_rows` y existe la RPC `server_now()`. Para pruebas: __mockSupabase.setOffline(true)
// simula quedarse sin internet en esta pestaña, dropRealtime() tumba el canal de tiempo real
// (o muteRealtime(true) lo deja «conectado» pero sin entregar cambios) y stats cuenta las
// filas descargadas. Con ?mockSession=<nombre> cada pestaña guarda su
// propia sesión, así dos usuarios pueden recargar a la vez en el mismo navegador.
(() => {
  const DB_KEY = 'mock-supabase-db';
  const TABLE_KEYS = { profiles: 'user_id', routes: 'id', route_state: 'route_id', clients: 'id', pending_requests: 'id', app_settings: 'key', deleted_rows: 'id' };
  const LOGGED_DELETES = ['clients', 'routes', 'route_state', 'pending_requests'];
  const bus = new BroadcastChannel('mock-supabase');
  const listeners = new Set();
  const channels = new Set();
  const control = { offline: false, muted: false, skewMs: 0, stats: { selects: 0, rows: 0, byTable: {} } };
  const load = () => {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || 'null') || { users: [], factors: [], tables: {} };
    Object.keys(TABLE_KEYS).forEach(t => { db.tables[t] ||= []; });
    return db;
  };
  const save = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
  const uuid = () => crypto.randomUUID();
  // Como Postgres (microsegundos): dos escrituras seguidas nunca tienen la misma hora.
  let lastStamp = '';
  let stampSeq = 0;
  const serverNow = () => {
    const base = new Date(Date.now() + control.skewMs).toISOString().replace('Z', '');
    stampSeq = base === lastStamp ? stampSeq + 1 : 0;
    lastStamp = base;
    return `${base}${String(stampSeq).padStart(3, '0')}Z`;
  };
  const offlineError = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
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

  const AUDITED = ['clients', 'routes', 'pending_requests', 'profiles', 'app_settings'];
  const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  function exceptAll(a, b) {
    const left = b.map(canon);
    return a.filter(item => { const i = left.indexOf(canon(item)); if (i >= 0) { left.splice(i, 1); return false; } return true; });
  }
  function auditDiff(a, b, path, depth) {
    if (canon(a) === canon(b)) return [];
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (depth > 0 && isObj(a) && isObj(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => (canon(a[k]) === canon(b[k]) ? [] : auditDiff(a[k] ?? null, b[k] ?? null, [...path, k], depth - 1)));
    if (Array.isArray(a) && Array.isArray(b)) return [{ p: path, added: exceptAll(b, a), removed: exceptAll(a, b) }];
    return [{ p: path, old: a ?? null, new: b ?? null }];
  }

  function createClient(url, anonKey, options = {}) {
    let currentUser = null;
    let currentAal = 'aal1';
    const storageKey = options.auth?.storageKey;
    const persist = options.auth?.persistSession !== false && storageKey;
    const slotName = new URLSearchParams(location.search).get('mockSession');
    const sessionSlot = `mock-session-${storageKey}${slotName ? `-${slotName}` : ''}`;
    if (persist) { try { const saved = JSON.parse(localStorage.getItem(sessionSlot) || 'null'); if (saved) { currentUser = saved.user || saved; currentAal = saved.aal || 'aal1'; } } catch { /* */ } }
    const store = () => { if (!persist) return; if (currentUser) localStorage.setItem(sessionSlot, JSON.stringify({ user: currentUser, aal: currentAal })); else localStorage.removeItem(sessionSlot); };
    const setUser = user => { currentUser = user; currentAal = 'aal1'; store(); };
    const profileOf = db => currentUser && db.tables.profiles.find(p => p.user_id === currentUser.id);
    const isAdmin = db => profileOf(db)?.role === 'admin';
    const scheduleOk = db => { const s = db.tables.app_settings.find(r => r.key === 'worker_access')?.data; if (!s?.enabled) return true; const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes(); const [sh, sm] = s.start.split(':').map(Number); const [eh, em] = s.end.split(':').map(Number); return s.days.includes(now.getDay()) && cur >= sh * 60 + sm && cur < eh * 60 + em; };
    const canRoute = (db, routeId) => { const p = profileOf(db); if (!p) return false; if (p.role === 'admin') return true; return p.role === 'worker' && p.access_enabled !== false && scheduleOk(db) && p.route_id === routeId; };
    const visible = (db, table, row) => {
      if (!currentUser) return false;
      if (table === 'profiles') return row.user_id === currentUser.id || isAdmin(db);
      if (table === 'app_settings') return true;
      if (table === 'deleted_rows') return isAdmin(db) || canRoute(db, row.route_id);
      if (table === 'audit_log') return isAdmin(db);
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
      let action = 'select'; let payload = null; let opts = {}; let single = null; let returning = false;
      let orderCol = null; let orderAsc = true; let rangeFrom = 0; let rangeTo = Infinity;
      const builder = {
        select() { if (action !== 'select') returning = true; return builder; },
        eq(col, val) { filters.push(r => r[col] === val); return builder; },
        gt(col, val) { filters.push(r => String(r[col] || '') > String(val)); return builder; },
        gte(col, val) { filters.push(r => String(r[col] || '') >= String(val)); return builder; },
        lt(col, val) { filters.push(r => (typeof val === 'number' ? Number(r[col]) < val : String(r[col] || '') < String(val))); return builder; },
        order(col, o) { orderCol = col; orderAsc = o?.ascending !== false; return builder; },
        limit(n) { rangeTo = rangeFrom + n - 1; return builder; },
        range(from, to) { rangeFrom = from; rangeTo = to; return builder; },
        in(col, vals) { filters.push(r => vals.includes(r[col])); return builder; },
        maybeSingle() { single = 'maybe'; return builder; },
        single() { single = 'one'; return builder; },
        upsert(rows, o) { action = 'upsert'; payload = rows; opts = o || {}; return builder; },
        update(obj) { action = 'update'; payload = obj; return builder; },
        delete() { action = 'delete'; return builder; },
        then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
      };
      function run() {
        if (control.offline) return offlineError();
        if (!currentUser) return { data: null, error: { message: 'permission denied for table ' + table } };
        const db = load();
        db.tables.audit_log = db.tables.audit_log || [];
        if (table === 'audit_log' && action !== 'select') return { data: null, error: { message: 'permission denied for table audit_log' } };
        const rows = db.tables[table];
        const key = TABLE_KEYS[table];
        // Igual que el trigger de supabase/consola.sql (historial de movimientos).
        const audit = (op, before, after) => {
          if (!AUDITED.includes(table)) return;
          const shape = r => (!r ? {} : table === 'profiles' ? { access_enabled: r.access_enabled, route_id: r.route_id, role: r.role, username: r.username, data: r.data } : (r.data || {}));
          const changes = JSON.parse(JSON.stringify(auditDiff(shape(before), shape(after), [], 2)).replace(/"data:[a-zA-Z]+\/[^"]*"/g, '"[foto]"'));
          if (op === 'update' && !changes.length) return;
          const r = after || before;
          db.tables.audit_log.push({ id: db.tables.audit_log.length + 1, at: serverNow(), table_name: table, row_key: String(r.id ?? r.user_id ?? r.key ?? r.route_id), route_id: table === 'routes' ? r.id : table === 'app_settings' ? null : (r.route_id ?? null), action: op, actor: currentUser.id, actor_name: profileOf(db)?.username || null, changes });
        };
        const match = r => filters.every(f => f(r));
        if (action === 'select') {
          let data = rows.filter(r => visible(db, table, r) && match(r)).map(r => structuredClone(r));
          if (orderCol) data.sort((a, b) => { const x = a[orderCol]; const y = b[orderCol]; const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0); return Math.sign(cmp) * (orderAsc ? 1 : -1); });
          // Igual que PostgREST: como máximo `maxRows` filas por consulta (1.000 por defecto).
          data = data.slice(rangeFrom, Math.min(rangeTo + 1, rangeFrom + (control.maxRows || 1000)));
          control.stats.selects += 1; control.stats.rows += data.length;
          control.stats.byTable[table] = (control.stats.byTable[table] || 0) + data.length;
          if (single) return { data: data[0] || null, error: single === 'one' && !data[0] ? { message: 'not found' } : null };
          return { data, error: null };
        }
        if (action === 'upsert') {
          const list = Array.isArray(payload) ? payload : [payload];
          const rlsError = { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "' + table + '"' } };
          if (list.some(r => !writable(db, table, r))) return rlsError;
          // Igual que el servidor: solo el admin modifica una solicitud que ya existe.
          const exists = r => rows.some(x => x[key] === r[key]);
          if (table === 'pending_requests' && !isAdmin(db) && !opts.ignoreDuplicates && list.some(exists)) return rlsError;
          const written = [];
          list.forEach(r => {
            const index = rows.findIndex(x => x[key] === r[key]);
            if (index >= 0 && opts.ignoreDuplicates) return; // ON CONFLICT DO NOTHING
            if (index >= 0 && !writable(db, table, rows[index])) return;
            const row = { ...(index >= 0 ? rows[index] : {}), ...structuredClone(r), updated_at: serverNow() };
            audit(index >= 0 ? 'update' : 'insert', index >= 0 ? structuredClone(rows[index]) : null, row);
            if (index >= 0) rows[index] = row; else rows.push(row);
            written.push(structuredClone(row));
            emit({ table, eventType: index >= 0 ? 'UPDATE' : 'INSERT', new: row });
          });
          save(db); return { data: returning ? written : null, error: null };
        }
        if (action === 'update') {
          const written = [];
          rows.filter(r => match(r) && visible(db, table, r)).forEach(r => {
            if (!writable(db, table, r)) return;
            const before = structuredClone(r);
            Object.assign(r, structuredClone(payload), { updated_at: serverNow() });
            audit('update', before, r);
            written.push(structuredClone(r));
            emit({ table, eventType: 'UPDATE', new: r });
          });
          save(db); return { data: returning ? written : null, error: null };
        }
        if (action === 'delete') {
          const removed = rows.filter(r => match(r) && writable(db, table, r) && (isAdmin(db)));
          db.tables[table] = rows.filter(r => !removed.includes(r));
          removed.forEach(r => audit('delete', r, null));
          if (LOGGED_DELETES.includes(table)) removed.forEach(r => db.tables.deleted_rows.push({ id: db.tables.deleted_rows.length + 1, table_name: table, row_key: String(r.id ?? r.route_id), route_id: table === 'routes' ? r.id : r.route_id, deleted_at: serverNow() }));
          removed.forEach(r => emit({ table, eventType: 'DELETE', old: { [key]: r[key] } }));
          save(db); return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      return builder;
    }

    const auth = {
      async signInWithPassword({ email, password }) {
        if (control.offline) return { data: {}, error: { message: 'TypeError: Failed to fetch' } };
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
      async getUser() { return control.offline ? { data: { user: null }, error: { message: 'TypeError: Failed to fetch' } } : { data: { user: currentUser }, error: null }; },
      async getSession() {
        return { data: { session: currentUser ? { user: currentUser, access_token: `mock-${currentUser.id}`, expires_at: Math.floor(Date.now() / 1000) + 3600 } : null }, error: null };
      },
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          if (!currentUser) return { data: null, error: { message: 'no session' } };
          const db = load();
          const verified = db.factors.some(f => f.user_id === currentUser.id && f.status === 'verified');
          return { data: { currentLevel: currentAal, nextLevel: verified ? 'aal2' : 'aal1' }, error: null };
        },
        async listFactors() {
          const db = load();
          const all = db.factors.filter(f => f.user_id === currentUser?.id);
          return { data: { all, totp: all.filter(f => f.status === 'verified') }, error: null };
        },
        async enroll() {
          const db = load();
          const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => B32[b % 32]).join('');
          const factor = { id: uuid(), user_id: currentUser.id, secret, status: 'unverified', created_at: new Date().toISOString() };
          db.factors.push(factor); save(db);
          return { data: { id: factor.id, totp: { secret, uri: `otpauth://totp/EdgeCredit:${currentUser.email}?secret=${secret}&issuer=EdgeCredit`, qr_code: '' } }, error: null };
        },
        async unenroll({ factorId }) { const db = load(); db.factors = db.factors.filter(f => f.id !== factorId); save(db); return { error: null }; },
        async challengeAndVerify({ factorId, code }) {
          const db = load();
          const factor = db.factors.find(f => f.id === factorId && f.user_id === currentUser?.id);
          if (!factor) return { error: { message: 'factor not found' } };
          const step = Math.floor(Date.now() / 30000);
          for (const s of [step, step - 1, step + 1]) if (await totp(factor.secret, s) === code) { factor.status = 'verified'; save(db); currentAal = 'aal2'; store(); return { data: {}, error: null }; }
          return { error: { message: 'Invalid TOTP code entered' } };
        },
      },
    };

    async function rpc(name, params) {
      if (control.offline) return offlineError();
      if (name === 'server_now') return currentUser ? { data: serverNow(), error: null } : { data: null, error: { message: 'permission denied' } };
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
      if (name === 'log_sync_merge') {
        if (!currentUser) return { data: null, error: null };
        const route = profileOf(db)?.route_id;
        if (!isAdmin(db) && params.p_route !== route) return { data: null, error: null };
        db.tables.audit_log = db.tables.audit_log || [];
        db.tables.audit_log.push({ id: db.tables.audit_log.length + 1, at: serverNow(), table_name: params.p_table, row_key: params.p_key, route_id: params.p_route, action: 'merge', actor: currentUser.id, actor_name: profileOf(db)?.username || null, changes: params.p_changes || [] });
        save(db);
        return { data: null, error: null };
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
      let statusCb = () => {};
      let joined = false;
      const listener = change => {
        if (!joined || control.offline || control.muted) return;
        const db = load();
        const row = change.new || change.old;
        if (change.eventType !== 'DELETE' && !visible(db, change.table, row)) return;
        handlers.filter(h => h.table === change.table).forEach(h => h.cb(change));
      };
      const ch = {
        on(type, filter, cb) { handlers.push({ table: filter.table, cb }); return ch; },
        subscribe(cb) {
          statusCb = cb || (() => {});
          listeners.add(listener); channels.add(ch);
          setTimeout(() => { if (!channels.has(ch)) return; if (control.offline) { statusCb('TIMED_OUT'); return; } joined = true; statusCb('SUBSCRIBED'); }, 30);
          return ch;
        },
        unsubscribe() { listeners.delete(listener); if (channels.delete(ch)) { joined = false; statusCb('CLOSED'); } return Promise.resolve('ok'); },
        _drop(status) { if (!joined) return; joined = false; statusCb(status); },
      };
      return ch;
    }
    const removeChannel = ch => ch.unsubscribe();

    return { auth, from: query, rpc, channel, removeChannel };
  }

  window.supabase = { createClient };
  window.__mockSupabase = {
    load, save, reset: () => localStorage.removeItem(DB_KEY), stats: control.stats,
    resetStats() { control.stats.selects = 0; control.stats.rows = 0; control.stats.byTable = {}; },
    setServerSkew(ms) { control.skewMs = ms; },
    setOffline(on) { control.offline = on; if (on) channels.forEach(ch => ch._drop('CHANNEL_ERROR')); },
    muteRealtime(on) { control.muted = on; },
    dropRealtime(status = 'CHANNEL_ERROR') { channels.forEach(ch => ch._drop(status)); },
    channelCount: () => channels.size,
  };
})();
