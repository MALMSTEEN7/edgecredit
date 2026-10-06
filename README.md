# EdgeCredit

App web (PWA) para la gestión de cartera de microcrédito y recaudo en ruta: administrador y trabajadores de cobro.

- **Publicar y usar en equipo:** ver [DEPLOY.md](DEPLOY.md). Explica Supabase + GitHub Pages paso a paso.
- **Cómo está construida:** ver [ARCHITECTURE.md](ARCHITECTURE.md).

## Modos de funcionamiento

| `config.js` | Modo | Datos |
|---|---|---|
| vacío | Local | Solo en el navegador de cada dispositivo |
| con URL y clave de Supabase | Servidor | Compartidos en tiempo real; inicio de sesión y 2FA en el servidor |

## Desarrollo

```bash
python3 -m http.server 8000        # servir la carpeta
# http://localhost:8000/?dev       → módulos sueltos (js/)
node tools/bundle.mjs              # regenerar dist/ antes de publicar
```

Base de datos: `supabase/schema.sql` (tablas, reglas RLS, funciones de administrador y tiempo real).
