# EdgeCredit · Arquitectura del frontend (vanilla modular)

El monolito original (`app.js` de 2.663 líneas en un IIFE y `styles.css` de 479 líneas con parches acumulados) se partió en **módulos ES nativos** y **módulos CSS**. El código fuente vive en módulos; `tools/bundle.mjs` genera la versión empaquetada que carga la app (ver "Cómo ejecutarlo").

## Cómo ejecutarlo

Por defecto, `index.html` carga la **versión empaquetada con sello de versión**, tanto con doble clic (`file://`) como desde un servidor:

- `dist/app.bundle.js?v=<versión>`: todos los módulos de `js/` y `app.js` en un solo archivo.
- `dist/styles.bundle.css?v=<versión>`: todos los `@import` de `styles.css` en orden.

El sello cambia con cada build. Así el navegador **no puede seguir usando JS o CSS viejos de su caché**, que era el motivo de ver mensajes antiguos después de una actualización.

**Después de editar cualquier archivo de `js/`, `css/`, `app.js` o `styles.css`**, regenera los paquetes. El comando también actualiza el sello en `index.html`:

```bash
node tools/bundle.mjs
```

- **Modo desarrollo con módulos sueltos:** abre `http://localhost:8080/index.html?dev` desde un servidor local (por ejemplo, `python -m http.server 8080`). Carga `app.js` y `styles.css` directamente, sin empaquetar.
- **Verificación:** el CSS empaquetado se comprobó contra el modo `?dev`; los estilos calculados de 1.213 elementos coinciden.

El paquete junta todos los módulos en un único scope. Por eso dos módulos no pueden declarar el mismo nombre de primer nivel. Si eso ocurre, `bundle.mjs` se detiene, indica qué nombre y qué archivos chocan, y hay que renombrar uno de los dos.

## Analogía con Docker

| Docker | Aquí |
|---|---|
| `docker-compose.yml` | `app.js`: lista `MODULES` y la secuencia `boot()` |
| Contenedor / servicio | Cada archivo en `js/features/**` y `js/ui/**`, con su `mount()` |
| Volumen compartido | `js/core/store.js` (datos de negocio) y `js/core/state.js` (sesión/UI) |
| Imagen base | `js/shared/**` (funciones puras) y `css/tokens.css` (tokens de diseño) |
| Red interna | Imports ES explícitos: cada módulo declara de quién depende |

## Estructura

```
index.html            Marcado de todas las vistas (sin cambios funcionales)
app.js                Raíz de composición: monta módulos y arranca
styles.css            Entrada CSS: solo @import en orden de cascada
js/
  core/               dom (refs a nodos), state (sesión/UI), config, store (datos + persistencia),
                      geo-colombia (departamentos, capitales y cajas para el mapa),
                      map-config (key CARTO), security-config (2FA, bloqueo, dispositivo recordado)
  shared/             format, dates, math, media, crypto, geo (GPS del dispositivo), totp (2FA)
  domain/             loan-schedule, accounting, insurance, person-cards, access-schedule → reglas de negocio, sin DOM
  ui/                 toast, custom-modal, theme, network, navigation, shortcuts
  features/
    auth/             session (login/logout), two-factor (TOTP), device-trust (dispositivo recordado)
    clients/          directory, new-client, client-detail, interest
    payments/         payment
    daily-route/      daily-route
    worker/           cash-box, expenses, location
    admin/            admin-shell, settlement, client-map, evidence, reports, pending, personnel, access-hours
    operations/       operations-list
  vendor/             qrcode (generador QR sin red, MIT)
css/
  tokens.css          Paleta Dark Fintech + tema claro (fuente única de colores)
  base.css            Reset, elementos y utilidades
  components/         brand, buttons, forms, badges, modals
  layout/             worker-shell (bottom-bar/sidebar), admin-shell
  features/           un archivo por pantalla/flujo
  themes/light.css    Ajustes de componentes en tema claro
```

## Mapa de clientes (admin)

- **Sección:** "Mapa de clientes", debajo de Liquidación. Muestra los clientes del cobro elegido en el selector de rutas.
- **Colores:** salen de `paymentBehavior(client).tier`, que es el mismo cálculo de la biblioteca de clientes. Verde es `good` (al día). Naranja es `regular` (historial irregular o atraso menor a un período). Rojo es `bad` (atraso de un período o más). Los filtros de la leyenda ocultan o muestran cada grupo.
- **Encuadre:** siempre se recalcula al abrir el mapa, al cambiar de cobro y al volver del directorio. El orden es:
  1. Clientes ubicados. Si hay uno, zoom de barrio; si hay varios, un recuadro de al menos ~1,3 km.
  2. Zona del cobro (`route.mapZone`). Se crea al guardar un trabajador, buscando su municipio en Nominatim, o con el botón "Fijar esta vista como zona del cobro".
  3. El municipio buscado en línea.
  4. El departamento.
  5. Colombia.

  La lista "En el mapa" acerca la vista a un cliente puntual y "Ver todo el cobro" vuelve al encuadre general.
