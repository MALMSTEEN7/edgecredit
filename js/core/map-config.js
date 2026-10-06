/**
 * core/map-config · Configuración del mapa de clientes.
 *
 * CARTO exige una API key en cada tesela (?key=...). Esta clave viaja al navegador,
 * así que es pública por naturaleza: protégela en el panel de CARTO con
 * "website restrictions" (dominios permitidos) en lugar de intentar ocultarla.
 * Si se deja vacía, el mapa usa las teselas estándar de OpenStreetMap.
 */
export const CARTO_API_KEY = 'cb1_46nk_1_245cd44315c027f9a302c302';
