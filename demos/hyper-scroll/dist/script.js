// --- CONFIGURATION ---
        const CONFIG = {
            itemCount: 20,
            starCount: 150,
            zGap: 800,
            loopSize: 0, // Calculated
            camSpeed: 2.5,
            colors: ['#ff003c', '#00f3ff', '#ccff00', '#ffffff']
        };
        CONFIG.loopSize = CONFIG.itemCount * CONFIG.zGap;

        const TEXTS = ["IMPACT", "VELOCITY", "BRUTAL", "SYSTEM", "FUTURE", "DESIGN", "PIXEL", "HYPER", "NEON", "VOID"];

        // --- STATE ---
        const state = {
            scroll: 0,
            velocity: 0,
            targetSpeed: 0,
            mouseX: 0,
            mouseY: 0
        };

        const world = document.getElementById('world');
        const viewport = document.getElementById('viewport');
        const items = [];

        // --- INIT ---
        function init() {
            // Create Items
            for (let i = 0; i < CONFIG.itemCount; i++) {
                const el = document.createElement('div');
                el.className = 'item';

                const isHeading = i % 4 === 0;

                if (isHeading) {
                    const txt = document.createElement('div');
                    txt.className = 'big-text';
                    txt.innerText = TEXTS[i % TEXTS.length];
                    el.appendChild(txt);
                    items.push({
                        el, type: 'text',
                        x: 0, y: 0, rot: 0,
                        baseZ: -i * CONFIG.zGap,
                        isVisible: true
                    });
                } else {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const randId = Math.floor(Math.random() * 9999);
                    card.innerHTML = `
                        <div class="card-header">
                            <span class="card-id">ID-${randId}</span>
                            <div style="width: 10px; height: 10px; background: var(--accent);"></div>
                        </div>
                        <h2>${TEXTS[i % TEXTS.length]}</h2>
                        <div class="card-footer">
                            <span>GRID: ${Math.floor(Math.random() * 10)}x${Math.floor(Math.random() * 10)}</span>
                            <span>DATA_SIZE: ${(Math.random() * 100).toFixed(1)}MB</span>
                        </div>
                        <div style="position:absolute; bottom:2rem; right:2rem; font-size:4rem; opacity:0.1; font-weight:900;">0${i}</div>
                    `;
                    el.appendChild(card);

                    // Spiral / Chaos positioning
                    const angle = (i / CONFIG.itemCount) * Math.PI * 6;
                    const radius = 400 + Math.random() * 200;
                    const x = Math.cos(angle) * (window.innerWidth * 0.3); // More centered
                    const y = Math.sin(angle) * (window.innerHeight * 0.3);
                    const rot = (Math.random() - 0.5) * 30;

                    items.push({
                        el, type: 'card',
                        x, y, rot,
                        baseZ: -i * CONFIG.zGap,
                        isVisible: true
                    });
                }
                world.appendChild(el);
            }

            // Create Stars
            for (let i = 0; i < CONFIG.starCount; i++) {
                const el = document.createElement('div');
                el.className = 'star';
                world.appendChild(el);
                items.push({
                    el, type: 'star',
                    x: (Math.random() - 0.5) * 3000,
                    y: (Math.random() - 0.5) * 3000,
                    baseZ: -Math.random() * CONFIG.loopSize,
                    isVisible: true
                });
            }

            // Events
            window.addEventListener('mousemove', (e) => {
                state.mouseX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
                state.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
            });
        }
        init();

        // --- LENIS ---
        const lenis = new Lenis({
            smooth: true,
            lerp: 0.08, // Increased weight for heavy feel
            direction: 'vertical',
            gestureDirection: 'vertical',
            smoothTouch: true
        });

        lenis.on('scroll', ({ scroll, velocity }) => {
            state.scroll = scroll;
            state.targetSpeed = velocity;
        });

        // --- RAF LOOP ---
        const feedbackVel = document.getElementById('vel-readout');
        const feedbackFPS = document.getElementById('fps');
        let lastTime = 0;

        function raf(time) {
            lenis.raf(time);

            // FPS
            const delta = time - lastTime;
            lastTime = time;
            if (time % 10 < 1) feedbackFPS.innerText = Math.round(1000 / delta);

            // Smooth Velocity
            state.velocity += (state.targetSpeed - state.velocity) * 0.1;

            // HUD Updates
            feedbackVel.innerText = Math.abs(state.velocity).toFixed(2);
            document.getElementById('coord').innerText = `${state.scroll.toFixed(0)}`;

            // --- RENDER LOGIC ---

            // 1. Camera Tilt & Shake
            // Add slight noise based on velocity
            const shake = state.velocity * 0.2;
            const tiltX = state.mouseY * 5 - state.velocity * 0.5;
            const tiltY = state.mouseX * 5;

            world.style.transform = `
                rotateX(${tiltX}deg) 
                rotateY(${tiltY}deg)
            `;

            // 2. Dynamic Perspective (Warp)
            const baseFov = 1000;
            const fov = baseFov - Math.min(Math.abs(state.velocity) * 10, 600);
            viewport.style.perspective = `${fov}px`;

            // 3. Chromatic Aberration Simulation (simulated via global filter or just on elements)
            // Just applying a subtle shift to the body might be heavy, let's do it on text maybe?
            // Or use the scanline color offset

            // 4. Item Loop
            const cameraZ = state.scroll * CONFIG.camSpeed;

            items.forEach(item => {
                // Calculate position relative to camera
                // We want items to move TOWARDS camera (positive Z)
                // item.baseZ is negative. 

                let relZ = item.baseZ + cameraZ;

                // Infinite Wrapping modulo
                // We want relZ to be within [-loopSize, 0] relative to some viewport
                // But simplified: 
                const modC = CONFIG.loopSize;

                // Centering the repeat
                // ((relZ % modC) + modC) % modC  -> maps to [0, modC]
                // We want range [-modC + 500, 500] approx

                let vizZ = ((relZ % modC) + modC) % modC;
                if (vizZ > 500) vizZ -= modC; // Wrap back if too close/behind

                // Determine Opacity
                // Fade in at -4000, fade out at 200
                // Opacity logic
                let alpha = 1;
                if (vizZ < -3000) alpha = 0;
                else if (vizZ < -2000) alpha = (vizZ + 3000) / 1000;

                if (vizZ > 100 && item.type !== 'star') alpha = 1 - ((vizZ - 100) / 400);

                if (alpha < 0) alpha = 0;
                item.el.style.opacity = alpha;

                const isVisible = alpha > 0.01;
                if (item.isVisible !== isVisible) {
                    item.el.style.visibility = isVisible ? 'visible' : 'hidden';
                    item.isVisible = isVisible;
                }

                if (isVisible) {
                    let trans = `translate3d(${item.x}px, ${item.y}px, ${vizZ}px)`;

                    if (item.type === 'star') {
                        // Warp Stars
                        const stretch = Math.max(1, Math.min(1 + Math.abs(state.velocity) * 0.1, 10));
                        trans += ` scale3d(1, 1, ${stretch})`;
                    } else if (item.type === 'text') {
                        trans += ` rotateZ(${item.rot}deg)`;
                        // RGB Split effect on text (simulated with text-shadow)
                        if (Math.abs(state.velocity) > 1) {
                            const offset = state.velocity * 2;
                            item.el.style.textShadow = `${offset}px 0 red, ${-offset}px 0 cyan`;
                        } else {
                            item.el.style.textShadow = 'none';
                        }
                    } else {
                        // Card floats
                        const t = time * 0.001;
                        const float = Math.sin(t + item.x) * 10;
                        trans += ` rotateZ(${item.rot}deg) rotateY(${float}deg)`;
                    }

                    item.el.style.transform = trans;
                }
            });

            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);