- **Alta de clientes por el admin:** el admin no ve "solicitar excepción de interés". Fija directamente el interés (20 % por defecto), sin pasar por Pendientes. Los seguros funcionan igual que para el trabajador (ver "Seguros").
- **Ubicación de los clientes:** se guarda en `client.location`. Se captura sola con el GPS del trabajador al crear el cliente (o al renovar con una dirección nueva). Registrar un abono ya no pide la ubicación. El admin puede ubicar o reubicar clientes haciendo clic en el mapa.
- **Dependencias externas:** Leaflet 1.9.4 (cdnjs) se descarga la primera vez que se abre la sección.
- **Capas base:** Calles (CARTO Voyager, predeterminada) y Oscuro (CARTO Dark Matter) usan la API key de CARTO definida en `js/core/map-config.js`. Satélite (Esri) no necesita key. Si la key queda vacía, Calles pasa a OpenStreetMap estándar.
- **La key de CARTO es pública por diseño**, porque viaja al navegador. Debe protegerse con restricciones de dominio en el panel de CARTO. Ojo: con restricciones de dominio, el modo doble clic (`file://`) deja de cargar las teselas, porque no envía dominio; para eso hay que usar una key separada de desarrollo.
- **Plan gratuito:** 1 millón de teselas al mes para uso comercial.

## Reglas de dependencia

1. `shared/` y `domain/` **no** importan nada de `features/` ni de `ui/`. `domain/` no toca el DOM.
2. `core/state.js` no importa nada (evita ciclos de inicialización).
3. Los módulos **no ejecutan nada al importarse**: todo efecto vive en `mount()` (listeners) o en funciones exportadas. Por eso los ciclos entre features (p. ej. `client-detail` ↔ `directory`) son seguros: solo se resuelven en tiempo de ejecución.
4. El estado mutable se accede siempre como `state.clave`; nunca se re-exporta un `let`.
5. Un CSS de `features/` solo estiliza clases de esa feature; los colores salen de `var(--…)` en `tokens.css`.

## Añadir un módulo nuevo

1. Crea `js/features/<dominio>/<modulo>.js` con sus funciones y un `export function mount() { … }` que registre sus listeners.
2. Impórtalo en `app.js` y agrégalo a `MODULES`.
3. Si tiene estilos, crea `css/features/<modulo>.css` y añade su `@import` en `styles.css` (antes de `themes/`).

## Cómo se verificó la refactorización

El código se generó con un transformador basado en el AST (TypeScript compiler API), no a mano: cada `let` del IIFE pasó a `state.*` y los imports y exports se calcularon resolviendo símbolos. Después se ejecutó el **mismo guion de 48 pasos** en la versión original y en la modular, con Chromium a 390 px y a 1366 px. El guion recorre el login de trabajador y de admin, la caja, los gastos con foto, la ruta diaria, el directorio, la ficha, los pagos, el alta de clientes, el tema claro, la liquidación con descuadre, las aprobaciones, los reportes, el personal, la edición de cliente y la edición de abonos. En cada paso se comparó:

- el DOM completo,
- el `localStorage`,
- los estilos computados de cada elemento visible (todas las propiedades CSS).

Resultado: idéntico en todos los pasos. Hay un solo cambio visual deliberado: `tokens.css` adopta la paleta de la especificación (`#1E1E1E` para tarjetas, `#2979FF` de acento y `#E0E0E0` para el texto).

## Limpieza aplicada

- Se eliminaron 52 selectores CSS muertos: clases que no existen en el HTML ni en el JS, como `.ops-list`, `.quick-interest`, `.cash-group`, `.filter-button` y `.money-value`.
- Se eliminaron declaraciones que nunca aplicaban porque una regla posterior las anulaba (`.client-detail{max-width:950px}`, anchos de `.close-route-button` y `.add-worker-button`).
- Los dos bloques `:root` duplicados se consolidaron en uno por tema.

## Deuda técnica conocida (siguiente fase)

