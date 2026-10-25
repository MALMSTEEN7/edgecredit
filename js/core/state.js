/**
 * core/state · Estado de sesión y de UI compartido (mutable).
 * Se accede siempre como state.<clave> para que todos los módulos vean el mismo valor.
 */

export const state = {
  customModalSubmit: null,
  customModalCancel: null,
  locationWatchId: null,
  lastLocationWrite: 0,
  lastFocusedElement: null,
  workerRoute: '',
  dailyRouteOrder: {},
  dailyRouteDates: {}, // día en que se armó la ruta de cada cobro (se reinicia al cambiar de día)
  clientLibraryOrder: {},
  collectedRouteClients: {},
  routeVisitOutcomes: {},
  draggedRouteClient: null,
  routePointerDrag: null,
  directoryPointerDrag: null,
  currentView: 'inicio',
  previousView: 'inicio',
  cardSequence: [], // cartulinas de la lista desde la que se abrió la ficha (Anterior / Siguiente)
  activeClient: null,
  activeWorker: null,
  activeSettlement: null,
  settlementDifference: 0,
  userRole: 'worker',
  activeAdminPanel: 'settlement',
  activeOperationList: 'entered',
  authenticatedWorker: null,
  paymentFromHome: false, // el abono se inició desde el Inicio: al guardarlo se vuelve al Inicio
};
