/**
 * domain/card-color · Color de cada cartulina, como en el sistema anterior.
 *
 * Las semanales se agrupan por el día de la semana en que pagan (el mismo día en que arrancó
 * el crédito); las quincenales y mensuales tienen su propio color. Se muestra como una franja
 * en el borde superior de la tarjeta (como la pestaña de una carpeta) con el día escrito.
 */

const WEEKDAY_COLORS = {
  1: { key: 'monday', label: 'Lunes', color: '#7e57c2', ink: '#fff' }, // morado
  2: { key: 'tuesday', label: 'Martes', color: '#ad1457', ink: '#fff' }, // rosado oscuro
  3: { key: 'wednesday', label: 'Miércoles', color: '#8a8f98', ink: '#111' }, // gris
  4: { key: 'thursday', label: 'Jueves', color: '#1e63d6', ink: '#fff' }, // azul
  5: { key: 'friday', label: 'Viernes', color: '#3eb489', ink: '#0b2a1f' }, // verde menta
  6: { key: 'saturday', label: 'Sábado', color: '#e53935', ink: '#fff' }, // rojo
};
const FREQUENCY_COLORS = {
  biweekly: { key: 'biweekly', label: 'Quincenal', color: '#f48fb1', ink: '#3b0a1e' }, // rosado
  monthly: { key: 'monthly', label: 'Mensual', color: '#89cff0', ink: '#0a2a3b' }, // azul bebé
};

/** Color de la cartulina o null (diarias, o semanales que arrancaron un domingo). */
export function cardColor(client) {
  if (!client) return null;
  if (FREQUENCY_COLORS[client.frequency]) return FREQUENCY_COLORS[client.frequency];
  if (client.frequency && client.frequency !== 'weekly') return null;
  const [year, month, day] = String(client.creditStartDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return WEEKDAY_COLORS[new Date(year, month - 1, day).getDay()] || null;
}

/** Pinta (o quita) la franja de color en `band`; `card` (opcional) recibe la clase y el color del borde. */
export function paintCardColorBand(band, client, card = null) {
  const color = cardColor(client);
  band.hidden = !color;
  card?.classList.toggle('has-card-color', Boolean(color));
  if (!color) return;
  [band, card].forEach(node => {
    if (!node) return;
    node.dataset.cardColor = color.key;
    node.style.setProperty('--card-color', color.color);
    node.style.setProperty('--card-color-ink', color.ink);
  });
  band.textContent = color.label;
  band.title = color.key === 'biweekly' || color.key === 'monthly' ? `Cartulina ${color.label.toLocaleLowerCase('es')}` : `Cartulina semanal · paga los ${color.label.toLocaleLowerCase('es')}`;
}