- **Seguridad:** la autenticación es 100 % cliente. Los hashes de contraseña viven en el JS y en `localStorage`, y las credenciales demo se muestran en el login. Es aceptable para demo, no para producción. Requiere el backend (FastAPI + JWT en cookie HttpOnly).
- **Persistencia:** `localStorage` guarda fotos en base64. Se llena rápido (~5 MB). Lo correcto es IndexedDB (Dexie) con una cola de sincronización.
- `core/store.js#ensureRoute` actualiza el `<select>` de rutas. Es un efecto de UI dentro de la capa de datos y debería emitir un evento.
- Persisten colores hex sueltos en componentes (`#292929`, `#343434`…). Conviene migrarlos a tokens.
- Varias features escriben en `client.*` directamente. El siguiente paso natural es un servicio de dominio por agregado (cliente, ruta) que centralice mutaciones y auditoría (event sourcing simplificado del spec).

## Auditoría y cierres (admin)

- **Comprobantes:** tienen un selector de fecha (por defecto hoy). Las transferencias y los "otros gastos" sin foto también se muestran, marcados "Sin comprobante" y listados primero, con un resumen por panel. El trabajador puede registrar un gasto sin foto: queda marcado para auditoría.
- **Cierre de ruta:** "Verificar y Cerrar Ruta" guarda `route.lastClosure` con una foto de los valores enviados. En el selector de rutas, el cobro aparece con ✓ si se cuadró hoy y sin cambios, o con ⚠ si se editó después del envío. Debajo del selector se muestra el estado.
- **Reportes:** los selectores de mes listan los 12 meses del año en curso. El cierre semanal y el mensual comparten el mes elegido. El consolidado mensual de seguros se reparte por semanas del mes según los días hábiles. Las cifras de reportes siguen siendo de demostración (salen de los totales de la ruta) hasta conectar el backend.

## Inicio del trabajador y datos del cliente

- **Inicio** (`features/worker/home.js`):
  - Primero se ven los clientes de la ruta del día. Si la ruta no se organizó, hay un aviso y un acceso a "Ruta diaria".
  - "Tu caja hoy" (con el total en caja a la vista) y "Resumen del día" son botones que despliegan su panel.
  - "Otros gastos" se registra desde la tarjeta del resumen ("＋ Registrar gasto"), que abre un menú con monto, descripción y foto (`features/worker/expenses.js`).
- **Dirección alternativa** (`client.altAddress` / `client.altLocation`): se agrega en el alta con el botón "Dirección alternativa" y se edita en "Editar cliente". En el mapa, la ficha rápida tiene "Ir a dirección alternativa" o "Ubicar dirección alternativa", y el punto alternativo es un círculo hueco punteado del mismo color.
- **Notas del cliente** (`client.comment`, `commentUpdatedAt/By`): un recuadro en la ficha que editan el trabajador y el admin, con registro de quién y cuándo editó por última vez.
- **Historial de direcciones** (`client.addressHistory`): cuando el admin cambia la dirección principal o la alternativa, la anterior queda en "Ver detalles del crédito → Direcciones anteriores". También se guarda su ubicación GPS, y la ubicación vigente se borra para volver a ubicarla.
- **Reportes:**
  - Semanas de lunes a sábado dentro del mes: **4 o 5** según el mes. Si el corte diera 6 (un sábado 1 y un lunes 31, por ejemplo), el tramo más corto de los extremos se une a su vecino. La última semana incluye la fila **Total del mes**.
  - Los meses aparecen solo con su nombre y el año sale de la fecha actual.

## Cobro diario (Inicio ↔ Ruta diaria)

- **Inicio:** cada cliente de la ruta del día tiene "＋ Registrar cuota" y "No pagó hoy" (este pide confirmación). Al registrar cualquier abono o marcar "No pagó", la visita se cierra sola (`closeVisit`) y el cliente sale del Inicio. Si el abono se inició desde el Inicio, al guardarlo se vuelve al Inicio.
- **Ruta diaria → Clientes de hoy:** la lista se conserva como se armó y solo muestra indicadores (no son botones): "✓ Abono registrado · $X" (solo abonos de hoy), "✕ No pagó hoy" o "Pendiente". Las visitas cerradas tienen "Solicitar revisión". Se retiró el botón "Cobrado".
- **Biblioteca de la ruta:** solo muestra cartulinas activas (saldo > 0). Ya no tiene "Solicitar revisión".
- **Notas:** "Indicaciones del domicilio" (`client.addressNotes`) se escribe al crear el cliente y se muestra en "Ver detalles del crédito"; solo el admin la cambia desde "Editar cliente". "Notas del cliente" (`client.notes`) es el recuadro editable por trabajador y admin. Al arrancar, `normalizeClientNotes()` mueve el antiguo `comment` a `addressNotes`.

