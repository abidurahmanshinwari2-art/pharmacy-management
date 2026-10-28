$ErrorActionPreference = "Continue"
netsh advfirewall firewall delete rule name="Pharmacy Management System" | Out-Null
netsh advfirewall firewall add rule name="Pharmacy Management System" dir=in action=allow protocol=TCP localport=4050 profile=any | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }
Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object {
  Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue
}
exit 0
