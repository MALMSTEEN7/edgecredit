<#
  EdgeCredit · Exporta UN cobro del sistema anterior (CREDITOS.exe, base Access ca.mdb)
  a un archivo .json que se carga en EdgeCredit → Configuración → «Importar cartera del
  sistema anterior».

  - SOLO LECTURA: trabaja sobre una copia temporal de ca.mdb; el original no se toca.
  - Saca los créditos vigentes del cobro (tabla TARGETA), su cliente (CLIENTES) y sus
    abonos (DESCRIPCION). La conversión (miles, fechas, cédulas…) la hace EdgeCredit.
  - El archivo de salida tiene datos personales de clientes: guárdalo solo en el PC y
    bórralo después de importar. No lo subas a GitHub ni lo envíes por chat.

  El proveedor de Access de este equipo es de 32 bits, así que hay que usar la
  PowerShell de 32 bits. Uso (en una ventana de CMD o PowerShell):

    C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File exportar-cobro.ps1 -Cobro DONMATIAS

  Parámetros opcionales:
    -Base   ruta de la base   (por defecto C:\creditos\ca.mdb)
    -Salida archivo .json     (por defecto <Escritorio>\<cobro>-edgecredit.json)
#>
param(
  [Parameter(Mandatory = $true)][string]$Cobro,
  [string]$Base = 'C:\creditos\ca.mdb',
  [string]$Salida = ''
)

$ErrorActionPreference = 'Stop'
$Cobro = $Cobro.Trim().ToUpperInvariant()
if ($Cobro -notmatch '^[A-Z0-9_ ]+$') { throw "Nombre de cobro no válido: $Cobro" }
if (-not $Salida) { $Salida = Join-Path ([Environment]::GetFolderPath('Desktop')) ("{0}-edgecredit.json" -f $Cobro.ToLowerInvariant()) }
if ([Environment]::Is64BitProcess) {
  throw 'Abre la PowerShell de 32 bits: C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe (el proveedor Jet 4.0 solo existe en 32 bits).'
}
if (-not (Test-Path -LiteralPath $Base)) { throw "No se encontró la base: $Base" }

# Copia temporal: el programa tiene la base abierta y así nunca se escribe en el original.
$copia = Join-Path $env:TEMP ("edgecredit-export-{0}.mdb" -f [Guid]::NewGuid().ToString('N'))
Copy-Item -LiteralPath $Base -Destination $copia

$conexion = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$copia;Mode=Read;")
try {
  $conexion.Open()

  function Leer([string]$sql, [hashtable]$parametros = @{}) {
    $comando = $conexion.CreateCommand()
    $comando.CommandText = $sql
    foreach ($nombre in $parametros.Keys) { [void]$comando.Parameters.AddWithValue($nombre, $parametros[$nombre]) }
    $tabla = New-Object System.Data.DataTable
    (New-Object System.Data.OleDb.OleDbDataAdapter($comando)).Fill($tabla) | Out-Null
    $filas = @()
    foreach ($fila in $tabla.Rows) {
      $objeto = [ordered]@{}
      foreach ($columna in $tabla.Columns) {
        $valor = $fila[$columna.ColumnName]
        $objeto[$columna.ColumnName] = if ($valor -is [DBNull]) { '' } else { [string]$valor }
      }
      $filas += [pscustomobject]$objeto
    }
    # Sin la coma: quien llama ya envuelve en @(); con ella la lista quedaba dentro de otra lista.
    return $filas
  }

  $cobroFila = @(Leer 'SELECT * FROM COBRO WHERE COB_CODIGO = ?' @{ cobro = $Cobro })
  if (-not $cobroFila.Count) { throw "No existe el cobro $Cobro en la tabla COBRO." }

  # Tarjetas del cobro: el código es <COBRO><número> (DONMATIAS40). Se descartan otros
  # cobros que empiecen igual (p. ej. DONMATIASNORTE12).
  $patron = '^' + [Regex]::Escape($Cobro) + '\d+$'
  $tarjetas = @((Leer 'SELECT * FROM TARGETA WHERE TAR_CODIGO LIKE ?' @{ codigo = "$Cobro%" }) | Where-Object { $_.TAR_CODIGO.Trim() -match $patron })

  $salidaTarjetas = @()
  foreach ($tarjeta in $tarjetas) {
    $cliente = @(Leer 'SELECT * FROM CLIENTES WHERE CLI_CODIGO = ?' @{ cliente = $tarjeta.CLI_CODIGO })
    # Abonos en el orden en que se guardaron (el orden de DESCRIPCION es el del sistema).
    $abonos = @(Leer 'SELECT * FROM DESCRIPCION WHERE TAR_CODIGO = ?' @{ tarjeta = $tarjeta.TAR_CODIGO })
    $item = [ordered]@{}
    foreach ($propiedad in $tarjeta.PSObject.Properties) { $item[$propiedad.Name] = $propiedad.Value }
    $item['cliente'] = if ($cliente.Count) { $cliente[0] } else { $null }
    $item['abonos'] = $abonos
    $salidaTarjetas += [pscustomobject]$item
  }

  $resultado = [ordered]@{
    origen = 'CREDITOS (ca.mdb)'
    exportado = (Get-Date).ToString('s')
    cobro = $cobroFila[0]
    tarjetas = $salidaTarjetas
  }
  $json = $resultado | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($Salida, $json, (New-Object Text.UTF8Encoding($false)))

  $sinCliente = @($salidaTarjetas | Where-Object { -not $_.cliente }).Count
  $totalAbonos = ($salidaTarjetas | ForEach-Object { $_.abonos.Count } | Measure-Object -Sum).Sum
  Write-Host ''
  Write-Host ("Cobro {0} ({1}): {2} créditos, {3} abonos." -f $Cobro, $cobroFila[0].COB_NOMBRE, $salidaTarjetas.Count, [int]$totalAbonos)
  if ($sinCliente) { Write-Host ("ATENCIÓN: {0} crédito(s) sin cliente en CLIENTES." -f $sinCliente) -ForegroundColor Yellow }
  Write-Host "Archivo creado: $Salida"
  Write-Host 'Cárgalo en EdgeCredit → Configuración → Importar cartera del sistema anterior. Bórralo cuando termines.'
}
finally {
  $conexion.Close()
  Remove-Item -LiteralPath $copia -ErrorAction SilentlyContinue
}