## Mapa para trabajadores, directorio y visor de comprobantes

- **Mapa compartido:** el bloque del mapa (`.client-map-layout`) es uno solo y se mueve entre `#admin-map-host` (panel del admin) y `#worker-map-host` (vista "Mapa" del trabajador, en la barra inferior). Para el trabajador el mapa siempre muestra su propio cobro. Puede **ubicar y reubicar** el domicilio y la dirección alternativa de sus clientes (la ubicación queda con `source: 'trabajador'`); solo el admin puede usar "Fijar zona".
- **Directorio:** el botón "Nuevo cliente" está a la derecha del buscador, para el trabajador y para el admin.
- **Visor de comprobantes** (`ui/image-viewer.js`): las fotos de transferencias y gastos se abren en una ventana emergente con "Ampliar / Ajustar a pantalla" y cierre (botón ×, clic fuera o Escape). Antes se abrían en otra pestaña como `data:` URL, que el navegador bloquea y dejaba en blanco. Para usarlo en otro lugar: `bindImageViewer(boton, { src, title, caption })`.

## Ajustes de alta y mapa

- **Alta de clientes:** ya no se pregunta la ruta. El cliente queda en el cobro abierto: para el admin, el elegido en "Zonas / Rutas"; para el trabajador, el suyo. El encabezado del formulario muestra en qué ruta se registrará. Para mover un cliente de cobro se usa "Editar cliente".
- **Dirección alternativa en el mapa:** no se dibuja por defecto. Aparece solo al pulsar "Ir a dirección alternativa" y se oculta al abrir otro cliente o al cambiar de cobro (`showAltLocation` / `hideAltLocation`).

## Tarjetas canceladas y posición en la ruta

- **Tarjeta cancelada** = cartulina con la deuda en cero. `syncCancelledCard()` (domain/accounting) la agrega cuando el saldo llega a cero y la retira si vuelve a deber, por ejemplo cuando el admin corrige o elimina un abono. Al arrancar, `normalizeCancelledCards()` quita de las listas las tarjetas de clientes que aún deben.
- **Posición al crear un cliente:** en el alta se busca un cliente del cobro y se elige "Antes de" o "Después de". El nuevo cliente queda en ese lugar del orden de la ruta (`state.clientLibraryOrder`), que usan la Biblioteca y el Directorio. Si no se elige nada, queda al final.

- **Cómo llegar:** la ficha rápida del mapa (domicilio y dirección alternativa) tiene "Cómo llegar · Google Maps", que abre `google.com/maps/dir/?api=1&destination=lat,lng` con la ruta desde la ubicación actual; en el celular abre la app de Google Maps. En la ficha del cliente, "Ver ubicación del domicilio" usa las coordenadas GPS cuando existen y, si no, busca la dirección escrita.

## Seguridad del inicio de sesión

Flujo: usuario + contraseña → verificación en dos pasos (salvo en un dispositivo recordado) → app.

- **Verificación en dos pasos (TOTP, RFC 6238)** (`shared/totp.js`, `features/auth/two-factor.js`):
  - Funciona con Google Authenticator, Microsoft Authenticator, Authy, etc. Usa códigos de 6 dígitos que cambian cada 30 s y acepta ±30 s de desfase del reloj. Un mismo código no se puede reutilizar.
  - **Primer ingreso de cada cuenta:** se muestra un QR (generado sin conexión con `js/vendor/qrcode.js`, licencia MIT) y la clave manual. Se confirma con un código y se entregan **6 códigos de respaldo** de un solo uso. Solo se guarda su hash SHA-256.
  - **Dónde se guarda:** la configuración de cada trabajador vive en su registro de `personnel` (`totpSecret`, `recoveryHashes`, `totpLastStep`). La del admin vive en `security.admin` (store). Todo queda en `localStorage`, igual que las contraseñas, hasta que exista el backend.
  - **Restablecer:** en Personal, "Restablecer 2FA" obliga al trabajador a escanear un QR nuevo, por ejemplo si cambió de celular. El admin entra con un código de respaldo si pierde su celular.
- **Bloqueo:** 5 intentos fallidos (de contraseña o de código) bloquean el ingreso 60 s en ese dispositivo.
- **Límite conocido:** sin servidor, alguien con acceso al navegador podría leer `localStorage`. La protección real llega al mover contraseñas y secretos TOTP al backend (FastAPI).

## Seguros, renovación y GPS de abonos

