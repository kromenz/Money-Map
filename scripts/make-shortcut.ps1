# Gera um atalho com icone para o lancador. Corre-se uma vez; o atalho aponta
# para o Money-Map.cmd, por isso mexer no launcher.ps1 nao obriga a regerar nada.
#
#   powershell -ExecutionPolicy Bypass -File scripts\make-shortcut.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\make-shortcut.ps1 -Desktop

param(
    # Sem isto o atalho fica na raiz do repositorio, onde esta ignorado pelo git.
    [switch]$Desktop
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = Join-Path $RepoRoot "Money-Map.cmd"
# A marca do projecto, de 16 ate 256 pixeis. Gerada pelo scripts\make-icon.ps1 a
# partir da geometria do frontend\app\icon.svg.
$icon = Join-Path $RepoRoot "assets\moneymap.ico"

if (-not (Test-Path $target)) {
    throw "Money-Map.cmd was not found next to this script. Run this from inside the repository."
}
if (-not (Test-Path $icon)) {
    throw "The icon was not found at '$icon'. Run scripts\make-icon.ps1 first."
}

if ($Desktop) {
    $dir = [Environment]::GetFolderPath("Desktop")
} else {
    $dir = $RepoRoot
}
$link = Join-Path $dir "MoneyMap.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = $target
# Sem isto o atalho herda a pasta de onde for aberto, e o launcher.ps1 passa a
# resolver a raiz a partir do sitio errado.
$shortcut.WorkingDirectory = $RepoRoot
$shortcut.IconLocation = $icon
$shortcut.Description = "Start MoneyMap"
$shortcut.Save()

Write-Host "Shortcut created: $link"
Write-Host "Drag it to your desktop or pin it to the taskbar."
