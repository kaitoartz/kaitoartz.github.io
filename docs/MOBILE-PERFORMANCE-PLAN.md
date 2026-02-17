# Optimización de Rendimiento - MOBILE & LOW END TARGET

Base: `PERFORMANCE-OPTIMIZATION.md`

Este documento detalla una estrategia agresiva de optimización para dispositivos móviles y hardware de bajo rendimiento, centrada en la percepción de velocidad y la reducción drástica de carga en GPU/CPU.

## 📱 Estrategia "Fake It 'Til You Make It"

### 1. Carga Condicional & Renderizado Diferido (The Double-If)

Implementar una lógica de renderizado estricta basada en el perfil del dispositivo.

**Lógica Propuesta:**

```javascript
if (isMobile || isLowPerformance) {
  // 1. Renderizar SOLO la capa de introducción (Hyper Intro)
  renderHyperIntroLayer();

  // 2. PAUSAR o NO RENDERIZAR el #body-content (Dashboard completo)
  // Esto libera recursos para que la intro fluya suavemente.

  // 3. Listener en el botón de entrada
  enterSystemBtn.addEventListener("click", () => {
    // A. Carga Sincrónica (Bloqueante pero segura) del contenido
    loadBodyContentSynchronously();

    // B. Transición "Falseada"
    // Iniciar animación de salida MUY LENTA para enmascarar la carga
    startExitAnimation({ duration: "3000ms", easing: "linear" });

    // C. Acelerar cuando el contenido esté listo
    waitForContentReady().then(() => {
      accelerateExitAnimation(); // ¡ZAS! Transición rápida final
    });
  });
} else {
  // Comportamiento normal desktop high-end
  renderAll();
}
```

### 2. Recortes Agresivos (Mobile + Low Perf)

Si se detecta `isMobile && isLowPerformance`, aplicar los siguientes recortes nivel "Modo Seguro":

- **🚫 MATRIX EFFECT**: Desactivar totalmente (Canvas off). Consumo de GPU masivo en pantallas de alta densidad de píxeles.
- **🚫 SHADOWS & GLOWS**: `box-shadow: none !important;` y `text-shadow: none !important;` globalmente si es posible. El neón es costoso.
- **🚫 BACKDROP-FILTER**: Reemplazar todos los efectos de vidrio (`blur`) por fondos sólidos con opacidad (`rgba(0,0,0,0.9)`). El `backdrop-filter` es el asesino #1 de rendimiento en móviles.
- **🚫 INTRO ITEMS (Opacity 0)**: Cualquier elemento `.intro-item` que esté oculto (`opacity: 0`) debe pasar a `display: none`. El navegador a veces sigue calculando layout para elementos transparentes.
- **🚫 INTRO STARS**: Desactivar o eliminar del DOM todos los elementos `.intro-star`. Animaciones de miles de nodos DOM son mortales.

## 📉 Métricas Esperadas

| Métrica            | Estado Actual (Mobile) | Objetivo (Optimized) |
| :----------------- | :--------------------- | :------------------- |
| **FPS Intro**      | ~15-20 FPS             | **60 FPS** (Sólido)  |
| **Input Latency**  | Notable lag            | **<50ms**            |
| **Battery Impact** | Alto (Phone gets hot)  | **Bajo**             |
| **Crash Rate**     | Riesgo medio (OOM)     | **Nulo**             |

## 🛠️ Pasos de Implementación

1.  **Detección**: Refinar `detectHardware()` en `script.js` para identificar flags `isMobile` y `isLowPerf`.
2.  **CSS Class**: Inyectar clase `mobile-low-perf` al `<body>` desde el inicio.
3.  **CSS Overrides**: Crear reglas CSS específicas para `body.mobile-low-perf` que anulen efectos costosos.
4.  **JS Logic**: Modificar la rutina de inicialización para aplicar el "Double-If" de renderizado.