- **Seguros** (`domain/insurance.js`):
  - El valor general es el **10 % del préstamo**, y el formulario lo muestra en vivo.
  - Quien crea el crédito (trabajador o admin) puede marcar "Cobrar un valor de seguros diferente". En ese caso escribe el **valor en pesos** y un **motivo obligatorio**. Ya no se envía una solicitud al admin.
  - Se guarda en `client.insuranceAmount`, `insuranceCustom`, `insuranceReason` e `insuranceCollectedAt`. "Ver detalles del crédito" muestra el valor y, si es especial, el motivo. El admin puede corregirlos en "Editar cliente".
  - Las cartulinas antiguas que tenían el porcentaje (`insurancePercent`) se leen con `clientInsurance()`.
- **Seguros del día:**
  - Se cobran al entregar el préstamo y entran a la caja ese día: `addToWorkBase()` los suma a la base en efectivo del trabajador, y `route.base` y `route.monthlyInsurance` también aumentan.
  - "Resumen del día" muestra la tarjeta **Seguros del día** con la suma y la cantidad de préstamos (`insuranceCollectedOn`). En "Base del día" aparece "Incluye $X de seguros".
- **Acciones de la cartulina:** "Registrar pago", "↻ Renovar crédito" y "＋ Otra cartulina" están en el encabezado de la ficha: a la derecha del nombre en computador y debajo del nombre en el celular. "Registrar pago" se oculta cuando la cartulina está cancelada.
- **Renovar crédito** (`openRenewalModal`, `canRenew`):
  - El botón siempre se ve, pero solo funciona cuando la cartulina está **cancelada por completo** (saldo en cero) y no se ha renovado antes. Mientras tenga saldo aparece bloqueado (borde punteado y 🔒) con el texto "Falta pagar $X"; al pulsarlo, un aviso pide pagar el saldo o usar "Otra cartulina". Se oculta cuando la cartulina ya fue renovada.
  - Abre el formulario de alta en modo renovación: nombre, cédula y celular quedan fijos; dirección e indicaciones se pueden cambiar. **No pide foto**: usa la ya registrada y muestra una miniatura.
  - Crea una cartulina nueva (`renewedFrom`, `renewalCount`) que hereda foto, notas, ubicaciones e historial de direcciones. Si la dirección cambió, la anterior pasa al historial. Ocupa el lugar de la anterior en la ruta, y la anterior queda marcada con `renewedTo`.
- **Varias cartulinas por persona** (`domain/person-cards.js`, `openExtraCardModal`):
  - "＋ Otra cartulina" abre un crédito **simultáneo** a nombre de la misma persona. Es distinto de renovar: las demás cartulinas siguen activas.
  - Cada cartulina es un registro propio en `clients`, con su saldo, cuota, calendario, abonos y seguros. Lo que las agrupa es la **cédula** (`personKey`).
  - Máximo `MAX_ACTIVE_CARDS_PER_PERSON = 4` cartulinas activas por persona; al llegar al tope el botón se desactiva. Las canceladas no cuentan.
  - En la ficha, el selector "N cartulinas · M activas" permite saltar entre ellas. En las listas, cada fila indica "Cartulina N".
  - La nueva cartulina queda en la ruta justo después de la última de la persona, para cobrarlas en la misma visita. Tampoco pide foto.
  - Crear un cliente nuevo con una cédula ya registrada se rechaza y remite a "Otra cartulina" o "Renovar".
- **Abonos sin GPS:** el modal de pago ya no pide ni guarda la ubicación. El GPS solo se pide al crear un cliente, para guardar su domicilio en el mapa.

## Horario de acceso de trabajadores

- **Dónde:** Gestión de Personal → "Horario de acceso de trabajadores" (`features/admin/access-hours.js`). El admin activa la restricción, elige los días (L a D) y la franja "Desde / Hasta". Se guarda en `security.workerAccess`.
- **Regla** (`domain/access-schedule.js`): `isWithinSchedule()` admite franjas que cruzan la medianoche (ej. 22:00 a 02:00). El administrador nunca tiene restricción.
- **Al ingresar:** si la contraseña es correcta pero se está fuera del horario, no se pasa a la verificación en dos pasos y se muestra el horario permitido. No cuenta como intento fallido. Se vuelve a comprobar justo después del código 2FA.
- **Durante la sesión:** cada 30 s (y al volver a la pestaña) se revisa el horario. 10 minutos antes del cierre aparece un aviso; al terminar la franja la sesión se cierra sola con un mensaje.
- **Límite conocido:** sin backend la hora sale del reloj del dispositivo. Cuando exista el servidor, la misma regla debe validarse allí con la hora del servidor.

## Estado de pagos e historial de la cartulina

