# =============================================================================
#  Alternativa por CABLE USB (independiente de la Wi-Fi) para ver la app en el
#  Meta Quest 2 mediante "adb reverse".
#
#  Tunel:  Quest(localhost:5174) --USB--> PC(127.0.0.1:5174) --portproxy--> WSL
#
#  REQUISITOS (una sola vez):
#    A) Modo Desarrollador activado en el Quest (app movil Meta Quest ->
#       Dispositivos -> tu Quest -> Modo desarrollador -> ON).
#    B) Android platform-tools (adb) instalado y en el PATH de Windows.
#         winget install Google.PlatformTools
#       (o descarga "SDK Platform Tools" y aniade la carpeta al PATH).
#    C) Haber ejecutado UNA VEZ scripts\quest-vr-setup.ps1 como administrador:
#       crea el puente 127.0.0.1:5174 -> WSL que necesita adb reverse.
#       (Ese puente apunta a WSL, NO a la Wi-Fi, asi que sobrevive cambios de red.)
#
#  USO (NO necesita administrador), con el Quest conectado por USB-C:
#    powershell -ExecutionPolicy Bypass -File quest-vr-usb.ps1
# =============================================================================

$port = 5174

# 1) Comprobar adb.
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  Write-Host "adb no encontrado. Instala platform-tools:" -ForegroundColor Red
  Write-Host "   winget install Google.PlatformTools" -ForegroundColor Yellow
  exit 1
}

# 2) Comprobar que el Quest esta conectado y autorizado.
$out = (adb devices) -join "`n"
Write-Host $out
if ($out -match "unauthorized") {
  Write-Host "El Quest aparece como 'unauthorized'. Ponte las gafas y acepta" -ForegroundColor Yellow
  Write-Host "'Permitir depuracion USB' (marca 'Siempre permitir')." -ForegroundColor Yellow
  exit 1
}
if (-not ($out -match "device`r?$" -or $out -match "device\s*$")) {
  Write-Host "No detecto el Quest. Revisa: cable de DATOS, Modo Desarrollador ON," -ForegroundColor Yellow
  Write-Host "y acepta el aviso de depuracion USB dentro de las gafas." -ForegroundColor Yellow
}

# 3) Crear el reenvio inverso por USB.
adb reverse tcp:$port tcp:$port | Out-Null
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " adb reverse activo. En el navegador del Quest abre:" -ForegroundColor Green
Write-Host "     https://localhost:$port/" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Reenvios inversos activos:"
adb reverse --list
