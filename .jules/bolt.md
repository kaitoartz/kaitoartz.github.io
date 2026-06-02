## 2025-02-23 - Avoid getComputedStyle in loops
**Learning:** `getComputedStyle` forces a synchronous style recalculation (reflow) which is extremely expensive when called inside a `requestAnimationFrame` loop (60fps).
**Action:** Cache the style value (e.g., color) in a variable and update it only when necessary (e.g., using `MutationObserver` or specific event listeners) instead of reading it every frame.

## 2025-02-23 - IntersectionObserver Memory Leaks
**Learning:** `IntersectionObserver` callbacks that trigger one-time animations (like scroll reveals or counters) often forget to `unobserve` the element. This leaves the observer checking those elements forever, wasting CPU on scroll.
**Action:** Always call `observer.unobserve(entry.target)` immediately after the one-time action is performed in the callback.

## 2025-02-23 - Idle Animation Loops
**Learning:** `requestAnimationFrame` loops for interactive elements (like custom cursors) often run continuously even when the state is static (e.g., mouse not moving), wasting CPU/GPU resources on idle frames.
**Action:** Implement a "sleep" mechanism: stop the loop when the animation reaches a resting state (e.g., trails faded) and restart it only on user interaction events (mousemove, resize).

## 2025-02-23 - GC in Animation Loops
**Learning:** Passing arrow functions to `requestAnimationFrame` (e.g., `requestAnimationFrame(() => this.update())`) creates a new function object every frame. At 60fps, this generates significant garbage for the collector, causing micro-stutters.
**Action:** Bind the update method in the constructor (`this.update = this.update.bind(this)`) and pass the reference directly (`requestAnimationFrame(this.update)`).

## 2025-02-23 - Reliable Throttling in RAF
**Learning:** Relying on `rafId % N` or `time % N` for throttling updates inside `requestAnimationFrame` is unreliable because `rafId` is not guaranteed to be sequential and `time` is high-precision float.
**Action:** Use a dedicated `this.frameCount` variable incremented every frame for deterministic throttling (e.g., `if (this.frameCount % 10 === 0)`).

## 2025-02-23 - Dirty Checking in RAF Loops
**Learning:** Updating DOM properties like `style.opacity` or `style.transform` every frame, even with the same value, triggers browser work (style recalc). In scenes with many objects (like the Intro sequence), this adds up.
**Action:** Cache the last applied value (e.g., `item.currentAlpha`) and strictly compare it with the new value before writing to the DOM. Use `Math.abs(diff) > epsilon` for floats to avoid noise.

## 2025-02-23 - Disable Lenis on Mobile
**Learning:** Lenis smooth scrolling library was initialized on mobile devices in "Physical Mode" (Low/Medium tier), causing "scroll hijacking" and potentially degrading performance/UX by overriding native smooth scroll.
**Action:** Explicitly check `!isMobileBrowser` (or `!performanceManager.hardware.isMobile`) before initializing scroll hijacking libraries, ensuring mobile users get the native, hardware-accelerated scroll experience.

## 2025-02-23 - MutationObserver Performance Drain on Global Event Listeners
**Learning:** Using a `MutationObserver` on `document.body` to attach individual `mouseenter` event listeners to hundreds of dynamically generated elements creates a massive memory footprint and severe CPU overhead during DOM updates.
**Action:** Replace `MutationObserver` and individual listeners with O(1) event delegation. Use a single `mouseover` listener on `document` and a stateless `!e.relatedTarget || !target.contains(e.relatedTarget)` check to emulate `mouseenter` efficiently.

## 2025-02-23 - Array Iteration Methods in RAF
**Learning:** Array iteration methods like `.forEach()` and `.some()` require a callback function. When used inside a 60fps `requestAnimationFrame` loop, this forces the JS engine to allocate a new closure (function object) every single frame, leading to high garbage collection (GC) pressure and micro-stutters.
**Action:** Always replace `.forEach()`, `.some()`, and similar methods with standard `for` loops inside `requestAnimationFrame` loops or high-frequency event handlers.
## 2025-02-17 - Eliminate Layout Thrashing in `requestAnimationFrame`
**Learning:** Using `.innerText` to update high-frequency text elements (like HUD stats or FPS counters) inside a `requestAnimationFrame` loop forces the browser to perform synchronous style recalculations and layout thrashing. This is because `.innerText` is layout-aware (it respects CSS styling like `display: none` and text transformations).
**Action:** Always use `.textContent` for updating text nodes in animation loops, as it modifies the text directly without triggering expensive reflows.

