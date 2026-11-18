/**
 * domain/audit-undo · Deshacer un movimiento del historial (consola del administrador).
 *
 * Un movimiento trae la lista de cambios que anotó el servidor (supabase/consola.sql):
 *   { p: ['campo', 'subcampo'], old, new }      un valor cambió
 *   { p: ['payments'], added: […], removed: […] } en una lista se agregaron/quitaron elementos
 *
 * Deshacer aplica lo contrario SOBRE LO ACTUAL, sin pisar lo que pasó después:
 * - Listas: vuelve a poner lo quitado (si no está) y quita lo agregado (si sigue igual).
 * - Montos: resta la diferencia (saldo 120.000 → 116.000 se deshace sumando 4.000 a lo que
 *   haya hoy), así un abono posterior no se pierde.
 * - Otros valores: vuelven al anterior solo si nadie los cambió después; si no, se avisa.
 */

/** JSON con las claves ordenadas (el servidor devuelve los objetos con otro orden). */
export function auditCanonical(value) {
  if (Array.isArray(value)) return `[${value.map(item => auditCanonical(item === undefined ? null : item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${auditCanonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const sameValue = (a, b) => auditCanonical(a) === auditCanonical(b);
const IDENTITY = ['id', 'clientId', 'at', 'ts'];

/** Identidad de un elemento de lista (abono, préstamo, gasto…), o null. */
export function auditItemIdentity(item) {
  if (!item || typeof item !== 'object') return null;
  const key = IDENTITY.find(name => item[name] !== undefined && item[name] !== null && item[name] !== '');
  return key ? `${key}:${item[key]}` : null;
}

/** Las fotos no se guardan en el historial: al volver a poner un elemento se quita la marca «[foto]». */
function withoutPhotoMarks(value) {
  if (Array.isArray(value)) return value.map(withoutPhotoMarks);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '[foto]').map(([key, item]) => [key, withoutPhotoMarks(item)]));
  return value;
}

/** Elementos quitados en un movimiento que no volvieron (no reaparecen entre los agregados). */
export function lostItems(change) {
  if (!Array.isArray(change?.removed) || !change.removed.length) return [];
  const added = new Set((change.added || []).map(auditItemIdentity).filter(Boolean));
  return change.removed.filter(item => {
    const identity = auditItemIdentity(item);
    return !identity || !added.has(identity);
  });
}

function parentFor(target, path, create) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') {
      if (!create) return null;
      node[key] = {};
    }
    node = node[key];
  }
  return node;
}

/**
 * Aplica sobre `target` (cliente o cobro actual) lo contrario de `changes`. Devuelve qué hizo:
 * { applied: [texto], skipped: [texto] }. Con `dryRun` solo lo calcula.
 */
export function undoAuditChanges(target, changes, { dryRun = false, label = path => path.join(' › '), format = value => String(value) } = {}) {
  const applied = [];
  const skipped = [];
  const work = dryRun ? JSON.parse(JSON.stringify(target)) : target;
  (changes || []).forEach(change => {
    const path = Array.isArray(change?.p) ? change.p : [];
    if (!path.length) return;
    const name = label(path);
    const key = path[path.length - 1];
    if ('added' in change || 'removed' in change) {
      const parent = parentFor(work, path, true);
      if (!Array.isArray(parent[key])) parent[key] = [];
      const list = parent[key];
      let removedCount = 0;
      (change.added || []).forEach(item => {
        const index = list.findIndex(current => sameValue(current, item));
        if (index >= 0) { list.splice(index, 1); removedCount += 1; }
        else skipped.push(`${name}: un elemento agregado ya cambió después; se deja como está`);
      });
      let restoredCount = 0;
      (change.removed || []).forEach(item => {
        const identity = auditItemIdentity(item);
        const present = list.some(current => (identity && auditItemIdentity(current) === identity) || sameValue(current, item));
        if (present) return;
        list.push(withoutPhotoMarks(item));
        restoredCount += 1;
      });
      if (restoredCount) applied.push(`${name}: se vuelve${restoredCount === 1 ? '' : 'n'} a poner ${restoredCount} elemento${restoredCount === 1 ? '' : 's'}`);
      if (removedCount) applied.push(`${name}: se quita${removedCount === 1 ? '' : 'n'} ${removedCount} elemento${removedCount === 1 ? '' : 's'} agregado${removedCount === 1 ? '' : 's'}`);
      return;
    }
    const parent = parentFor(work, path, true);
    const current = parent[key];
    const before = change.old;
    const after = change.new;
    if (typeof before === 'number' && typeof after === 'number' && typeof current === 'number') {
      if (before === after) return;
      parent[key] = current + (before - after);
      applied.push(`${name}: ${format(current, key)} → ${format(parent[key], key)}`);
      return;
    }
    if (sameValue(current ?? null, after ?? null)) {
      if (before === null || before === undefined) delete parent[key];
      else parent[key] = withoutPhotoMarks(JSON.parse(JSON.stringify(before)));
      applied.push(`${name}: vuelve al valor anterior`);
      return;
    }
    if (sameValue(current ?? null, before ?? null)) return; // ya está como antes
    skipped.push(`${name}: cambió otra vez después; se deja el valor actual`);
  });
  return { applied, skipped, result: work };
}

/** Datos de un registro borrado, reconstruidos desde su movimiento de borrado. */
export function rebuildDeleted(changes) {
  const data = {};
  (changes || []).forEach(change => {
    if (!Array.isArray(change?.p) || change.p.length !== 1 || !('old' in change) || change.old === null) return;
    data[change.p[0]] = withoutPhotoMarks(change.old);
  });
  return data;
}
