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
# O favicon da propria app: 16, 24, 32 e 64 pixeis. Chega para o tamanho normal
# do ambiente de trabalho; nos icones extra grandes o Windows estica o de 64.
$icon = Join-Path $RepoRoot "frontend\public\favicon.ico"

if (-not (Test-Path $target)) {
    throw "Money-Map.cmd was not found next to this script. Run this from inside the repository."
}
if (-not (Test-Path $icon)) {
    throw "The icon was not found at '$icon'."
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
