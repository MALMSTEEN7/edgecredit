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
  clientLibraryOrder: {},
  collectedRouteClients: {},
  routeVisitOutcomes: {},
  workBaseAmount: 0,
  workBaseAccount: 'cash',
  workBaseCash: 0,
  workBaseBank: 0,
  draggedRouteClient: null,
  routePointerDrag: null,
  directoryPointerDrag: null,
  currentView: 'inicio',
  previousView: 'inicio',
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
