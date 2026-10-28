$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientPath = Join-Path $root "pharmacy-data\client.json"
$out = Join-Path $env:TEMP "pharmacy-shop-mode.txt"
$c = Get-Content -Raw $clientPath | ConvertFrom-Json
$h = ""
if ($c.host) { $h = ([string]$c.host).Trim() }
$h = $h -replace '^https?://', '' -replace '/.*$', '' -replace ':\d+$', ''
$p = 4050
if ($c.port) { $p = [int]$c.port }
$mine = New-Object System.Collections.Generic.List[string]
foreach ($n in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
  foreach ($a in $n.GetIPProperties().UnicastAddresses) {
    $mine.Add($a.Address.ToString())
  }
}
if (-not $h) {
  Set-Content -Path $out -Value "bad" -Encoding ascii
  exit 0
}
if ($mine.Contains($h) -or $h -eq "127.0.0.1" -or $h -eq "localhost") {
  Set-Content -Path $out -Value "server" -Encoding ascii
} else {
  Set-Content -Path $out -Value "client http://${h}:$p" -Encoding ascii
}
exit 0
