/**
 * core/config · Constantes de negocio y catálogos (frecuencias, valores demo).
 */

export const paymentFrequencyDays = { daily: 1, weekly: 7, biweekly: 15, monthly: 30 };

export const paymentFrequencyLabels = { daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };

export const adminPasswordHash = 'b5af2beb9b7fd5aa4eb21b61925bd3856793e54e0a39052fbcfaf5b477fd07f3';

/**
 * MODO DE PRUEBA de «Cuadrar seguros» (temporal, para verificar el cálculo):
 * permite cuadrar cualquier mes, elegir la fecha y hora del cuadre, cuadrar varias veces
 * y deshacer el último cuadre. Para volver al funcionamiento normal (solo el mes en curso,
 * con la hora actual) cámbialo a false y ejecuta `node tools/bundle.mjs`.
 */
export const INSURANCE_CUT_TEST_MODE = false;
