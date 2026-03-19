$ErrorActionPreference = 'Stop'

Write-Warning 'The Windows installer path is experimental. It is not yet validated for reliable background Tor hidden-service hosting or automatic recovery after connectivity changes.'

$packages = @('tor', 'onionshare')

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

function Install-PipFallback {
    if (Get-Command pip -ErrorAction SilentlyContinue) {
        try {
            pip install --user voxvera
            Write-Host 'VoxVera installed successfully via pip.'
            exit 0
        } catch {
            Write-Error 'pip installation failed.'
            exit 1
        }
    } else {
        Write-Error 'pip not found for fallback installation.'
        exit 1
    }
}

function Install-PipRepoFallback {
    if (Get-Command pip -ErrorAction SilentlyContinue) {
        try {
            pip install --user git+https://github.com/PR0M3TH3AN/VoxVera
            Write-Host 'VoxVera installed successfully from repository.'
            exit 0
        } catch {
            Write-Error 'pip installation from repository failed.'
            exit 1
        }
    } else {
        Write-Error 'pip not found for fallback installation.'
        exit 1
    }
}

function Download-Binary {
    param([string]$Url, [string]$Dest)
    try {
        $response = Invoke-WebRequest -Uri $Url -OutFile $Dest -ErrorAction Stop
        return $response.StatusCode
    } catch {
        if ($_.Exception.Response) {
            return $_.Exception.Response.StatusCode.value__
        }
        return 0
    }
}

function Check-LocalBin {
    $home = [Environment]::GetFolderPath('UserProfile')
    $binPath = Join-Path $home '.local\bin'
    if (-not ($Env:PATH.Split(';') -contains $binPath)) {
        Write-Host "Add $binPath to your PATH to run VoxVera."
    }
}

function Show-VoxVeraStatus {
    if (-not (Get-Command voxvera -ErrorAction SilentlyContinue)) {
        return
    }

    try {
        $platform = voxvera platform-status --json | ConvertFrom-Json
        Write-Host ("Platform tier: {0} ({1})" -f $platform.tier, $platform.label)
        if ($platform.hosting_model) {
            Write-Host ("Hosting model: {0}" -f $platform.hosting_model)
        }
    } catch {
        Write-Warning "Could not read platform status from voxvera."
    }

    try {
        $doctor = voxvera doctor --json | ConvertFrom-Json
        $failed = @($doctor.checks | Where-Object { -not $_.ok } | ForEach-Object { $_.name })
        if ($failed.Count -gt 0) {
            Write-Host ("Doctor checks needing attention: {0}" -f ($failed -join ', '))
        } else {
            Write-Host 'Doctor checks: all passed'
        }
    } catch {
        Write-Warning "Could not read doctor output from voxvera."
    }

    try {
        $autostart = voxvera autostart status --json | ConvertFrom-Json
        Write-Host ("Autostart: {0}" -f $autostart.message)
    } catch {
        Write-Warning "Could not read autostart status from voxvera."
    }
}

if (Get-Command pipx -ErrorAction SilentlyContinue) {
    try {
        pipx install voxvera --force
    } catch {
        Write-Host 'pipx install failed, downloading binary'
        $home = [Environment]::GetFolderPath('UserProfile')
        $dest = Join-Path $home '.local\bin'
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        $url = 'https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera-windows.exe'
        $status = Download-Binary $url "$dest/voxvera.exe"
        if ($status -eq 200) {
            Check-LocalBin
        } elseif ($status -eq 404) {
            Write-Host 'Release asset not found, installing from repository'
            Install-PipRepoFallback
        } else {
            Write-Host 'Binary download failed, falling back to pip'
            Install-PipFallback
        }
    }
} else {
    $home = [Environment]::GetFolderPath('UserProfile')
    $dest = Join-Path $home '.local\bin'
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $url = 'https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera-windows.exe'
    $status = Download-Binary $url "$dest/voxvera.exe"
    if ($status -eq 200) {
        Check-LocalBin
    } elseif ($status -eq 404) {
        Write-Host 'Release asset not found, installing from repository'
        Install-PipRepoFallback
    } else {
        Write-Host 'Binary download failed, falling back to pip'
        Install-PipFallback
    }
}

Write-Host 'VoxVera installed successfully.'
Show-VoxVeraStatus