## 2025-02-23 - DOM Queries in Animation Loops
**Learning:** Performing DOM queries like `querySelector` and modifying `classList` inside a 60fps `requestAnimationFrame` loop (e.g., in `HyperScrollIntro`) is extremely expensive, causing O(N) operations per frame and potential layout thrashing.
**Action:** Cache DOM elements (like `cardEl`) during initialization and track active states (like `isCardActive`) using a boolean flag to only update the DOM when the state actually changes.
## 2025-02-23 - DOM Querying in RAF
**Learning:** Calling `querySelector` inside `requestAnimationFrame` loops (e.g., in `HyperScrollIntro`) forces the browser to evaluate the DOM tree at up to 60fps. This causes severe layout thrashing and CPU spikes on lower-end devices.
**Action:** Always cache references to required child elements (e.g., `item.cardEl = item.el.querySelector(...)`) during the initialization phase instead of querying them dynamically inside the render loop.

## 2025-03-31 - Dirty Checking in RAF Loops
**Learning:** `src/scripts/script.js` was continuously updating DOM properties (`transform`, `perspective`) in `HyperScrollIntro`'s `requestAnimationFrame` loop even when the values hadn't significantly changed, leading to layout thrashing.
**Action:** Always cache the last applied values (`lastVizZ`, `lastTiltX`, etc.) and skip DOM updates if the calculated difference (`Math.abs(diff)`) is below a visually perceptible threshold (e.g., `< 0.1` for pixels/degrees).

## 2025-05-15 - requestAnimationFrame for DOM Animations
**Learning:** `setInterval` for animations operates independently of the screen refresh rate, leading to visual jitter, and it continues running even when the tab is backgrounded.
**Action:** Replace `setInterval` with `requestAnimationFrame` for DOM animations (like count-ups) to guarantee smooth execution matched to the monitor's refresh rate and automatically pause when the tab is off-screen.

## 2025-05-18 - Parallax Off-screen Optimization
**Learning:** Updating CSS transforms on off-screen elements during high-frequency events (like scroll) wastes CPU/GPU resources and can cause layer tree recalculations, even if the elements are invisible. Furthermore, updating the DOM for imperceptible sub-pixel changes causes redundant layout and compositing work.
**Action:** Use `IntersectionObserver` with a generous `rootMargin` (e.g., `100%`) to flag when parallax elements are safely out of view to skip their `style.transform` updates. Combine this with a dirty check (`Math.abs(lastYPos - yPos) > 0.5`) to eliminate sub-pixel DOM writes.
## 2024-05-18 - Passive Event Listeners for Resize/Mousemove
**Learning:** While `passive: true` is most famous for scroll-blocking events (touch/wheel), applying it to other high-frequency window events like `resize` or `mousemove` is a solid defensive practice that guarantees the browser spends zero time considering event cancellation logic, even if it wouldn't normally block layout for them.
**Action:** Always add `{ passive: true }` to `mousemove`, `resize`, and `scroll` listeners when `preventDefault()` is not needed, especially in performance-sensitive components like canvas managers.

## 2025-05-21 - Caching DOM lookups in periodic loops
**Learning:** Calling `document.querySelector` inside an unconditionally firing periodic function (like `setInterval` or `requestAnimationFrame` loops) wastes CPU cycles on repeated DOM lookups, even if the result is static (like the `.boot-overlay` element in `FrameRateMonitor`).
**Action:** Always cache the queried DOM element locally on the class/instance (e.g. `this.bootOverlay`) and reuse it instead of querying the DOM on every loop iteration.
## 2026-05-29 - Pre-calculate Section Offsets
**Learning:** Calling `getBoundingClientRect()` inside a scroll event handler's `requestAnimationFrame` loop forces synchronous layout recalculations (reflows/layout thrashing), which kills scroll performance.
**Action:** Pre-calculate and cache layout metrics (like absolute `top` offsets) on initialization, and update them via a debounced `resize` or `ResizeObserver` listener. Rely on `window.scrollY` during the high-frequency scroll event.

## 2026-06-02 - Redundant hardware detection calls
**Learning:** Calling `performanceManager.detectHardware()` repeatedly to check `isMobile` forces unnecessary recalculations of performance scores, CPU core counts, device memory, and connection types, wasting CPU cycles during initialization and UI interactions.
**Action:** Always use the cached `performanceManager.hardware` object (e.g., `performanceManager.hardware.isMobile`) instead of invoking `detectHardware()` directly when checking system capabilities outside of the initial setup.
