## 2026-06-28 - Optimizing High-Frequency Scroll Events
**Learning:** Raw DOM manipulation inside `requestAnimationFrame` isn't fully safe from layout thrashing if state isn't tracked. In vanilla JS codebases like this one, it's common to find scroll handlers calling `classList.add`/`remove` blindly.
**Action:** Next time I encounter high-frequency event handlers, I'll prioritize implementing state caching (`if (newState !== oldState) { update DOM }`) alongside standard throttling techniques like `requestAnimationFrame`.
