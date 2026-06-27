# Add Antigravity CLI to PATH (if installed)
$agyBin = "$env:LOCALAPPDATA\agy\bin"
if ((Test-Path $agyBin) -and (($env:PATH -split ';') -notcontains $agyBin)) {
    $env:PATH = "$agyBin;$env:PATH"
}

# Auto-load .env from project root
$envFile = Join-Path $PWD ".env"
if (-not (Test-Path $envFile)) {
    # Fallback: try absolute path for this project
    $envFile = "C:\dev\projects\dc-intake-audit\.env"
}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), "Process")
        }
    }
}

function use-deepseek {
    # Core Bridge Settings sk-9fcb487f385e45e088f6386cad987cc3
    $env:ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"
    $env:ANTHROPIC_AUTH_TOKEN = $env:DEEPSEEK_API_KEY
    
    # Model Overrides (Crucial for Claude Code subagents and planning)
    $env:ANTHROPIC_MODEL = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-pro[1m]"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "deepseek-v4-flash"
    
    # Subagent & Reasoning Configuration
    $env:CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-v4-flash"
    $env:CLAUDE_CODE_EFFORT_LEVEL = "max"
    
    Write-Host ">>> DeepSeek V4-Pro Activated (1M Context Mode)" -ForegroundColor Cyan
    Write-Host ">>> Reminder: 75% Discount active until May 5th!" -ForegroundColor Green
}

function use-claude {
    # Define all variables to be cleared
    $deepseekVars = @(
        "ANTHROPIC_BASE_URL", 
        "ANTHROPIC_AUTH_TOKEN", 
        "ANTHROPIC_MODEL",
        "ANTHROPIC_DEFAULT_OPUS_MODEL", 
        "ANTHROPIC_DEFAULT_SONNET_MODEL", 
        "ANTHROPIC_DEFAULT_HAIKU_MODEL", 
        "CLAUDE_CODE_SUBAGENT_MODEL",
        "CLAUDE_CODE_EFFORT_LEVEL"
    )
    
    foreach ($var in $deepseekVars) {
        Remove-Item "Env:$var" -ErrorAction SilentlyContinue
    }
    
    Write-Host ">>> Official Anthropic Claude Restored" -ForegroundColor Yellow
}

function use-codex {
    Write-Host ">>> Codex CLI Ready <<<" -ForegroundColor Magenta
}