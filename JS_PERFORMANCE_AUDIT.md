# Auditoría de Rendimiento JavaScript (Enfoque Mobile/Low-End)

## Resumen Ejecutivo
El sitio cuenta con una arquitectura de rendimiento sólida implementada a través de `PerformanceManager` y `FrameRateMonitor`. Sin embargo, existen oportunidades críticas de optimización para dispositivos móviles y de gama baja, especialmente en el manejo de Canvas, loops de animación y bibliotecas de terceros.

## 1. Análisis de Cuellos de Botella

### 🔴 Crítico (Alto Impacto en Móvil)

1.  **Resolución de Canvas (Matrix Rain)**
    *   **Problema:** `MatrixRain.resize()` establece el tamaño del canvas igual a `window.innerWidth` / `height`. En dispositivos móviles modernos (Retina/High-DPI), esto cuadruplica la cantidad de píxeles que la GPU debe procesar para un efecto de fondo.
    *   **Impacto:** Alto consumo de GPU y batería. Caída de FPS en gamas medias/bajas.
    *   **Solución:** Limitar el `devicePixelRatio` a 1 (o incluso 0.5 para efectos muy borrosos) en dispositivos móviles.

2.  **Smooth Scroll (Lenis) en Móvil**
    *   **Problema:** La biblioteca `Lenis` se inicializa globalmente. Aunque es eficiente, el "scroll hijacking" en móviles puede sentirse antinatural y competir con la aceleración nativa del navegador, además de consumir recursos de CPU en cada evento `scroll`.
    *   **Solución:** Deshabilitar condicionalmente `Lenis` si `performanceManager.hardware.isMobile` es `true`.

3.  **Loop del Visualizador de Audio**
    *   **Problema:** `AudioVisualizer.draw()` utiliza `requestAnimationFrame` recursivo. Si el visualizador está oculto (por CSS en móvil o scroll) o el audio no suena, este loop sigue consumiendo CPU inútilmente.
    *   **Solución:** Usar `IntersectionObserver` para detener el loop (`this.stop()`) cuando el componente no está en el viewport.

### 🟡 Medio (Impacto Moderado)

4.  **Inicialización en Cascada**
    *   **Problema:** En `DOMContentLoaded`, se utiliza un `setTimeout(..., 100)` masivo para iniciar casi todos los managers. Esto puede causar un "Long Task" que bloquee la interactividad inicial justo cuando el usuario espera que cargue.
    *   **Solución:** Usar `requestIdleCallback` para inicializar sistemas no críticos (Partículas, Matrix, Easter Eggs) y priorizar solo lo visible (Intro, UI básica).

5.  **Manejo de Eventos `scroll` y `resize`**
    *   **Problema:** Aunque `ParallaxManager` usa `requestAnimationFrame` para "debouncing", la comprobación de `window.scrollY` sigue ocurriendo.
    *   **Solución:** Usar observadores pasivos o `IntersectionObserver` donde sea posible en lugar de escuchar el evento `scroll` global para animaciones de entrada.

### 🟢 Leve (Mejoras de Código)

6.  **Detección de Hardware**
    *   **Problema:** `navigator.hardwareConcurrency` a menudo devuelve valores limitados (ej. 2) por privacidad en navegadores como Safari, lo que podría clasificar erróneamente un iPhone 15 Pro como "Gama Baja".
    *   **Solución:** Refinar la lógica de `PerformanceManager` para considerar también la presencia de GPU (vía WebGL debug info si es crítico) o asumir gama media por defecto en iOS recientes.

## 2. Recomendaciones Específicas de Código

### A. Optimización de Matrix Rain (js/script.js)
```javascript
// En MatrixRain.resize()
resize() {
    // Forzar escala 1:1 o menor en móviles para rendimiento
    const dpr = this.isMobile ? 1 : window.devicePixelRatio;
    // O incluso reducir a la mitad en gama baja
    const scale = performanceManager.currentPreset === 'low' ? 0.5 : 1;

    this.canvas.width = window.innerWidth * scale;
    this.canvas.height = window.innerHeight * scale;
    this.ctx.scale(scale, scale);
    // ... resto del código
}
```

### B. Desactivar Lenis en Móvil
```javascript
// En HyperScrollIntro.initLenis()
initLenis() {
    // Usar scroll nativo en móvil para mejor tacto y rendimiento
    if (typeof Lenis !== 'undefined' && !performanceManager.hardware.isMobile) {
        this.lenis = new Lenis({ ... });
        // ...
    }
}
```

### C. Visualizador Eficiente
```javascript
// En AudioVisualizer
init() {
    // ... setup
    this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && this.analyser) {
                this.start();
            } else {
                this.stop();
            }
        });
    });
    this.observer.observe(this.canvas);
}
```

## 3. Estado Actual (Lo que ya funciona bien)
*   ✅ **FrameRateMonitor:** La degradación automática de calidad si bajan los FPS es una excelente defensa.
*   ✅ **Cursor Manager:** Ya se deshabilita correctamente en pantallas táctiles (`window.innerWidth > 767`).
*   ✅ **Modo Low Performance:** La clase CSS `body.performance-mode-low` efectivamente apaga sombras, filtros y animaciones costosas.

## Conclusión
El sitio está bien estructurado para rendimiento ("Mobile First" en lógica, aunque "Desktop First" en diseño visual). Aplicando las correcciones de resolución de Canvas y desactivando bibliotecas de scroll en móvil, el rendimiento en dispositivos de gama baja debería mejorar drásticamente (estimado +15-20 FPS en gama baja).
