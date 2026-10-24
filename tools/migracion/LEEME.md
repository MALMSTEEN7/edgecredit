# Migrar un cobro del sistema anterior (CREDITOS) a EdgeCredit

Pasa los créditos **vigentes** de un cobro con sus clientes y abonos. Se hace un cobro a la vez.

## 1. Preparar el cobro en EdgeCredit

Entra como administrador y, en **Gestión de Personal**, crea al trabajador del cobro con su ruta
(por ejemplo ANDERSON, ruta «Donmatías»). Así nace el cobro donde se cargarán los créditos.

## 2. Exportar en el PC de la empresa

Copia `exportar-cobro.ps1` al PC y ejecútalo con la PowerShell **de 32 bits**,
porque el proveedor de Access del equipo solo existe en 32 bits:

```
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File exportar-cobro.ps1 -Cobro DONMATIAS
```

- Trabaja sobre una **copia temporal** de `C:\creditos\ca.mdb`: no modifica nada del sistema anterior.
- Deja en el Escritorio el archivo `donmatias-edgecredit.json`.
- Ese archivo tiene datos personales: no lo subas a GitHub ni lo mandes por chat. Bórralo al terminar.

## 3. Importar

En EdgeCredit ve a **Configuración → Importar cartera del sistema anterior → Elegir archivo**.
Antes de guardar, la vista previa muestra:

- créditos, personas, capital, total abonado y saldo pendiente
  (deben coincidir con el informe del sistema anterior);
- los créditos que no se importan y por qué (por ejemplo, sin saldo);
- por cada crédito, los datos por revisar: sin teléfono, sin dirección, interés distinto de 20 %,
  abonos sin fecha, saldo que no cuadra.

### Nombres

El sistema anterior pega al nombre datos que no son el nombre (oficio, ciudad, «RC …» o quién lo
recomendó). En la vista previa cada nombre se puede corregir a mano. También puedes cargar los 26 de una vez con
**Cargar nombres corregidos**, que usa un archivo como este:

```json
{ "tipo": "edgecredit-correcciones", "cobro": "DONMATIAS",
  "creditos": { "DONMATIAS22": { "nombre": "Juan Carlos Gutiérrez", "referencia": "Policía" } } }
```

El nombre del sistema anterior y la referencia quedan en las notas del cliente. Ese archivo también tiene
datos personales: guárdalo solo en el PC y no lo subas a GitHub (`*-nombres.json` está en `.gitignore`).

Revisa el cobro de destino y pulsa **Importar**. Si vuelves a cargar el mismo archivo, los créditos
ya importados no se tocan: no se pierden los abonos registrados después en EdgeCredit.

## Reglas de conversión

| Sistema anterior | EdgeCredit |
|---|---|
| `PRES` (en miles) | Capital × 1000 |
| `TAR_VALOR`, `TAR_CUOTA`, `TSALDO` | Total, cuota y saldo (en pesos) |
| `TIEMPO`, `FP` (S/Q/M) | Plazo en días; frecuencia semanal, quincenal o mensual |
| `TAR_FECHA` (dd-mm-aa) | Fecha de inicio |
| `DESCRIPCION.DES_ABONO` + `FECHA_ACT` (o `captura`) | Abonos, todos en efectivo. `DES_FECHA` no se usa porque es una fecha ficticia. Un abono sin fecha toma la del abono anterior. |
| `CLI_CODIGO` | Cédula sin los prefijos `A`/`B` ni el sufijo `-1` (une los créditos de la misma persona) |
| `CLI_CALLE`, `CLI_BARRIO` | Dirección y teléfono |
| `CLAVO` | Advertencia de pago + nota «CLAVO (mora) en el sistema anterior» |
| `TOTRO`, `ESTADO2` | Nota con la calificación anterior y el historial |
| — | Seguro del 10 %, marcado como cobrado en el sistema anterior (no suma a la caja) |

Los abonos y préstamos migrados **no** suman al cobro, a la caja ni a la liquidación del día.
