# Optimización de Rendimiento - KAITOARTZ Portfolio

## 📊 Análisis del Profiler de Firefox

### Problemas Identificados:
- **Paint: 483ms** (debería ser <16ms para 60fps)
- **Graphics: 96% CPU** (255 muestras)
- **DisplayList building: 54%**
- **WebRender display list: 38%**

El sitio tiene demasiados efectos visuales activos simultáneamente, causando sobrecarga en la GPU.

---

## ✅ Optimizaciones Implementadas

### 1. **Matrix Rain Optimizado**
- ✅ **FPS limitado a 24fps** (antes sin límite)
- ✅ **Tamaño de fuente aumentado** de 14px a 16px (menos columnas)
- ✅ **Control de frame rate** con `requestAnimationFrame` throttling
- ✅ **Trail effect optimizado** con mayor opacidad (0.08 vs 0.05)

```javascript
// Control de FPS implementado
this.fps = 24;
this.frameInterval = 1000 / this.fps;
```

### 2. **Presets de Rendimiento Ajustados**
Los presets ahora son más conservadores:

| Preset | Matrix | Parallax | Cursor | Scanlines | Glitch | Particles |
|--------|--------|----------|--------|-----------|--------|-----------|
| **Ultra** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **High** | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Medium** | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Low** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 3. **Nuevos Comandos del Terminal**

#### `performance [preset]`
Cambia el preset de rendimiento:
```bash
performance low     # Mínimos efectos, máximo rendimiento
performance medium  # Balanceado
performance high    # La mayoría de efectos (recomendado)
performance ultra   # Todos los efectos
performance auto    # Detección automática
```

#### `fps [number]`
Ajusta los FPS del efecto Matrix (12-60):
```bash
fps 12   # Bajo consumo (systems lentos)
fps 24   # Balanceado (predeterminado)
fps 30   # Suave
fps 60   # Alto rendimiento (solo sistemas potentes)
```

---

## 🎯 Recomendaciones Adicionales

### Para el Usuario:
1. **Ejecutar `performance medium`** en el terminal para uso normal
2. **Usar `fps 18`** si aún experimentas lag
3. **Desactivar efectos individuales** según necesidad:
   - `matrix` - Desactiva Matrix rain
   - `cursor` - Desactiva cursor trail
   - `glitch` - Desactiva efectos glitch
   - `particles` - Desactiva partículas

### Para Desarrollo Futuro:

#### Optimizaciones Canvas:
```javascript
// Usar canvas offscreen para Matrix rain
const offscreen = new OffscreenCanvas(width, height);

// Reducir resolución en dispositivos móviles
const dpr = window.devicePixelRatio;
if (isMobile) {
    canvas.width = window.innerWidth / 2;
    canvas.height = window.innerHeight / 2;
    ctx.scale(2, 2);
}
```

#### Lazy Loading de Efectos:
```javascript
// Cargar efectos solo cuando sean visibles
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            initEffect();
        } else {
            pauseEffect();
        }
    });
});
```

#### CSS Optimization:
```css
/* Usar will-change con moderación */
.parallax-layer {
    will-change: transform;
}

/* Usar transform en lugar de top/left */
.particle {
    transform: translate3d(x, y, 0);
    /* NO usar: top: y; left: x; */
}

/* Reducir blur y shadows */
.glitch-text {
    text-shadow: 2px 0 #00FF00; /* En lugar de múltiples shadows */
}
```

#### Debouncing de Eventos:
```javascript
// Throttle para eventos de mouse/scroll
const throttle = (func, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
};

window.addEventListener('mousemove', throttle(handleMouseMove, 16));
```

---

## 📈 Métricas Objetivo

### Antes de Optimización:
- Paint: **483ms** ❌
- FPS: ~2-3 fps
- CPU: 96% Graphics

### Después de Optimización (esperado):
- Paint: **<50ms** ✅
- FPS: 24-30 fps estables
- CPU: 40-60% Graphics

---

## 🔧 Testing

### Prueba con Firefox Profiler:
1. Abrir Firefox DevTools (F12)
2. Ir a pestaña "Performance" (Rendimiento)
3. Grabar por 5-10 segundos
4. Verificar que:
   - Paint < 50ms
   - Graphics < 60%
   - FPS estable ~24-30

### Prueba en Terminal:
```bash
# Probar diferentes configuraciones
performance low
# Esperar 10 segundos, observar
performance medium
# Esperar 10 segundos, observar
fps 18
# Verificar mejora
```

---

## 📝 Notas

- El preset **"high"** ahora es el recomendado para la mayoría de usuarios
- El **cursor trail** se ha desactivado por defecto (consume mucho GPU)
- Los **efectos glitch** también están desactivados por defecto
- El **FPS 24** es un buen balance entre suavidad y rendimiento

### Hardware Testing:
- **Low-end (4GB RAM, 2 cores)**: Usar `performance low` + `fps 12`
- **Mid-range (8GB RAM, 4 cores)**: Usar `performance medium` + `fps 24`
- **High-end (16GB+ RAM, 6+ cores)**: Usar `performance high` + `fps 30`
- **Enthusiast**: Usar `performance ultra` + `fps 60`

---

## 🎨 Impacto Visual

Las optimizaciones mantienen la estética cyberpunk/brutalista mientras mejoran significativamente el rendimiento. Los usuarios pueden ajustar fácilmente según sus preferencias y capacidad de hardware.

**Comandos rápidos para emergencia (lag severo):**
```bash
performance low
matrix
cursor
particles
```

Esto desactivará todos los efectos pesados instantáneamente.
