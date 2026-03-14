$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Uninstalling VoxVera..."

# 1. Uninstall via pipx
if (Get-Command pipx -ErrorAction SilentlyContinue) {
    pipx uninstall voxvera | Out-Null
}

# 2. Uninstall via pip
if (Get-Command pip -ErrorAction SilentlyContinue) {
    pip uninstall -y voxvera | Out-Null
}

# 3. Remove manual binary
$home = [Environment]::GetFolderPath('UserProfile')
$exePath = Join-Path $home '.local\bin\voxvera.exe'
if (Test-Path $exePath) {
    Remove-Item $exePath -Force
}

Write-Host "`nVoxVera has been uninstalled."
