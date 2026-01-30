## 2025-02-23 - Avoid getComputedStyle in loops
**Learning:** `getComputedStyle` forces a synchronous style recalculation (reflow) which is extremely expensive when called inside a `requestAnimationFrame` loop (60fps).
**Action:** Cache the style value (e.g., color) in a variable and update it only when necessary (e.g., using `MutationObserver` or specific event listeners) instead of reading it every frame.

## 2026-01-30 - Unobserve in IntersectionObserver
**Learning:** IntersectionObserver callbacks continue to fire for elements even after the desired action (like adding a class) is done, unless explicitly unobserved.
**Action:** Always call `observer.unobserve(entry.target)` inside the callback if the intersection logic is one-off (e.g. reveal animations).
