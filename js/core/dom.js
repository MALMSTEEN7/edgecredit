/**
 * core/dom · Referencias a nodos estáticos de index.html.
 * Único lugar donde se consultan elementos fijos al cargar; los módulos los importan.
 */

export const views = [...document.querySelectorAll('.view')];
export const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
export const clientButtons = [...document.querySelectorAll('[data-client]')];
export const detailView = document.querySelector('#detalle-cliente');
export const modal = document.querySelector('#payment-modal');
export const paymentForm = document.querySelector('#payment-form');
export const voucherField = document.querySelector('#voucher-field');
export const voucherFile = document.querySelector('#voucher-file');
export const amountInput = document.querySelector('#payment-amount');
export const disclosureButton = document.querySelector('.disclosure-button');
export const creditDetails = document.querySelector('#credit-details');
export const themeToggle = document.querySelector('#theme-toggle');
export const themeDescription = document.querySelector('#theme-description');
export const baseInput = document.querySelector('#work-base-input');
export const cashTotal = document.querySelector('#cash-total');
export const interestToggle = document.querySelector('#interest-toggle');
export const interestModal = document.querySelector('#interest-modal');
export const specificInterestForm = document.querySelector('#specific-interest-form');
export const specificInterestInput = document.querySelector('#specific-interest-amount');
export const loginGateway = document.querySelector('#login-gateway');
export const workerView = document.querySelector('#worker-view');
export const adminView = document.querySelector('#admin-view');
export const routeSelect = document.querySelector('#route-select');
export const adminFeedback = document.querySelector('#admin-feedback');
export const settlementInputs = [...document.querySelectorAll('[data-settlement-field]')];
export const personnelList = document.querySelector('#personnel-list');
export const customModal = document.querySelector('#custom-modal');
export const customModalForm = document.querySelector('#custom-modal-form');
export const customModalFields = document.querySelector('#custom-modal-fields');
export const customModalError = document.querySelector('#custom-modal-error');
export const appToast = document.querySelector('#app-toast');
/** Testigo del GPS del trabajador (solo indica el estado; no es un botón). */
export const gpsIndicator = document.querySelector('#gps-indicator');
export const newClientModal = document.querySelector('#new-client-modal');
export const newClientForm = document.querySelector('#new-client-form');
export const newClientError = document.querySelector('#new-client-error');
export const pendingList = document.querySelector('#pending-list');
export const loginError = document.querySelector('#login-error');
export const operationsModal = document.querySelector('#operations-list-modal');
export const operationsResults = document.querySelector('#operations-list-results');
export const operationsSearch = document.querySelector('#operations-list-search');
export const directoryClientList = document.querySelector('#directorio .client-list');
