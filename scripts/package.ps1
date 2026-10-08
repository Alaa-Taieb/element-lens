$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = [string]$manifest.version
$distRoot = Join-Path $projectRoot "dist"
$stagePath = Join-Path $distRoot "element-lens-$version"
$archivePath = Join-Path $distRoot "element-lens-$version.zip"

New-Item -ItemType Directory -Path $stagePath -Force | Out-Null
foreach ($fileName in @("manifest.json", "service-worker.js", "picker.js")) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $fileName) -Destination $stagePath -Force
}

$installInstructions = @"
Element Lens $version

Extract this folder if you are using the ZIP. In Chrome or Edge, open the extensions page, enable Developer mode, choose Load unpacked, and select this folder.
"@
Set-Content -LiteralPath (Join-Path $stagePath "INSTALL.txt") -Value $installInstructions -Encoding utf8
Compress-Archive -Path (Join-Path $stagePath "*") -DestinationPath $archivePath -Force

Write-Output "Unpacked extension: $stagePath"
Write-Output "ZIP archive: $archivePath"
