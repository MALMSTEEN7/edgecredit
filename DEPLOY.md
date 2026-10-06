# Puesta en marcha de EdgeCredit (prueba con trabajadores)

Resultado final: una dirección web (por ejemplo `https://tu-usuario.github.io/edgecredit/`)
que el administrador y los trabajadores abren en el celular. Todos ven y guardan en la misma base de datos.

| Pieza | Para qué | Costo |
|---|---|---|
| **Supabase** | Base de datos, usuarios, contraseñas y verificación en dos pasos | Plan gratuito |
| **GitHub Pages** | Publica la app (los archivos de esta carpeta) en internet | Gratis con repositorio público |

Tiempo estimado: 30–45 minutos la primera vez.

---

## Parte 1 · Supabase (base de datos)

1. Entra a <https://supabase.com>, crea una cuenta y luego **New project**.
   - *Name*: `edgecredit`
   - *Database password*: invéntala y guárdala en un lugar seguro (no se usa en la app).
   - *Region*: **South America (São Paulo)**, la más cercana a Colombia.
2. Espera 1–2 minutos a que el proyecto quede listo.
3. Menú izquierdo **SQL Editor** → **New query**. Pega **todo** el contenido de
   `supabase/schema.sql` y pulsa **Run**. Debe decir *Success*. Si lo vuelves a correr, no pasa nada.
4. **Authentication → Sign In / Providers → Email**:
   - **Confirm email: desactivado.** Es obligatorio: los usuarios usan nombres como `camila`, no correos reales.
   - *Enable Email provider* y *Allow new users to sign up*: **activados**. La app crea a los trabajadores con este registro.
     Una persona que se registre por su cuenta queda «pendiente» y no ve nada.
5. **Authentication → Users → Add user → Create new user**:
   - Email: `admin@edgecredit.app`
   - Password: una contraseña fuerte (será la del administrador).
   - Marca **Auto Confirm User**.
6. Vuelve a **SQL Editor** y ejecuta esta línea (convierte esa cuenta en administrador):
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@edgecredit.app';
   ```
7. **Project Settings → API** (o *Data API*). Copia dos valores:
   - **Project URL**, del tipo `https://abcdxyz.supabase.co`
   - **anon public** key, un texto largo que empieza por `eyJ...`
   - ⚠️ **No** uses la clave `service_role`. Esa clave nunca va en la app.

## Parte 2 · Conectar la app

Abre `config.js` (raíz del proyecto) con el Bloc de notas y llena los dos valores:

```js
window.EDGECREDIT_BACKEND = window.EDGECREDIT_BACKEND || {
  url: 'https://abcdxyz.supabase.co',
  key: 'eyJhbGciOi...',
};
```

Guarda. No hace falta recompilar nada.

## Parte 3 · GitHub Pages (publicar)

1. Crea una cuenta en <https://github.com>.
2. **New repository** con estas opciones:
   - Nombre: `edgecredit`
   - Visibilidad: **Public**. GitHub Pages gratis exige repositorio público.
     El código queda visible, pero los datos de clientes NO: están en Supabase, protegidos por usuario y contraseña.
3. En el repositorio vacío: **uploading an existing file** → arrastra **el contenido** de la carpeta del proyecto
   (index.html, config.js, app.js, dist/, js/, css/, supabase/, iconos, `.nojekyll`…) → **Commit changes**.
   - Arrastra todo lo de *dentro* de la carpeta, no la carpeta misma. `index.html` debe quedar en la raíz del repositorio.
   - Si el navegador no sube `.nojekyll` (archivo oculto), créalo en GitHub: **Add file → Create new file**,
     nómbralo `.nojekyll` y déjalo vacío.
4. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main**, carpeta **/ (root)** → **Save**.
5. En 1–2 minutos aparece la dirección: `https://TU-USUARIO.github.io/edgecredit/`.

> ¿Prefieres que el código no sea público? Usa un repositorio privado y publícalo con
> **Cloudflare Pages** o **Netlify** (ambos gratis). Conecta el repositorio y no indiques comando de compilación ni carpeta de salida.

## Parte 4 · Mapa (CARTO)

Si la clave del mapa tiene restricción por dominio, agrega `https://TU-USUARIO.github.io` en la lista de dominios permitidos.

## Parte 5 · Primer uso

1. Abre la dirección y entra como **admin** con la contraseña del paso 1.5.
2. La primera vez la app pide registrar Google Authenticator (o Microsoft Authenticator) con el código QR.
3. En **Personal**, crea a cada trabajador con su usuario, contraseña y ruta.
4. Cada trabajador abre la misma dirección en su celular, entra y registra su propio autenticador.
   - En Chrome (Android) usa **⋮ → Agregar a pantalla principal** para tenerla como app.
   - En iPhone (Safari) usa **Compartir → Agregar a inicio**.
5. Si un trabajador pierde el celular, entra a **Personal → Restablecer 2FA**. Ahí también puedes desactivarle el acceso.

## Actualizar la app más adelante

Sube a GitHub los archivos que cambien (normalmente `index.html`, `dist/` y `js/`). **No** reemplaces tu `config.js` lleno por uno vacío.
Los trabajadores reciben la versión nueva al recargar.

## Qué hay que saber durante la prueba

- **Se necesita internet para iniciar sesión.** Si la señal se va durante el trabajo, los cambios quedan en cola en el celular
  y se envían solos al volver la conexión.
- **Edición simultánea:** si dos personas cambian el mismo cliente al mismo tiempo, queda el último cambio que llegó.
- **Fotos de comprobantes:** se guardan comprimidas dentro de la base de datos. El plan gratuito (500 MB) da para una prueba;
  si el uso crece, conviene pasar las fotos a *Supabase Storage*.
- **Plan gratuito:** Supabase pausa el proyecto tras 7 días **sin ningún uso**. Se reactiva desde el panel con *Restore*.
- **Copias de seguridad:** el plan gratuito no hace copias automáticas descargables. Desde *Database → Backups* o con una exportación
  periódica de las tablas (Table Editor → Export CSV) guardas una copia.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| «Usuario o contraseña incorrectos» con el admin | No marcaste *Auto Confirm* o *Confirm email* sigue activo (paso 1.4). |
| El admin ve «Tu cuenta todavía no tiene una ruta asignada» | Falta el paso 1.6. |
| Al crear un trabajador sale un error de registro | *Allow new users to sign up* está desactivado (paso 1.4). |
| La página sale en blanco o sin estilos | `index.html` quedó dentro de una subcarpeta del repositorio, o falta `.nojekyll`. |
| Los cambios no llegan en tiempo real | El script `schema.sql` no terminó. Córrelo de nuevo. La app igual refresca cada 2 minutos. |
