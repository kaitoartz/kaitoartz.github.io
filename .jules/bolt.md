## 2025-02-23 - Avoid getComputedStyle in loops
**Learning:** `getComputedStyle` forces a synchronous style recalculation (reflow) which is extremely expensive when called inside a `requestAnimationFrame` loop (60fps).
**Action:** Cache the style value (e.g., color) in a variable and update it only when necessary (e.g., using `MutationObserver` or specific event listeners) instead of reading it every frame.

## 2025-02-23 - Verify Comment Intent vs Implementation
**Learning:** Code comments may describe optimizations that were never implemented or were removed, leading to misleading assumptions. The Matrix Rain loop claimed to "draw every second column" but actually iterated `i++`.
**Action:** Always verify that the code logic matches the comments, especially when performance claims are made. Implement the missing optimization if it aligns with the goals.
