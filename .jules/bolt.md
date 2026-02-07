## 2025-02-23 - Avoid getComputedStyle in loops
**Learning:** `getComputedStyle` forces a synchronous style recalculation (reflow) which is extremely expensive when called inside a `requestAnimationFrame` loop (60fps).
**Action:** Cache the style value (e.g., color) in a variable and update it only when necessary (e.g., using `MutationObserver` or specific event listeners) instead of reading it every frame.

## 2025-02-23 - IntersectionObserver Memory Leaks
**Learning:** `IntersectionObserver` callbacks that trigger one-time animations (like scroll reveals or counters) often forget to `unobserve` the element. This leaves the observer checking those elements forever, wasting CPU on scroll.
**Action:** Always call `observer.unobserve(entry.target)` immediately after the one-time action is performed in the callback.

## 2025-02-23 - Idle Animation Loops
**Learning:** `requestAnimationFrame` loops for interactive elements (like custom cursors) often run continuously even when the state is static (e.g., mouse not moving), wasting CPU/GPU resources on idle frames.
**Action:** Implement a "sleep" mechanism: stop the loop when the animation reaches a resting state (e.g., trails faded) and restart it only on user interaction events (mousemove, resize).

## 2025-02-23 - Optimizing Randomness in Particle Systems
**Learning:** Calling `Math.random()` and accessing random array indices inside a per-frame, per-particle loop (like Matrix Rain with 100+ columns) creates significant CPU overhead (~3.7x slower than pre-calc).
**Action:** Use a pre-filled `Uint8Array` buffer for random values and cycle through it using bitwise AND (`& 4095`) for modulo operations. This eliminates the cost of random number generation and modulo division in the hot path.
