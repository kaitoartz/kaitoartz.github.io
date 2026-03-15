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

## 2025-02-23 - Event Delegation Over MutationObserver
**Learning:** Attaching event listeners (like `mouseenter`) dynamically via `MutationObserver` creates overhead, as the observer triggers on multiple DOM changes and executes heavy query/attachment logic.
**Action:** Replace `MutationObserver`-based listener attachments with a single, passive `mouseover` listener attached to the `document` (event delegation). Use `e.target.closest(selector)` to identify targets.

## 2025-02-23 - Nested Elements in Event Delegation
**Learning:** When using `mouseover` delegation, moving the mouse from a child element back to a parent element that matches the same selector can cause `target !== this.lastHoveredTarget` to evaluate as true, incorrectly re-triggering hover sounds.
**Action:** In addition to `target !== this.lastHoveredTarget`, add a check `!target.contains(this.lastHoveredTarget)` to prevent re-triggering when navigating within nested matched elements. Ensure `this.lastHoveredTarget = target` is always updated to properly track the path.
