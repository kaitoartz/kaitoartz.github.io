## 2024-05-19 - consoleFeed Optimization
**Learning:** Decorative, constantly updating DOM elements like terminal feeds (`consoleFeed`) can consume significant CPU and cause unnecessary layout thrashing/GC if they run continuously, even when off-screen.
**Action:** Always wrap recurring DOM manipulation intervals or requestAnimationFrames for visual effects in an `IntersectionObserver` to halt execution when the element is not in the viewport. This provides an immediate, O(1) performance boost for background tabs or unviewed sections.
