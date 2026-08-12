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

# Um next start deixado vivo de uma sessao anterior e o unico caso em que o
# build seguinte substitui o .next por baixo de um servidor a correr e parte a
# app com erros que parecem de codigo. Por isso isto vem antes de tudo.
function Stop-Leftovers {
    Write-Step "Clearing leftovers on port 3000"

    $conns = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    if ($conns.Count -eq 0) {
        Write-Host "    port 3000 is free"
        return
    }

    foreach ($id in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
        if (-not $proc) { continue }

        # So se mata o que este lancador poderia ter deixado para tras. Qualquer
        # outra coisa no 3000 e um programa do utilizador, e desliga-lo sem
        # perguntar seria abuso de confianca.
        if ($proc.ProcessName -ne "node") {
            throw "Port 3000 is used by '$($proc.ProcessName)' (PID $id), which this launcher did not start. Close it yourself and run the launcher again."
        }

        Write-Host "    stopping leftover node (PID $id)"
        Stop-Process -Id $id -Force
    }

    # Libertar o porto nao e instantaneo depois do Stop-Process.
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 250
        $still = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
        if ($still.Count -eq 0) {
            Write-Host "    port 3000 is free"
            return
        }
    }
    throw "Port 3000 is still busy after stopping the leftover process."
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
    Stop-Leftovers
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