import { defineConfig } from 'vite';

// Servidor de desarrollo por HTTP simple. 'localhost' (y 127.0.0.1) es un
// "contexto seguro" para el navegador, asi que WebXR FUNCIONA en local sin
// HTTPS:
//   - Escritorio:           http://localhost:5174/
//   - Quest por cable USB:  adb reverse + http://localhost:5174/ en el Quest
//
// Para ver en el Quest por Wi-Fi (u otra persona), usa el despliegue publico de
// Netlify (HTTPS valido) -> https://quimcuant.netlify.app/  (npm run build y
// vuelve a subir dist/). Asi evitamos el lio de certificados autofirmados.
export default defineConfig({
  server: {
    host: true, // expone tambien en la IP de red local
    port: 5174,
  },
});
