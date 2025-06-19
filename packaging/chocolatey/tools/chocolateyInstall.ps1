$toolsDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$url        = 'https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera.exe'

$packageArgs = @{
  packageName    = 'voxvera'
  fileType       = 'exe'
  url            = $url
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
