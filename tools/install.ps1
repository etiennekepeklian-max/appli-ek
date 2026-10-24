$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent
$destination = 'C:\Users\etien\Desktop\Artil\Appli EK'
Write-Host 'Installation de EK Logistique' -ForegroundColor Green
if (-not (Test-Path (Join-Path $source 'site\index.html'))) { throw 'Extrayez toute l archive ZIP avant de lancer l installation.' }
if ([IO.Path]::GetFullPath($source).TrimEnd('\') -ne [IO.Path]::GetFullPath($destination).TrimEnd('\')) {
    if ([IO.Path]::GetFullPath($source).StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase)) {
        $staging = Join-Path ([IO.Path]::GetTempPath()) ('EK-Logistique-installation-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $staging -Force | Out-Null
        Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $staging -Recurse -Force
        $source = $staging
    }
    if (Test-Path $destination) {
        $backup = $destination + '-sauvegarde-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
        Move-Item -LiteralPath $destination -Destination $backup
        Write-Host ('Ancien dossier conserve : ' + $backup)
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $destination -Recurse -Force
}
Write-Host ('Fichiers installes dans : ' + $destination) -ForegroundColor Green
Write-Host 'Double-cliquez sur LANCER-EK.cmd pour ouvrir l application.'
Start-Process explorer.exe -ArgumentList ('"' + $destination + '"')