Hay dos indicadores, en `domain/loan-schedule.js`, y ambos parten de `scheduleSnapshot()`:

- **Desde afuera — estado actual** (`paymentBehavior`): se usa en las listas, el Inicio y el mapa.
  - Cuenta los **pagos atrasados por período** según la frecuencia de la cartulina. Una cuota semanal vencida sin pagar es "Pagos atrasados 1"; dos meses sin pagar en una mensual son "Pagos atrasados 2". Lo mismo aplica a las diarias y quincenales.
  - Si no hay cuotas vencidas, muestra "Pagos al día" o "Cuota vence hoy". Las cartulinas saldadas muestran "Cartulina pagada".
  - Niveles del mapa: Al día (verde), 1 atrasado (naranja), 2 o más atrasados (rojo).
- **Dentro de la ficha — historial** (`paymentHistory`): es la "cicatriz" de la cartulina.
  - **Historial bueno:** nunca tuvo un atraso.
  - **Historial irregular:** 1 o 2 incidentes. Un incidente es una cuota pagada tarde, una visita marcada "No pagó" o un período atrasado.
  - **Historial malo:** 3 o más incidentes, o 2 o más períodos atrasados a la vez.
  - El peor nivel alcanzado queda guardado en `client.worstHistory`, así que la marca no mejora aunque la cartulina se pague.
- **Chip de estado de la ficha:** muestra "Pagos atrasados N" cuando hay períodos vencidos; si no, "Al día" o "Pagada".

## Acceso individual y fecha de liquidación

- **Acceso individual:**
  - Cada tarjeta de Personal tiene un interruptor **Acceso**. Al apagarlo (con confirmación), `worker.accessEnabled = false` y el trabajador no puede ingresar aunque tenga usuario, contraseña y código.
  - Si tiene una sesión abierta en ese navegador, se cierra en menos de 30 s, o de inmediato si el bloqueo se hizo en otra pestaña (evento `storage`).
  - Sin backend no llega a otros dispositivos: cuando exista el servidor, debe invalidar la sesión allí.
- **Tarjetas de Personal:** tienen encabezado con el nombre, la ruta y el interruptor; los datos en dos columnas; las insignias de 2FA y de bloqueo; los vencimientos del vehículo; las acciones diarias (Editar, Credenciales, Ubicación) y, aparte, Restablecer 2FA y Eliminar.
- **Liquidación:** la fecha "Hoy · …" sale del reloj del dispositivo (`renderRouteDate`) y se actualiza sola cada minuto, así que cambia a medianoche.

## Cierre del día y recordatorios

- **Reinicio al cerrar el cobro** (`resetRouteDay`, en `admin/settlement.js`): al pulsar "Verificar y Cerrar Ruta", el resumen del día vuelve a 0 (cobros, préstamos, gastos, otros gastos, efectivo entregado y seguros del día).
  - **Lo único que pasa al día siguiente es el efectivo:** el "Efectivo" de la liquidación, o el calculado si quedó en blanco, se convierte en la **base** del día siguiente. También se guarda en la caja del trabajador de esa ruta.
  - **Sábado:** como el efectivo se entrega ese día, la base del lunes arranca en 0. El admin puede asignarla en Liquidación.
  - El indicador ✓ compara contra los valores posteriores al reinicio (`lastClosure.after`). Los seguros del día solo cuentan lo cobrado después del cierre (`insuranceCollectedTs`).
- **Aviso de vencimiento del vehículo:** el aviso tiene "No recordar más". Guarda `worker.expiryAlertDismissed` con las fechas avisadas. Si el admin registra una fecha nueva (renovación), el aviso vuelve a funcionar.
- **Modal genérico:** `openCustomModal` acepta `cancelLabel` y `onCancel` para usar el botón secundario como acción.

## Libro diario, caja del cobro y seguros (Reportes)

Todo vive en `domain/ledger.js`. La interfaz está en `features/admin/reports.js`.

- **Libro diario** (`route.ledger[yyyy-mm-dd]`):
  - Cada día guarda base, cobro, préstamos, gastos, otros gastos, efectivo, salida de caja y seguros.
  - Se escribe al pulsar "Verificar y Cerrar Ruta" (`recordClosure`), antes de reiniciar el resumen del día. El día de hoy, mientras no se cierre, se lee en vivo de la ruta.
  - Nada se borra: con el selector **Fecha** (uno en cada pestaña) se consulta cualquier día. Define el mes y la semana que se muestran y resalta ese día; por ejemplo, el 02/02/2026 muestra su base, cobro, préstamos y demás.
  - Los reportes se "reinician" cada mes porque cada mes suma solo sus días. La caja no se reinicia.
