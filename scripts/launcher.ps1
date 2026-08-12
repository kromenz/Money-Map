# Lancador do MoneyMap. Arranca o stack todo por ordem e desliga-o a pedido.
# Ver docs/superpowers/specs/2026-08-12-lancador-design.md

$ErrorActionPreference = "Stop"

# A raiz sai do sitio do proprio script, nao da pasta de onde foi chamado -- um
# duplo clique e uma chamada a mao a partir de outra pasta tem de dar no mesmo.
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$script:FrontendPid = $null

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# Falhar aqui, antes de mexer em seja o que for, poupa ao utilizador um erro
# obscuro vindo de dentro do docker ou do npm.
function Assert-Tools {
    Write-Step "Checking required tools"
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker is not on your PATH. Install Docker Desktop and try again."
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is not on your PATH. Install Node.js and try again."
    }
    Write-Host "    docker and npm found"
}

function Stop-Everything {
    # Preenchido na Task 5.
}

# Nao desliga nada de proposito: a paragem vive num sitio so, o finally la em
# baixo. Assim o Q, o Ctrl+C e uma falha a meio saem todos pelo mesmo caminho.
function Show-Panel {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message
    Write-Host ""
    Write-Host "Press Q to shut everything down." -ForegroundColor Yellow
    while ($true) {
        $key = [System.Console]::ReadKey($true)
        if ($key.Key -eq "Q") { return }
    }
}

try {
    Write-Host "MoneyMap launcher" -ForegroundColor Green
    Assert-Tools
    Show-Panel "Nothing is running yet -- the launcher is still being built."
}
catch {
    Write-Host ""
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Show-Panel "MoneyMap did not start."
}
finally {
    Stop-Everything
}