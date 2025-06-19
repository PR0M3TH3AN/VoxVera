$ErrorActionPreference = 'Stop'

$packages = @('tor', 'onionshare', 'jq', 'qrencode', 'imagemagick')

function Install-Choco {
    param([string]$Name)
    if (-not (Get-Package -Name $Name -ErrorAction SilentlyContinue)) {
        choco install $Name -y
    }
}

function Install-Pkg {
    param([string]$Name)
    if (-not (Get-Package -Name $Name -ErrorAction SilentlyContinue)) {
        Install-Package -Name $Name -Force -ErrorAction Stop
    }
}

$choco = Get-Command choco -ErrorAction SilentlyContinue
if ($choco) {
    foreach ($p in $packages) { Install-Choco $p }
} else {
    foreach ($p in $packages) { Install-Pkg $p }
}

if (Get-Command pipx -ErrorAction SilentlyContinue) {
    pipx install voxvera --force
} else {
    $dest = "$HOME/.local/bin"
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $url = 'https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera.exe'
    Invoke-WebRequest -Uri $url -OutFile "$dest/voxvera.exe"
}

Write-Host 'VoxVera installed successfully.'