- **Columnas de la semana:** Base, Cobro, Préstamos, Gastos ✎, Otros gastos ✎, Salida de caja ✎, Efectivo, Descuadre y Caja. Las marcadas con ✎ se corrigen en la misma tabla (`setDayField`).
- **Caja del cobro** (`route.cashBox`): monto de apertura y fecha, que se fijan con "Monto de apertura".
  - Caja del día = caja del día anterior + cobro − préstamos − gastos − otros gastos − salida de caja.
  - Ejemplo: apertura de $40.000.000; un lunes se prestan $5.000.000 e ingresan $2.000.000 → la caja queda en $37.000.000.
  - Una salida de caja (pago o retiro de ganancias) se anota en su fecha y resta desde ese día en adelante.
- **Descuadre:** es la fórmula de la liquidación (cobro + base − préstamos − gastos − otros − efectivo) de cada día cerrado. "Descuadre de la semana" suma de lunes a sábado, así que se reinicia cada sábado.
- **Seguros** (Cierre mensual):
  - **Cuadrar seguros** (`cutInsurance`) cierra el acumulado y lo reparte 50/50 entre el trabajador y el dueño.
  - El periodo de un mes empieza donde terminó el del mes anterior y termina en su último cuadre o, si no hubo, a fin de mes.
  - Si se cuadra antes de fin de mes (por ejemplo, el 28), lo cobrado del 29 al 31 pasa al mes siguiente y se suma a su primera semana, sin fila aparte. El único indicador es la marca del día del cuadre.
  - Después del cuadre, las tarjetas "Seguros por cuadrar", "Parte del trabajador" y "Parte del dueño" quedan en $0.
  - La tabla conserva las semanas y el total del periodo. La semana en que se cuadró se pinta en verde y lleva, en la misma fila, la etiqueta "✂ Cuadrado dd/mm, hora".
- **Directorio:** tiene filtros "Activas", "Buenos", "Regulares" y "Malos" (según el historial de pagos de las cartulinas activas) y "Canceladas" (saldo en cero), cada uno con su contador.
- **Fechas de la liquidación:** el encabezado "Cierre operativo · …" y "Hoy · …" salen del reloj.

## "Cuadrar seguros"

Solo se cuadra el mes en curso, con la hora actual. Para pruebas existe `INSURANCE_CUT_TEST_MODE` en `core/config.js` (hoy en `false`). Si se pone en `true`, permite cuadrar cualquier mes con una fecha elegida, cuadrar varias veces y deshacer el último cuadre.

## Dispositivo recordado

- **Archivo:** `features/auth/device-trust.js`, con `TRUSTED_DEVICE_DAYS = 30`.
- **Cómo funciona:** al verificar el código de 6 dígitos con la casilla "Recordar este dispositivo" marcada, ese navegador no vuelve a pedir el código para esa cuenta durante 30 días. La contraseña se pide siempre.
- **Cuándo se vuelve a pedir:** en otro dispositivo, al vencer el plazo, o tras "Olvidar este dispositivo" en la pantalla de ingreso.
- **Restablecer 2FA:** cuando el admin lo usa en un trabajador, se invalidan sus dispositivos recordados.
- **Verificación con imágenes:** se retiró. El acceso queda con contraseña y app de autenticación.

## Sistema limpio para empezar

- **Qué viene vacío:** el sistema arranca sin clientes, abonos, cierres ni libro diario.
  - Los cobros Zulia, Pamplona y Atalaya vienen en cero (`emptyRoute`), sin caja de apertura.
  - "Tu caja hoy" del trabajador se calcula con su base más los abonos del día (efectivo y bancos), sin cifras fijas.
- **Qué se conserva:** el personal y la configuración de seguridad (verificación en dos pasos del admin, horario de acceso).
- **Borrado en los dispositivos:** `DATA_EPOCH` (en `core/store.js`) marca la versión de los datos. Si un navegador tiene datos guardados de otra versión (demostración o pruebas), al abrir la app los descarta.
  - Se borran los clientes, movimientos, libro diario, cuadres y cajas de los trabajadores.
  - Se conservan el personal, la seguridad y los nombres de las rutas creadas.
  - Para volver a dejar todo en cero en el futuro basta con cambiar `DATA_EPOCH`.
- **Usuarios iniciales:** camila, andres y valentina con Ruta#2026, y admin con Admin#2026. Las contraseñas de los trabajadores se cambian en Personal → Credenciales. La del admin está en `core/config.js` (`adminPasswordHash`).

