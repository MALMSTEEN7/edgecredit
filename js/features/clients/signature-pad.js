/**
 * features/clients/signature-pad · Firma del cliente al crear la cartulina.
 *
 * Un recuadro donde el cliente firma con el dedo (o el mouse). Es opcional. Se guarda como una
 * imagen pequeña (PNG de trazos, sin fondo) en `client.signatureData`.
 */

const SIGNATURE_ID = '#client-signature';
let drawn = false;

function canvas() { return document.querySelector(SIGNATURE_ID); }

/** Borra la firma del recuadro. */
export function clearSignature() {
  const pad = canvas();
  if (!pad) return;
  pad.getContext('2d').clearRect(0, 0, pad.width, pad.height);
  drawn = false;
  pad.closest('.signature-field')?.classList.remove('has-signature');
}

/** Firma dibujada como imagen, o '' si no firmó. */
export function signatureData() {
  const pad = canvas();
  return pad && drawn ? pad.toDataURL('image/png') : '';
}

function point(pad, event) {
  const box = pad.getBoundingClientRect();
  return { x: (event.clientX - box.left) * (pad.width / box.width), y: (event.clientY - box.top) * (pad.height / box.height) };
}

export function mountSignaturePad() {
  const pad = canvas();
  if (!pad) return;
  const context = pad.getContext('2d');
  let last = null;
  const start = event => {
    event.preventDefault();
    pad.setPointerCapture?.(event.pointerId);
    last = point(pad, event);
    context.fillStyle = '#111827';
    context.beginPath();
    context.arc(last.x, last.y, 1.6, 0, Math.PI * 2);
    context.fill();
    drawn = true;
    pad.closest('.signature-field')?.classList.add('has-signature');
  };
  const move = event => {
    if (!last) return;
    event.preventDefault();
    const next = point(pad, event);
    context.strokeStyle = '#111827';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    last = next;
  };
  const end = () => { last = null; };
  pad.addEventListener('pointerdown', start);
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('pointerleave', end);
  document.querySelector('#client-signature-clear')?.addEventListener('click', clearSignature);
}
