/**
 * core/geo-colombia · Catálogo de departamentos de Colombia con su capital y una
 * caja aproximada [sur, oeste, norte, este] en grados. El mapa la usa para enfocar
 * el departamento del trabajador sin depender de un servicio de geocodificación.
 */

export const COLOMBIA_BOUNDS = [[-4.3, -79.1], [12.6, -66.8]];

export const DEPARTMENTS = [
  { name: 'Amazonas', capital: 'Leticia', center: [-4.215, -69.94], bbox: [-4.23, -74.4, 0.2, -69.4] },
  { name: 'Antioquia', capital: 'Medellín', center: [6.2442, -75.5812], bbox: [5.4, -77.1, 8.9, -73.85] },
  { name: 'Arauca', capital: 'Arauca', center: [7.0847, -70.7591], bbox: [6.0, -72.4, 7.1, -69.4] },
  { name: 'Atlántico', capital: 'Barranquilla', center: [10.9685, -74.7813], bbox: [10.27, -75.28, 11.11, -74.71] },
  { name: 'Bogotá D.C.', capital: 'Bogotá', center: [4.711, -74.0721], bbox: [3.73, -74.45, 4.84, -73.99] },
  { name: 'Bolívar', capital: 'Cartagena', center: [10.391, -75.4794], bbox: [7.0, -75.8, 10.8, -73.7] },
  { name: 'Boyacá', capital: 'Tunja', center: [5.5353, -73.3678], bbox: [4.65, -74.7, 7.1, -71.95] },
  { name: 'Caldas', capital: 'Manizales', center: [5.0703, -75.5138], bbox: [4.75, -75.95, 5.8, -74.65] },
  { name: 'Caquetá', capital: 'Florencia', center: [1.6144, -75.6062], bbox: [-1.0, -76.3, 2.35, -71.5] },
  { name: 'Casanare', capital: 'Yopal', center: [5.3378, -72.3959], bbox: [4.25, -73.1, 6.35, -69.8] },
  { name: 'Cauca', capital: 'Popayán', center: [2.4448, -76.6147], bbox: [0.95, -77.95, 3.35, -75.75] },
  { name: 'Cesar', capital: 'Valledupar', center: [10.4631, -73.2532], bbox: [7.65, -74.15, 10.85, -72.85] },
  { name: 'Chocó', capital: 'Quibdó', center: [5.6947, -76.6611], bbox: [3.95, -77.9, 8.7, -75.85] },
  { name: 'Córdoba', capital: 'Montería', center: [8.7479, -75.8814], bbox: [7.35, -76.5, 9.45, -74.75] },
  { name: 'Cundinamarca', capital: 'Bogotá', center: [4.711, -74.0721], bbox: [3.7, -74.9, 5.85, -73.05] },
  { name: 'Guainía', capital: 'Inírida', center: [3.8653, -67.9239], bbox: [1.15, -70.95, 4.05, -67.3] },
  { name: 'Guaviare', capital: 'San José del Guaviare', center: [2.5729, -72.6459], bbox: [0.6, -73.75, 2.95, -69.9] },
  { name: 'Huila', capital: 'Neiva', center: [2.9273, -75.2819], bbox: [1.55, -76.6, 3.85, -74.4] },
  { name: 'La Guajira', capital: 'Riohacha', center: [11.5444, -72.9072], bbox: [10.4, -73.65, 12.47, -71.1] },
  { name: 'Magdalena', capital: 'Santa Marta', center: [11.2408, -74.199], bbox: [8.9, -74.95, 11.35, -73.55] },
  { name: 'Meta', capital: 'Villavicencio', center: [4.142, -73.6266], bbox: [1.6, -74.9, 4.9, -71.05] },
  { name: 'Nariño', capital: 'Pasto', center: [1.2136, -77.2811], bbox: [0.35, -79.05, 2.7, -76.8] },
  { name: 'Norte de Santander', capital: 'Cúcuta', center: [7.8939, -72.5078], bbox: [6.85, -73.65, 9.3, -72.05] },
  { name: 'Putumayo', capital: 'Mocoa', center: [1.1462, -76.6478], bbox: [-0.45, -77.1, 1.45, -73.85] },
  { name: 'Quindío', capital: 'Armenia', center: [4.5339, -75.6811], bbox: [4.05, -75.9, 4.75, -75.35] },
  { name: 'Risaralda', capital: 'Pereira', center: [4.8133, -75.6961], bbox: [4.65, -76.35, 5.5, -75.4] },
  { name: 'San Andrés y Providencia', capital: 'San Andrés', center: [12.5847, -81.7006], bbox: [12.45, -81.75, 13.4, -81.3] },
  { name: 'Santander', capital: 'Bucaramanga', center: [7.1193, -73.1227], bbox: [5.7, -74.55, 8.15, -72.45] },
  { name: 'Sucre', capital: 'Sincelejo', center: [9.3047, -75.3978], bbox: [8.25, -75.75, 9.85, -74.5] },
  { name: 'Tolima', capital: 'Ibagué', center: [4.4389, -75.2322], bbox: [2.85, -76.1, 5.35, -74.45] },
  { name: 'Valle del Cauca', capital: 'Cali', center: [3.4516, -76.532], bbox: [3.05, -77.55, 5.05, -75.7] },
  { name: 'Vaupés', capital: 'Mitú', center: [1.2536, -70.2345], bbox: [-1.2, -71.95, 2.0, -69.1] },
  { name: 'Vichada', capital: 'Puerto Carreño', center: [6.189, -67.4859], bbox: [2.6, -71.1, 6.3, -67.4] },
];

export function findDepartment(name) {
  const key = normalize(name);
  return DEPARTMENTS.find(item => normalize(item.name) === key) || null;
}

/** Opciones para un <select> de departamento (formato del modal genérico). */
export function departmentOptions() {
  return [{ value: '', label: 'Selecciona un departamento' }, ...DEPARTMENTS.map(item => ({ value: item.name, label: item.name }))];
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim();
}
