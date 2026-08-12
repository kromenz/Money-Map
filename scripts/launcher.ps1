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

$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# docker info e a unica pergunta honesta: o processo do Docker Desktop pode estar
# em memoria muito antes de o motor aceitar comandos.
function Test-DockerEngine {
    # ErrorActionPreference local em Continue: no PowerShell 5.1, redirigir a
    # stderr de um executavel nativo com Stop torna cada linha num erro
    # terminante -- e o docker info escreve na stderr precisamente quando o
    # motor esta em baixo, ou seja no caso que esta funcao existe para detectar.
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        docker info 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Start-DockerEngine {
    Write-Step "Checking the Docker engine"

    if (Test-DockerEngine) {
        Write-Host "    already running"
        return
    }

    if (-not (Test-Path $DockerDesktopExe)) {
        throw "Docker Desktop was not found at '$DockerDesktopExe'. Start it yourself and run the launcher again."
    }

    Write-Host "    starting Docker Desktop (this can take a minute)"
    Start-Process -FilePath $DockerDesktopExe | Out-Null

    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 3
        if (Test-DockerEngine) {
            Write-Host "    engine is up"
            return
        }
        Write-Host "    still waiting..."
    }
    throw "The Docker engine did not come up within two minutes."
}

function Start-Containers {
    Write-Step "Starting the database and the API"
    # O ErrorActionPreference nao apanha o codigo de saida de um executavel; so
    # o $LASTEXITCODE diz se o compose correu bem.
    docker compose --project-directory $RepoRoot up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed. Scroll up for the output above."
    }
}

function Build-Frontend {
    Write-Step "Building the frontend"
    Push-Location (Join-Path $RepoRoot "frontend")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "The frontend build failed. Scroll up for the errors above."
        }
    }
    finally {
        Pop-Location
    }
}

# O docker compose up -d volta muito antes de a API existir: o run.sh ainda corre
# o prisma generate, o db push e o seed antes de o Express ouvir. Por isso
# espera-se por uma resposta de verdade, nao por "o contentor arrancou".
function Wait-Api {
    Write-Step "Waiting for the API"
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $res = Invoke-WebRequest -Uri "http://localhost:5000/" -UseBasicParsing -TimeoutSec 5
            if ($res.StatusCode -eq 200) {
                Write-Host "    API is answering"
                return
            }
        }
        catch {
            # Ainda nao subiu. Nao ha nada a fazer senao voltar a tentar.
        }
        Start-Sleep -Seconds 2
    }
    throw "The API did not answer on http://localhost:5000 within three minutes. Try 'docker compose logs api' to see why."
}

function Start-Frontend {
    Write-Step "Starting the frontend"

    $logDir = Join-Path $RepoRoot "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }
    $log = Join-Path $logDir "frontend.log"

    # npm.cmd e nao npm: o Start-Process chama o Windows directamente e nao
    # resolve o npm.ps1 que o nvm4w poe no PATH.
    $proc = Start-Process -FilePath "npm.cmd" -ArgumentList "start" `
        -WorkingDirectory (Join-Path $RepoRoot "frontend") `
        -RedirectStandardOutput $log `
        -RedirectStandardError (Join-Path $logDir "frontend.err.log") `
        -NoNewWindow -PassThru
    $script:FrontendPid = $proc.Id

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try {
            Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 5 | Out-Null
            Write-Host "    frontend is answering"
            return
        }
        catch {
            # Ainda a arrancar.
        }
    }
    throw "The frontend did not answer on http://localhost:3000. See logs\frontend.log."
}

function Stop-Everything {
    Write-Step "Shutting down"

    # Isto corre dentro do finally. Um erro aqui substituiria a falha original
    # por outra, e o utilizador deixaria de saber o que correu mal de verdade --
    # por isso a paragem queixa-se mas nunca lanca.
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        if ($script:FrontendPid) {
            Write-Host "    stopping the frontend"
            # O npm.cmd cria um node filho; matar so o pai deixava o 3000
            # ocupado. O /T leva a arvore toda.
            taskkill /PID $script:FrontendPid /T /F 2>$null | Out-Null
            $script:FrontendPid = $null
        }

        Write-Host "    stopping the containers"
        docker compose --project-directory $RepoRoot stop
    }
    catch {
        Write-Host "    shutdown had a problem: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    finally {
        $ErrorActionPreference = $old
    }

    Write-Host ""
    Write-Host "MoneyMap is off." -ForegroundColor Green
    Start-Sleep -Seconds 2
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
    Start-DockerEngine
    Start-Containers
    Build-Frontend
    Wait-Api
    Start-Frontend

    # So depois de o 3000 responder: abrir antes mostrava um erro de ligacao.
    Start-Process "http://localhost:3000"

    Show-Panel "MoneyMap is running at http://localhost:3000"
}
catch {
    Write-Host ""
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Show-Panel "MoneyMap did not start."
}
finally {
    Stop-Everything
}