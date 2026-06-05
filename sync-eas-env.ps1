param(
  [string]$EnvFile = ".env",
  [string]$Environment = "preview",
  [string]$Prefix = "EXPO_PUBLIC_"
)

$ErrorActionPreference = "Stop"

function Resolve-EasCommand {
  $easCommand = Get-Command "eas" -ErrorAction SilentlyContinue
  if ($easCommand) {
    return @("eas")
  }

  $easCmdCommand = Get-Command "eas.cmd" -ErrorAction SilentlyContinue
  if ($easCmdCommand) {
    return @("eas.cmd")
  }

  $npxCommand = Get-Command "npx" -ErrorAction SilentlyContinue
  if ($npxCommand) {
    return @("npx", "eas-cli@latest")
  }

  $npxCmdCommand = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
  if ($npxCmdCommand) {
    return @("npx.cmd", "eas-cli@latest")
  }

  throw "No se encontro EAS CLI ni npx. Instalalo con: npm install --global eas-cli"
}

function Get-MaskedLengthLabel {
  param([string]$Value)

  if ([string]::IsNullOrEmpty($Value)) {
    return "empty"
  }

  return "$($Value.Length) chars"
}

$envPath = Join-Path $PSScriptRoot $EnvFile
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No se encontro el archivo $EnvFile en $PSScriptRoot"
}

$variables = [ordered]@{}

foreach ($line in Get-Content -LiteralPath $envPath) {
  $trimmedLine = $line.Trim()

  if (-not $trimmedLine -or $trimmedLine.StartsWith("#")) {
    continue
  }

  if ($trimmedLine.StartsWith("export ")) {
    $trimmedLine = $trimmedLine.Substring(7).TrimStart()
  }

  $separatorIndex = $trimmedLine.IndexOf("=")
  if ($separatorIndex -le 0) {
    continue
  }

  $name = $trimmedLine.Substring(0, $separatorIndex).Trim()
  $value = $trimmedLine.Substring($separatorIndex + 1)

  if (-not $name.StartsWith($Prefix)) {
    continue
  }

  if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    Write-Warning "Ignorando nombre invalido: $name"
    continue
  }

  $variables[$name] = $value
}

if ($variables.Count -eq 0) {
  throw "No se encontraron variables $Prefix en $EnvFile"
}

Write-Host "Sincronizando $($variables.Count) variables $Prefix hacia EAS environment '$Environment'."
Write-Host "No se imprimiran valores completos."

foreach ($name in $variables.Keys) {
  Write-Host "Cargando $name ($((Get-MaskedLengthLabel -Value $variables[$name])))"
}

$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("eas-env-" + [System.Guid]::NewGuid().ToString("N") + ".env")

try {
  $filteredLines = foreach ($name in $variables.Keys) {
    "$name=$($variables[$name])"
  }

  [System.IO.File]::WriteAllLines($tempFile, $filteredLines, [System.Text.UTF8Encoding]::new($false))

  $easCommand = Resolve-EasCommand
  $executable = $easCommand[0]
  $baseArgs = @()
  if ($easCommand.Count -gt 1) {
    $baseArgs += $easCommand[1..($easCommand.Count - 1)]
  }

  $pushArgs = $baseArgs + @(
    "env:push",
    $Environment,
    "--path",
    $tempFile,
    "--force"
  )

  Write-Host "Ejecutando: eas env:push $Environment --path <temp-file> --force"
  & $executable @pushArgs

  if ($LASTEXITCODE -ne 0) {
    throw "eas env:push termino con codigo $LASTEXITCODE"
  }

  Write-Host "Variables sincronizadas correctamente en EAS environment '$Environment'."
}
finally {
  if (Test-Path -LiteralPath $tempFile) {
    Remove-Item -LiteralPath $tempFile -Force
  }
}
