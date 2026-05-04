param(
    [switch]$SkipTests,
    [switch]$NoNewWindows
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$forkRoot = Join-Path $repoRoot "vendor\scratch-editor"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Wait-Http {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "[OK] $Name pronto em $Url" -ForegroundColor Green
                return
            }
        } catch {
            # Service may still be booting.
        }
        Start-Sleep -Seconds 2
    }

    throw "Timeout aguardando $Name em $Url"
}

function Start-ServiceCommand {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string]$Title
    )

    if ($NoNewWindows) {
        Write-Host "[INFO] Iniciando em background: $Title"
        Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-Command", "Set-Location '$WorkingDirectory'; $Command"
        return
    }

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='$Title'; Set-Location '$WorkingDirectory'; $Command"
}

Write-Step "Validando pre-requisitos"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js nao encontrado no PATH"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm nao encontrado no PATH"
}
if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
    throw "package.json nao encontrado na raiz do monorepo: $repoRoot"
}
if (-not (Test-Path (Join-Path $forkRoot "package.json"))) {
    throw "Fork do scratch-editor nao encontrado em $forkRoot"
}

Write-Host "Node: $(node -v)"
Write-Host "npm:  $(npm -v)"

if (-not $SkipTests) {
    Write-Step "Rodando testes rapidos (evaluator + api)"
    Push-Location $repoRoot
    try {
        npm run test --workspace @hyscratch/evaluator
        npm run test --workspace @hyscratch/api
    } finally {
        Pop-Location
    }
} else {
    Write-Step "Pulando testes por opcao -SkipTests"
}

Write-Step "Subindo API, Web e Scratch GUI"
Start-ServiceCommand -WorkingDirectory $repoRoot -Command "npm run dev:api" -Title "hyScratch API"
Start-ServiceCommand -WorkingDirectory $repoRoot -Command "npm run dev:web" -Title "hyScratch Web"
Start-ServiceCommand -WorkingDirectory $forkRoot -Command "npm run --workspace @scratch/scratch-gui start" -Title "Scratch GUI Fork"

Write-Step "Aguardando servicos ficarem disponiveis"
Wait-Http -Url "http://localhost:3000/health" -Name "API"
Wait-Http -Url "http://localhost:5173" -Name "Web"
Wait-Http -Url "http://localhost:8601" -Name "Scratch GUI"

Write-Step "Ambiente pronto para teste manual"
Write-Host "Web:         http://localhost:5173" -ForegroundColor Yellow
Write-Host "API health:  http://localhost:3000/health" -ForegroundColor Yellow
Write-Host "Scratch GUI: http://localhost:8601" -ForegroundColor Yellow
Write-Host "`nChecklist rapido:" -ForegroundColor Magenta
Write-Host "1) Abrir web em localhost:5173"
Write-Host "2) Marcar uso do fork local"
Write-Host "3) Abrir editor embutido e testar conexao"
Write-Host "4) Importar .sb3 e confirmar carregamento no iframe"
Write-Host "5) Exportar .sb3 e validar que veio do estado atual do editor"
