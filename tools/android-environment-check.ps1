# Read-only preparation. No download, install, SDK creation, build or migration.
$ErrorActionPreference = 'Stop'
Write-Host 'Pikeo - controle de preparation Android (lecture seule)'
foreach ($toolName in @('node','npm','git','winget','adb','sdkmanager')) {
    $command = Get-Command $toolName -ErrorAction SilentlyContinue
    if ($command) { Write-Host ("[PRESENT] {0} : {1}" -f $toolName, $command.Source) }
    else { Write-Host ("[A PREPARER] {0}" -f $toolName) }
}
if (Get-Command node -ErrorAction SilentlyContinue) { & node --version }
$studioPath = Join-Path $env:ProgramFiles 'Android\Android Studio\bin\studio64.exe'
if (Test-Path $studioPath) { Write-Host '[PRESENT] Android Studio (emplacement standard)' }
else { Write-Host '[A VERIFIER] Android Studio absent de son emplacement standard' }
if ($env:LOCALAPPDATA) {
    $sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path $sdkPath) { Write-Host '[PRESENT] Dossier SDK Android standard' }
    else { Write-Host '[A PREPARER] SDK Android' }
}
Write-Host 'Revalider les versions requises dans la documentation officielle avant installation.'
Write-Host 'Aucune modification effectuee. Ce controle ne valide pas une compilation Android.'
