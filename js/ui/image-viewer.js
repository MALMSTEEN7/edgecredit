/**
 * ui/image-viewer · Visor emergente de comprobantes y fotos.
 * Reemplaza los enlaces que abrían la imagen en una pestaña nueva: los navegadores
 * bloquean abrir imágenes guardadas como data: URL en otra pestaña (quedaba en blanco).
 * Cualquier elemento con [data-image-viewer] y la propiedad `viewerSrc` lo abre.
 */

const viewer = () => document.querySelector('#image-viewer');
let lastFocused = null;

function setZoom(zoomed) {
  const box = viewer();
  box.classList.toggle('is-zoomed', zoomed);
  const toggle = document.querySelector('#image-viewer-zoom');
  toggle.setAttribute('aria-pressed', String(zoomed));
  toggle.querySelector('.image-viewer-zoom-label').textContent = zoomed ? 'Ajustar a pantalla' : 'Ampliar';
}

/** Abre el visor con una imagen (data: URL o URL normal). */
export function openImageViewer({ src, title = 'Comprobante', caption = '' }) {
  if (!src) return;
  lastFocused = document.activeElement;
  const box = viewer();
  document.querySelector('#image-viewer-title').textContent = title;
  document.querySelector('#image-viewer-caption').textContent = caption;
  const image = document.querySelector('#image-viewer-img');
  image.src = src;
  image.alt = title;
  setZoom(false);
  box.hidden = false;
  document.body.classList.add('modal-open');
  document.querySelector('#image-viewer-close').focus();
}

export function closeImageViewer() {
  const box = viewer();
  if (!box || box.hidden) return;
  box.hidden = true;
  document.querySelector('#image-viewer-img').removeAttribute('src');
  if (!document.querySelector('.custom-modal-backdrop:not([hidden]), .modal-backdrop:not([hidden]), .ops-list-modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open');
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

/** Prepara un botón para abrir el visor (la imagen se guarda en una propiedad, no en el HTML). */
export function bindImageViewer(element, { src, title, caption }) {
  element.dataset.imageViewer = '';
  element.viewerSrc = src;
  element.viewerTitle = title;
  element.viewerCaption = caption || '';
  return element;
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-image-viewer]');
    if (!trigger) return;
    event.preventDefault();
    openImageViewer({ src: trigger.viewerSrc, title: trigger.viewerTitle, caption: trigger.viewerCaption });
  });
  document.querySelector('#image-viewer-close').addEventListener('click', closeImageViewer);
  document.querySelector('#image-viewer-zoom').addEventListener('click', () => setZoom(!viewer().classList.contains('is-zoomed')));
  document.querySelector('#image-viewer-img').addEventListener('click', () => setZoom(!viewer().classList.contains('is-zoomed')));
  viewer().addEventListener('click', event => { if (event.target === viewer()) closeImageViewer(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeImageViewer(); });
}