## Cifras con separador de miles

- **Lo que se muestra:** todos los montos usan `formatMoney`, que escribe "$ 4.000.000".
- **Campos de dinero** (`ui/money-input.js`): los inputs marcados con `data-money` muestran los puntos mientras se escribe.
  - Ejemplos: abono, préstamo, seguros, base, liquidación, gastos, caja, celdas editables de Reportes y campos "($)" de los modales.
  - `input.value` y `FormData` entregan el número limpio ("4000000"), así que el resto del código no cambia.
  - Respetan el mínimo (`min`) y el signo negativo (por ejemplo, una base negativa).
- **Campos de dinero nuevos:** basta con agregarles `data-money`. En `openCustomModal`, los campos `type: 'number'` cuya etiqueta lleva "($)", o los que tienen `money: true`, se convierten solos.

## Modo servidor (Supabase) y publicación

- `config.js` (script clásico, raíz) define `window.EDGECREDIT_BACKEND = { url, key }`. Si está vacío,
  se usan `js/core/backend-config.js` y, si también está vacío, la app trabaja en **modo local**.
- `js/core/backend.js` carga supabase-js desde jsDelivr solo cuando hay servidor. Los usuarios entran
  con un nombre corto: `camila` se convierte en `camila@edgecredit.app`.
- `js/core/sync.js`:
  - Al iniciar sesión (o al restaurarla) descarga las filas visibles para el usuario (el RLS filtra por ruta)
    y guarda un cursor con la hora del servidor (`server_now()`).
  - Tras cada `persistBusinessData()` sube los cambios. La cola de salida (`localStorage`) se escribe al
    instante, también al ocultar la app (`visibilitychange`) y al cerrarla (`pagehide`), y se reintenta.
  - Recibe los cambios de otros por Realtime (vía principal). Si el canal se cae, reconecta con espera
    progresiva (1 s, 2 s, 4 s… hasta 1 min) y el indicador muestra «Reconectando…».
  - Respaldo incremental cada 60–90 s, solo con la pestaña visible: filas con `updated_at > cursor − 2 min`
    y borrados de `deleted_rows`. Descarga completa solo al reconectar el tiempo real, al volver a la
    pestaña tras más de 10 min oculta, con el evento `online` y como seguro cada 30 min.
  - Nunca pisa un registro con cambios locales sin enviar: se conserva el local y se envía (gana la última
    escritura). Una descarga completa vuelve a aplicar lo pendiente sobre lo descargado.
- Sesión (`features/auth/session.js`): al abrir o recargar la app restaura la sesión guardada de Supabase si
  ya pasó la verificación en dos pasos (aal2, o un dispositivo recordado) y el perfil sigue activo y en
  horario. Se cierra sola tras `app_settings.session.idleHours` horas sin usar la app (Configuración, 12 por
  defecto). «Cerrar sesión» la cierra de verdad en este dispositivo.
- Botón atrás (`ui/back-navigation.js`): cada pantalla, panel o modal agrega una entrada al historial y
  `popstate` cierra la modal o vuelve a la pantalla anterior. En el inicio, el primer atrás avisa
  «Pulsa atrás otra vez para salir»; el segundo, dentro de 2 s, cierra la app.
- `supabase/schema.sql` define estas tablas:
  - `profiles`: rol, ruta, acceso y datos del trabajador.
  - `routes` y `route_state`: liquidación, libro diario, caja y seguros.
  - `clients`, `pending_requests` y `app_settings`: base del trabajador y horario de acceso.

  Las reglas RLS hacen esto:
  - El trabajador solo ve su ruta, y solo si tiene el acceso activo y está dentro del horario (America/Bogota).
  - El administrador ve todo.
  - Las funciones `admin_*` cambian contraseña, usuario y 2FA, o borran usuarios.
- La verificación en dos pasos usa MFA TOTP nativo de Supabase. El «dispositivo recordado» (30 días) usa como clave el id del usuario.
- Pruebas sin internet: `tools/supabase-mock.js` imita supabase-js con `localStorage` y `BroadcastChannel`, así dos pestañas actúan como dos celulares.
  Imita también `updated_at` del servidor, `deleted_rows`, `server_now()` y el nivel aal. `?mockSession=<nombre>` da a cada pestaña su
  propia sesión, y `__mockSupabase.setOffline()`, `muteRealtime()`, `dropRealtime()` y `stats` sirven para probar caídas y ver cuánto se descarga.
- Publicación: estáticos en GitHub Pages (`.nojekyll`), con `manifest.webmanifest` e iconos para instalar en el celular.
