# =============================================================================
#  Reenvio de puerto Windows -> WSL2 para ver la app en las gafas Meta Quest.
#
#  EJECUTAR EN WINDOWS, en PowerShell COMO ADMINISTRADOR:
#    powershell -ExecutionPolicy Bypass -File quest-vr-setup.ps1
#
#  Hace dos cosas:
#    1. Reenvia el puerto 5174 de Windows hacia el servidor Vite dentro de WSL2.
#    2. Abre ese puerto en el Firewall de Windows (entrante, TCP).
#
#  La IP de WSL2 cambia al reiniciar; este script la detecta sola cada vez.
#  Vuelve a ejecutarlo si reinicias el PC o WSL.
# =============================================================================

$port = 5174

# IP interna actual de WSL2 (primer valor de 'hostname -I').
$wsl = (wsl hostname -I).Trim().Split(" ")[0]
if (-not $wsl) { Write-Host "No pude obtener la IP de WSL. Esta corriendo WSL?" -ForegroundColor Red; exit 1 }
Write-Host "IP de WSL2 detectada: $wsl"

# 1a) Reenvio para la RED (Wi-Fi): escucha en todas las interfaces IPv4.
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy add    v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wsl
Write-Host "Reenvio (Wi-Fi) creado: 0.0.0.0:$port -> ${wsl}:$port"

# 1b) Reenvio explicito en loopback IPv4 (lo usa 'adb reverse' del modo USB).
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=127.0.0.1 2>$null | Out-Null
netsh interface portproxy add    v4tov4 listenport=$port listenaddress=127.0.0.1 connectport=$port connectaddress=$wsl
Write-Host "Reenvio (USB/loopback) creado: 127.0.0.1:$port -> ${wsl}:$port"

# 2) Regla de firewall (entrante). Borra la previa y crea la nueva.
Remove-NetFirewallRule -DisplayName "WSL Vite $port" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL Vite $port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
Write-Host "Regla de firewall creada para el puerto $port"

# IP Wi-Fi de Windows (la que usa el Quest).
$wifi = (Get-NetIPAddress -AddressFamily IPv4 |
         Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -and $_.IPAddress -notlike "169.254*" } |
         Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
if ($wifi) {
  Write-Host " En el navegador del Quest 2 abre:" -ForegroundColor Green
  Write-Host "     https://${wifi}:$port/" -ForegroundColor Yellow
} else {
  Write-Host " Abre en el Quest:  https://<IP-Wi-Fi-de-este-PC>:$port/" -ForegroundColor Green
}
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Estado del portproxy:"
netsh interface portproxy show all
