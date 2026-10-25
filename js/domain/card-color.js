/**
 * domain/card-color · Color de cada cartulina, como en el sistema anterior.
 *
 * Las semanales se agrupan por el día de la semana en que pagan (el mismo día en que arrancó
 * el crédito); las quincenales y mensuales tienen su propio color. Solo es un indicador:
 * la tarjeta no se pinta completa.
 */

const WEEKDAY_COLORS = {
  1: { key: 'monday', label: 'Lunes', color: '#7e57c2' }, // morado
  2: { key: 'tuesday', label: 'Martes', color: '#ad1457' }, // rosado oscuro
  3: { key: 'wednesday', label: 'Miércoles', color: '#8a8f98' }, // gris
  4: { key: 'thursday', label: 'Jueves', color: '#1e63d6' }, // azul
  5: { key: 'friday', label: 'Viernes', color: '#3eb489' }, // verde menta
  6: { key: 'saturday', label: 'Sábado', color: '#e53935' }, // rojo
};
const FREQUENCY_COLORS = {
  biweekly: { key: 'biweekly', label: 'Quincenal', color: '#f48fb1' }, // rosado
  monthly: { key: 'monthly', label: 'Mensual', color: '#89cff0' }, // azul bebé
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

/** Pinta (o quita) la etiqueta de color en `element`. */
export function paintCardColorTag(element, client) {
  const color = cardColor(client);
  element.hidden = !color;
  if (!color) return;
  element.dataset.cardColor = color.key;
  element.style.setProperty('--card-color', color.color);
  element.textContent = color.label;
  element.title = color.key === 'biweekly' || color.key === 'monthly' ? `Cartulina ${color.label.toLocaleLowerCase('es')}` : `Cartulina semanal · paga los ${color.label.toLocaleLowerCase('es')}`;
}
