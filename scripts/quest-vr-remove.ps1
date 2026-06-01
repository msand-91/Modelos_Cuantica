# =============================================================================
#  Deshace el reenvio de puerto y la regla de firewall creados por
#  quest-vr-setup.ps1.  EJECUTAR COMO ADMINISTRADOR.
#    powershell -ExecutionPolicy Bypass -File quest-vr-remove.ps1
# =============================================================================
$port = 5174
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=127.0.0.1 2>$null | Out-Null
Remove-NetFirewallRule -DisplayName "WSL Vite $port" -ErrorAction SilentlyContinue
Write-Host "Reenvio y regla de firewall del puerto $port eliminados."
netsh interface portproxy show all
