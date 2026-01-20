# 🎵 SOLUCIÓN: Audio CORS Bloqueado

## ❌ Problema
Cuando abres `index.html` con `file://`, el navegador bloquea la carga de archivos por políticas de seguridad CORS.

## ✅ Soluciones

### Opción 1: VS Code Live Server (RECOMENDADO)

1. **Instala la extensión Live Server:**
   - En VS Code, presiona `Ctrl+Shift+X`
   - Busca "Live Server" (de Ritwick Dey)
   - Click en "Install"

2. **Inicia el servidor:**
   - Click derecho en `index.html`
   - Selecciona "Open with Live Server"
   - Se abrirá en `http://127.0.0.1:5500`

3. **¡Listo!** El audio funcionará perfectamente.

---

### Opción 2: Python HTTP Server

```powershell
# 1. Instala Python desde: https://www.python.org/downloads/
# 2. En la terminal, ejecuta:
python -m http.server 8000

# 3. Abre: http://localhost:8000
```

---

### Opción 3: Node.js http-server

```powershell
# 1. Instala Node.js desde: https://nodejs.org/
# 2. En la terminal, ejecuta:
npx http-server -p 8000

# 3. Abre: http://localhost:8000
```

---

## 🔧 Código Actualizado

✅ Ya actualicé el código para que funcione mejor:
- Los sonidos de UI ahora usan `new Audio()` directamente (sin fetch)
- El background music sigue usando el método optimizado
- Agregué fallbacks de sonidos sintetizados

## 📝 Comandos de Terminal Mejorados

Ahora puedes usar en la terminal integrada:
```
audio test    # Ver estado del sistema de audio
audio play    # Reproducir música
audio stop    # Detener música
```

---

## ⚡ Quick Start (VS Code)

1. Presiona `F1` o `Ctrl+Shift+P`
2. Escribe "Live Server"
3. Selecciona "Open with Live Server"
4. ¡Disfruta tu audio funcionando! 🎵

---

## 🐛 Si Aún Tienes Problemas

1. Verifica que `background.mp3` esté en `assets/audio/`
2. Usa la consola (F12) para ver logs
3. Prueba `audio-test.html` primero para confirmar que el archivo funciona
