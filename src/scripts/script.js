const DEV_MODE = false; // Set to true for development logging
const devLog = (...args) => DEV_MODE && console.log(...args);

// Local Asset Resolver (Fix for Live Server vs Vite)
const ASSET_PATH = (window.location.port === '5500' || window.location.hostname === '127.0.0.1') ? 'public/assets/' : 'assets/';

// ========== UTILITIES ==========
const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// ========== PERFORMANCE MONITOR ==========
class FrameRateMonitor {
    constructor() {
        this.fps = 60;
        this.frames = 0;
        this.lastTime = performance.now();
        this.history = [];
        this.isOptimizing = false;

        // Bind for RAF loop optimization (prevents GC allocation per frame)
        this.update = this.update.bind(this);
    }

    update() {
        const now = performance.now();
        this.frames++;

        if (now >= this.lastTime + 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastTime = now;

            this.checkPerformance();
        }

        requestAnimationFrame(this.update);
    }

    checkPerformance() {
        // Ignore during boot or if tab is hidden
        if (document.hidden || (document.querySelector('.boot-overlay') && document.querySelector('.boot-overlay').style.display !== 'none')) return;

        this.history.push(this.fps);
        if (this.history.length > 5) this.history.shift();

        const avgFps = this.history.reduce((a, b) => a + b, 0) / this.history.length;

        // CRITICAL: If FPS < 20, jump straight to LOW
        if (avgFps < 20 && performanceManager.currentPreset !== 'low') {
             console.warn('>> PERF: Critical FPS drop. Enforcing LOW mode immediately.');
             performanceManager.applyPreset('low');
             return;
        }

        // Downgrade if consistently low FPS (> 5s under 30fps)
        if (avgFps < 30 && !this.isOptimizing && performanceManager.currentPreset !== 'low') {
            this.optimize();
        }
    }

    optimize() {
        this.isOptimizing = true;
        console.warn('>> PERF: Low FPS detected. Optimizing...');

        if (typeof notificationManager !== 'undefined') {
            notificationManager.warning(
                'PERFORMANCE_PROTOCOL',
                'System overloaded. Adjusting quality settings...'
            );
        }

        // Gradual downgrade logic
        const tiers = ['ultra', 'high', 'medium', 'low'];
        const currentIndex = tiers.indexOf(performanceManager.currentPreset);
        
        if (currentIndex < tiers.length - 1) {
            const nextTier = tiers[currentIndex + 1] || 'low'; // Fallback to medium if auto or unknown
            performanceManager.applyPreset(nextTier);
        } else {
             performanceManager.applyPreset('low');
        }

        // Cooldown
        setTimeout(() => { this.isOptimizing = false; }, 10000);
    }
}

const fpsMonitor = new FrameRateMonitor();
fpsMonitor.update();

// ========== PERFORMANCE MANAGER ==========
class PerformanceManager {
    constructor() {
        this.effects = {
            matrixRain: true,
            parallax: true,
            cursorTrail: true,
            scanlines: true,
            glitch: true,
            particles: true,
            grid3d: true,
            decorations: true,
            visualizer: true
        };
        this.currentPreset = 'auto'; // auto, ultra, high, medium, low
        this.hardware = {
            cores: navigator.hardwareConcurrency || 4,
            memory: navigator.deviceMemory || 4,
            gpu: 'unknown',
            tier: 'high' // ultra, high, medium, low
        };
        this.matrixRainInstance = null;
        this.parallaxInstance = null;
        this.cursorInstance = null;
        this.terminalInstance = null;
        // Fix: Store the result of detectHardware in this.hardware
        this.hardware = { ...this.hardware, ...this.detectHardware() };
    }

    detectHardware() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const cores = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 4;
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const effectiveType = connection ? connection.effectiveType : '4g';
        
        // Battery API (if available)
        let batteryLevel = 1;
        let isCharging = true;
        
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                batteryLevel = battery.level;
                isCharging = battery.charging;
            });
        }
        
        // Calculate performance score (0-100)
        let score = 40; // Reduced Base score (was 50) to be more conservative

        if (isMobile) {
            score -= 30; // Increased penalty for mobile (was 25)
            // Critical check for low-end mobile specific keywords
            if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                // Check if device memory is low or screen is small/dense
                if ((memory && memory < 4) || (window.devicePixelRatio > 2 && window.screen.width < 400)) {
                     score -= 20; // Massive penalty for high-DPI small screens (very GPU intensive)
                }
            }
        }

        // CPU Scoring: Budget phones often have 8 cores but low IPC.
        // Reduce weight: +2.5 per core instead of +5
        score += Math.min(cores * 2.5, 20);

        // RAM Scoring: 4GB is now minimum for smooth WebGL.
        // Increase weight slightly but cap logic remains
        score += Math.min(memory * 4, 20);
        
        if (effectiveType === '4g') score += 10;
        else if (effectiveType === '3g') score -= 5; // Penalty for 3G
        else if (effectiveType === 'slow-2g' || effectiveType === '2g') score -= 20; // Heavy penalty
        
        // Penalize iOS devices that report low cores due to privacy
        if (isMobile && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
            // Assume modern iOS is at least medium, but don't let it hit ultra easily due to thermal throttling concerns
            if (score > 60) score = Math.min(score, 75);
            // Boost score slightly for iOS if it dropped too low due to core masking
            if (score < 40) score = 45;
        }

        score = Math.max(0, Math.min(100, score));
        
        return {
            isMobile,
            cores,
            memory,
            connection: effectiveType,
            batteryLevel,
            isCharging,
            score,
            tier: this.getPerformanceTier(score)
        };
    }

    getPerformanceTier(score) {
        // Stricter thresholds for dynamic performance
        if (score >= 85) return 'ultra'; 
        if (score >= 70) return 'high';  // Was 65
        if (score >= 55) return 'medium';// Was 45
        return 'low'; // < 55 is low (more inclusive for devices like A32)
    }

    applyPreset(preset) {
        // --- MOBILE OPTIMIZATION: STRICT ENFORCEMENT ---
        // If device is mobile and truly low-perf, disable high-end presets even if user clicks them.
        if (this.hardware.isMobile && (this.hardware.tier === 'low' || this.hardware.score < 50)) {
            if (preset !== 'low') {
                console.warn('>> PERF: Blocked high-end preset on low-end mobile. Forcing LOW.');
                preset = 'low';
                // Show notification to user? Maybe too intrusive.
            }
        }

        this.currentPreset = preset;
        
        // --- MOBILE OPTIMIZATION: DOUBLE IF LOGIC ---
        const isLowPerf = preset === 'low' || (preset === 'auto' && this.hardware.tier === 'low');
        const isMobile = this.hardware.isMobile;

        if (isLowPerf || isMobile) {
             document.body.classList.add('mobile-low-perf');
             devLog('>> PERF: Mobile/Low-End mode active. Deferred body rendering engaged.');
        } else {
             document.body.classList.remove('mobile-low-perf');
        }
        
        const presets = {
            auto: this.hardware.tier,
            ultra: {
                matrixRain: true,
                parallax: true,
                cursorTrail: true,
                scanlines: true,
                glitch: true,
                particles: true,
                grid3d: true,
                decorations: true,
                visualizer: true
            },
            high: {
                matrixRain: true,
                parallax: true,
                cursorTrail: false, 
                scanlines: true,
                glitch: false, 
                particles: false,
                grid3d: true,
                decorations: true,
                visualizer: true
            },
            medium: {
                matrixRain: !this.hardware.isMobile,
                parallax: true,
                cursorTrail: false,
                scanlines: true,
                glitch: false,
                particles: false,
                grid3d: true,
                decorations: false,
                visualizer: true
            },
            low: {
                matrixRain: false,
                parallax: false,
                cursorTrail: false,
                scanlines: false,
                glitch: false,
                particles: false,
                grid3d: false,
                decorations: false,
                visualizer: false
            }
        };

        // LÓGICA NUEVA: Inyectar clase al body para control total CSS
        if (isLowPerf) {
            document.body.classList.add('performance-mode-low');
            document.body.classList.add('no-scanlines'); 
            document.body.classList.add('no-glitch'); 
            this.toggleParticles(false); 
        } else {
            document.body.classList.remove('performance-mode-low');
            document.body.classList.remove('no-scanlines');
            document.body.classList.remove('no-glitch');
        }
        
        const targetPreset = preset === 'auto' ? presets[this.hardware.tier] : presets[preset];
        
        Object.keys(targetPreset).forEach(effect => {
            this.effects[effect] = targetPreset[effect];
            this.toggleEffect(effect, targetPreset[effect], false);
        });
        
        // Save to localStorage
        this.savePreferences();
        
        devLog(`Performance preset applied: ${preset} (tier: ${this.hardware.tier})`);
    }

    toggleEffect(effectName, state = null, save = true) {
        const newState = state !== null ? state : !this.effects[effectName];
        this.effects[effectName] = newState;
        
        switch(effectName) {
            case 'matrixRain':
                this.toggleMatrixRain(newState);
                break;
            case 'parallax':
                this.toggleParallax(newState);
                break;
            case 'cursorTrail':
                this.toggleCursorTrail(newState);
                break;
            case 'scanlines':
                this.toggleScanlines(newState);
                break;
            case 'glitch':
                this.toggleGlitch(newState);
                break;
            case 'particles':
                this.toggleParticles(newState);
                break;
            case 'grid3d':
                this.toggleGrid3D(newState);
                break;
            case 'decorations':
                this.toggleDecorations(newState);
                break;
            case 'visualizer':
                this.toggleVisualizer(newState);
                break;
        }
        
        if (save) this.savePreferences();
        this.updateUI(effectName, newState);
    }

    toggleMatrixRain(enable) {
        if (enable && this.matrixRainInstance) {
            this.matrixRainInstance.start();
        } else if (!enable && this.matrixRainInstance) {
            this.matrixRainInstance.stop();
        }
    }

    toggleParallax(enable) {
        const layers = document.querySelectorAll('.parallax-layer');
        layers.forEach(layer => {
            layer.style.display = enable ? 'block' : 'none';
        });

        if (enable && this.parallaxInstance) {
            this.parallaxInstance.requestTick();
        }
    }

    toggleCursorTrail(enable) {
        const canvas = document.getElementById('cursorCanvas');
        if (canvas) {
            canvas.style.display = enable ? 'block' : 'none';
        }
        
        if (this.cursorInstance) {
            if (enable) this.cursorInstance.start();
            else this.cursorInstance.stop();
        }

        if (!enable) {
            document.body.style.cursor = 'auto';
            // Forzamos cursor pointer en elementos interactivos
            document.documentElement.style.setProperty('--cursor-type', 'auto');
            // Agrega esto a tu CSS global: a, button { cursor: pointer !important; } cuando esté desactivado
            const style = document.createElement('style');
            style.id = 'cursor-fix';
            style.innerHTML = `* { cursor: auto !important; } a, button, .link-block { cursor: pointer !important; }`;
            if(!document.getElementById('cursor-fix')) document.head.appendChild(style);
        } else {
            document.body.style.cursor = 'none';
            const fix = document.getElementById('cursor-fix');
            if(fix) fix.remove();
        }
    }

    toggleScanlines(enable) {
        document.body.classList.toggle('no-scanlines', !enable);
    }

    toggleGlitch(enable) {
        document.body.classList.toggle('no-glitch', !enable);
    }

    toggleParticles(enable) {
        const particles = document.querySelectorAll('.parallax-shape, .geo-elements, #particle_container, .particle-container');
        particles.forEach(particle => {
            particle.style.display = enable ? 'block' : 'none';
        });
    }


    toggleGrid3D(enable) {
        const grid = document.querySelector('.grid-3d');
        if (grid) {
            grid.style.display = enable ? 'block' : 'none';
        }
    }

    toggleDecorations(enable) {
        const decals = document.querySelector('.tech-decals');
        const stickers = document.querySelector('.decal-layer');
        const proceduralTech = document.querySelector('.procedural-tech-layer');

        if (decals) decals.style.display = enable ? 'block' : 'none';
        if (stickers) stickers.style.display = enable ? 'block' : 'none';
        if (proceduralTech) proceduralTech.style.display = enable ? 'block' : 'none';
    }

    toggleVisualizer(enable) {
        const vizBlock = document.querySelector('.visualizer-block');
        if (vizBlock) {
            vizBlock.style.display = enable ? 'flex' : 'none';
        }
        
        // Find the visualizer instance (it's global 'audioVisualizer' or attached to manager)
        if (typeof audioVisualizer !== 'undefined') {
            if (enable) audioVisualizer.start();
            else audioVisualizer.stop();
        }
    }

    updateUI(effectName, state) {
        const statusMap = {
            matrixRain: 'matrixStatus',
            parallax: 'parallaxStatus',
            cursorTrail: 'cursorStatus',
            scanlines: 'scanlineStatus',
            glitch: 'glitchStatus',
            particles: 'particlesStatus',
            particles: 'particlesStatus',
            grid3d: 'gridStatus',
            decorations: 'decorStatus',
            visualizer: 'vizStatus'
        };
        
        const statusEl = document.getElementById(statusMap[effectName]);
        if (statusEl) {
            statusEl.textContent = state ? 'ON' : 'OFF';
            statusEl.classList.toggle('off', !state);
        }
        
        const toggleBtn = document.querySelector(`[data-effect="${effectName}"]`);
        if (toggleBtn) {
            toggleBtn.setAttribute('data-state', state ? 'on' : 'off');
        }
    }

    updateAllUI() {
        Object.keys(this.effects).forEach(effect => {
            this.updateUI(effect, this.effects[effect]);
        });
        
        // Update preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === this.currentPreset);
        });
        
        // Update hardware info
        this.updateHardwareInfo();
    }

    updateHardwareInfo() {
        const infoEl = document.getElementById('hardwareInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <div class="hardware-info-line">
                    <span class="hardware-info-label">Device:</span>
                    <span class="hardware-info-value">${this.hardware.isMobile ? 'MOBILE' : 'DESKTOP'}</span>
                </div>
                <div class="hardware-info-line">
                    <span class="hardware-info-label">CPU Cores:</span>
                    <span class="hardware-info-value">${this.hardware.cores}</span>
                </div>
                <div class="hardware-info-line">
                    <span class="hardware-info-label">RAM:</span>
                    <span class="hardware-info-value">${this.hardware.memory}GB</span>
                </div>
                <div class="hardware-info-line">
                    <span class="hardware-info-label">Performance:</span>
                    <span class="hardware-info-value">${this.hardware.tier.toUpperCase()} (${this.hardware.score}/100)</span>
                </div>
            `;
        }
    }

    savePreferences() {
        localStorage.setItem('performancePreset', this.currentPreset);
        localStorage.setItem('performanceEffects', JSON.stringify(this.effects));
    }

    loadPreferences() {
        const savedPreset = localStorage.getItem('performancePreset');
        const savedEffects = localStorage.getItem('performanceEffects');
        
        if (savedPreset) {
            this.currentPreset = savedPreset;
        }
        
        if (savedEffects) {
            try {
                const effects = JSON.parse(savedEffects);
                this.effects = { ...this.effects, ...effects };
            } catch (e) {
                devLog('Error loading saved effects:', e);
            }
        }
    }

    init() {
        this.loadPreferences();

        // STRICT ENFORCEMENT: If device is actually Low Tier (especially mobile), force 'low' preset
        // irrespective of what might have been saved in localStorage previously, to ensure usability.
        if (this.hardware.tier === 'low' || (this.hardware.isMobile && this.hardware.score < 50)) {
            console.warn('>> PERF: Low-end device detected. Forcing LOW preset.');
            this.currentPreset = 'low';
            this.applyPreset('low');
            // We do NOT save this forced preset to localStorage to avoid locking them forever if they upgrade device, 
            // but for this session it is enforced. 
            // Actually, for "obligatorily has to use", we just apply it.
        } else if (!localStorage.getItem('performancePreset')) {
             // If no saved preferences, apply auto preset
            this.applyPreset('auto');
        } else {
             // Apply saved effects (but we already loaded them in loadPreferences, just need to apply)
            // If the saved preset was 'custom', we need to apply individual effects.
            // If it was a named preset, apply that.
            if (this.currentPreset !== 'custom') {
                 this.applyPreset(this.currentPreset);
            } else {
                 // Apply saved effects for custom
                Object.keys(this.effects).forEach(effect => {
                    this.toggleEffect(effect, this.effects[effect], false);
                });
            }
        }
        
        // Setup UI event listeners
        this.setupEventListeners();
        this.updateAllUI();
        
        devLog('PerformanceManager initialized:', this.hardware);
    }

    setupEventListeners() {
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyPreset(btn.dataset.preset);
                this.updateAllUI();
            });
        });
        
        // Effect toggles
        document.querySelectorAll('.effect-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const effect = btn.dataset.effect;
                
                // If we were in low mode, clean up restrictive classes
                if (this.currentPreset === 'low' || document.body.classList.contains('performance-mode-low')) {
                    document.body.classList.remove('performance-mode-low');
                    document.body.classList.remove('no-scanlines');
                }
                
                this.toggleEffect(effect);
                this.currentPreset = 'custom';
                this.savePreferences();
                this.updateAllUI();
            });
        });
    }

    // Method to register effect instances
    registerEffect(name, instance) {
        if (name === 'matrixRain') this.matrixRainInstance = instance;
        if (name === 'parallax') this.parallaxInstance = instance;
        if (name === 'cursor') this.cursorInstance = instance;

    }
}

// Global instance
const performanceManager = new PerformanceManager();

// ========== AUDIO MANAGER ==========
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.enabled = false;
        this.sounds = {};
        this.bgMusic = null;
        this.mediaSource = null;
        this.analyserNode = null;
        
        // Performance optimization: Bind playHover once
        this.boundPlayHover = this.playHover.bind(this);

        // Audio file paths
        this.audioFiles = {
            background: ASSET_PATH + 'audio/background.mp3'
        };
        
        // Safety for async race conditions
        this.playPromise = null;
    }

    async init() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.enabled = true;
                console.log('%c>> AUDIO SYSTEM: INITIALIZED ✓', 'color: #39FF14; font-family: monospace;');
            } catch (e) {
                console.error('>> AUDIO SYSTEM: Failed to initialize', e);
                return;
            }
        }
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('%c>> AUDIO SYSTEM: RESUMED ✓', 'color: #39FF14; font-family: monospace;');
        }
    }

    playSound(soundName, volume = 1.0, loop = false) {
        // Auto-init on first sound if possible (gesture required)
        if (!this.audioContext) this.init();
        if (!this.enabled) return;
        
        // Para file:// usamos Audio directo en lugar de AudioBuffer
        try {
            const audio = new Audio(this.audioFiles[soundName]);
            audio.volume = volume;
            audio.loop = loop;
            audio.play().catch(() => {
                // Fallback silencioso si falla
                this.synthesizeSound(soundName, volume);
            });
        } catch (error) {
            // Fallback a sonidos sintetizados
            this.synthesizeSound(soundName, volume);
        }
    }

    synthesizeSound(soundName, volume) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Different frequencies for different sounds
        const frequencies = {
            click: 800,
            hover: 600,
            boot: 400,
            glitch: 200,
            success: 1000
        };
        
        oscillator.frequency.value = frequencies[soundName] || 500;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    async playBackgroundMusic(volume = 0.3) {
        if (!this.audioContext) await this.init();
        
        if (!this.enabled) {
            console.log('%c>> MUSIC: System disabled', 'color: #FF6B6B; font-family: monospace;');
            return;
        }
        
        // Stop existing music if any
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic = null;
        }
        
        console.log('%c>> MUSIC: Creating audio element...', 'color: #00FFFF; font-family: monospace;');
        
        this.bgMusic = new Audio(this.audioFiles.background);
        this.bgMusic.volume = volume;
        this.bgMusic.loop = true;
        this.bgMusic.preload = 'auto';
        
        // Setup analyser for visualizer (only once)
        if (!this.mediaSource && this.audioContext) {
            try {
                this.mediaSource = this.audioContext.createMediaElementSource(this.bgMusic);
                this.analyserNode = this.audioContext.createAnalyser();
                this.analyserNode.fftSize = 512;
                
                this.mediaSource.connect(this.analyserNode);
                this.analyserNode.connect(this.audioContext.destination);
                console.log('%c>> AUDIO: Visualizer connected ✓', 'color: #39FF14; font-family: monospace;');

                // Ensure visualizer is initialized with this analyser if visualizer exists and DOM is ready
                try {
                    if (typeof audioVisualizer !== 'undefined' && audioVisualizer && typeof audioVisualizer.init === 'function') {
                        audioVisualizer.init(this);
                    }
                } catch (e) {
                    console.warn('>> AUDIO: audioVisualizer.init() failed:', e);
                }
            } catch (error) {
                console.log('%c>> AUDIO: Visualizer error: ' + error.message, 'color: #FF6B6B; font-family: monospace;');
            }
        }
        
        // Add event listeners for debugging
        this.bgMusic.addEventListener('loadeddata', () => {
            console.log('%c>> MUSIC: Audio loaded (duration: ' + this.bgMusic.duration + 's)', 'color: #39FF14; font-family: monospace;');
        });
        
        this.bgMusic.addEventListener('error', (e) => {
            console.log('%c>> MUSIC: Load error - ' + e.target.error.message, 'color: #FF6B6B; font-family: monospace;');
        });
        
        // Attempt to play
        console.log('%c>> MUSIC: Attempting to play...', 'color: #00FFFF; font-family: monospace;');
        this.playPromise = this.bgMusic.play();
        
        if (this.playPromise !== undefined) {
            this.playPromise.then(() => {
                this.playPromise = null;
                console.log('%c>> MUSIC: ♫ Playing! Volume: ' + (volume * 100).toFixed(0) + '%', 'color: #39FF14; font-family: monospace;');
            }).catch(error => {
                this.playPromise = null;
                console.log('%c>> MUSIC: Play blocked - ' + error.message, 'color: #FF6B6B; font-family: monospace;');
                console.log('%c>> MUSIC: User interaction may be required', 'color: #FFAA00; font-family: monospace;');
            });
        }
    }

    async stopBackgroundMusic() {
        if (this.playPromise) {
            await this.playPromise;
        }
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
            console.log('%c>> MUSIC: Stopped', 'color: #FF6B6B; font-family: monospace;');
        }
    }
    
    setVolume(volume) {
        if (this.bgMusic) {
            this.bgMusic.volume = Math.max(0, Math.min(1, volume));
        }
    }

    // Shortcut methods
    playClick() { this.playSound('click', 0.5); }
    playHover() { this.playSound('hover', 0.2); }
    playBoot() { this.playSound('boot', 0.6); }
    playGlitch() { this.playSound('glitch', 0.4); }
    playSuccess() { this.playSound('success', 0.5); }
    playTyping() {
        // Randomized pitch for realistic typing
        const pitch = 0.8 + Math.random() * 0.4;
        this.playSound('click', 0.3); // Reusing click as typing sound for now, usually short
    }

    addHoverListeners(root) {
        const selector = 'a, button, input, textarea, .project-card, .filter-btn';

        // Helper to attach listener safely
        const attach = (el) => {
            el.removeEventListener('mouseenter', this.boundPlayHover);
            el.addEventListener('mouseenter', this.boundPlayHover);
        };

        // If the root element itself matches
        if (root.matches && root.matches(selector)) {
            attach(root);
        }

        // Find all matching children
        if (root.querySelectorAll) {
            root.querySelectorAll(selector).forEach(attach);
        }
    }

    attachGlobalListeners() {
        // Universal Hover - Optimized with MutationObserver and direct listeners
        this.addHoverListeners(document);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element
                        this.addHoverListeners(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Typing Sound Generators
        const typingInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea, .terminal-input');

        // Delegate for dynamic elements (like terminal)
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea')) {
                this.playTyping();
            }
        });
    }
}

const audioManager = new AudioManager();

// Attach sounds after init
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        audioManager.attachGlobalListeners();
    }, 1000);
});

// ========== HYPER SCROLL INTRO ==========
// ========== HYPER SCROLL INTRO ==========
class HyperScrollIntro {
    constructor() {
        // Detect performance and device characteristics
        const isMobile = performanceManager.detectHardware().isMobile;
        const tier = performanceManager.hardware.tier;
        const isLowPerf = tier === 'low' || tier === 'medium';
        
        // HYPER mode only for PC/High-end devices
        this.isHyperEnabled = !isMobile || (tier === 'ultra' || tier === 'high');

        this.config = {
            isLowSpec: isLowPerf && isMobile,
            itemCount: isLowPerf ? 12 : 20, 
            starCount: isLowPerf ? 50 : 150,
            zGap: 800,
            camSpeed: 2.5,
            loopSize: 0,
            colors: ['#ff003c', '#00f3ff', '#ccff00', '#ffffff'] // User colors
        };
        this.config.loopSize = this.config.itemCount * this.config.zGap;
        
        // Use user's preferred texts with a brand touch
        this.texts = ["KAITOARTZ", "IMPACT", "VELOCITY", "BRUTAL", "SYSTEM", "FUTURE", "DESIGN", "PIXEL", "HYPER", "NEON", "VOID"];
        
        this.state = {
            scroll: 0,
            velocity: 0,
            targetSpeed: 0,
            mouseX: 0,
            mouseY: 0,
            targetMouseX: 0,
            targetMouseY: 0,
            active: true,
            warping: false,
            fading: false
        };

        this.items = [];
        this.rafId = null;
        this.frameCount = 0;
        this.lenis = null;
        this.perfMode = 0; // 0: Normal, 1: No Stars
        
        // Performance: Cache dimensions
        this.winW = window.innerWidth;
        this.winH = window.innerHeight;
    }

    init() {
        const layer = document.getElementById('hyper-intro-layer');
        if (!layer) return;

        this.world = document.getElementById('intro-world');
        this.viewport = document.getElementById('intro-viewport');
        
        document.body.classList.add('no-scroll');
        document.documentElement.classList.add('no-scroll');
        
        // VIRTUAL MODE: Hide the scroll proxy to remove scrollbar
        const proxy = layer.querySelector('.intro-scroll-proxy');
        if (proxy && this.isVirtualMode) {
            proxy.style.display = 'none';
        }

        this.createWorld();
        this.initLenis();
        this.bindEvents();
        
        // HUD Setup
        this.feedbackVel = document.getElementById('intro-vel-readout');
        this.feedbackFPS = document.getElementById('intro-fps');
        this.feedbackCoord = document.getElementById('intro-coord');

        this.startLoop();
        
        console.log(`%c>> HYPER INTRO: SYSTEM ONLINE (HYPER: ${this.isHyperEnabled})`, 'color: #E2FF00; font-family: monospace;');
    }

    createWorld() {
        if (!this.world) return;
        
        // Create Items (Logic from User)
        for (let i = 0; i < this.config.itemCount; i++) {
            const el = document.createElement('div');
            el.className = 'intro-item';

            const isHeading = i % 4 === 0;

            if (isHeading) {
                const txt = document.createElement('div');
                txt.className = 'intro-big-text';
                txt.innerText = this.texts[i % this.texts.length];
                el.appendChild(txt);
                this.items.push({
                    el, type: 'text',
                    x: 0, y: 0, rot: 0,
                    baseZ: -i * this.config.zGap,
                    currentAlpha: -1,
                    currentTrans: null
                });
            } else {
                const card = document.createElement('div');
                card.className = 'intro-card';
                const randId = Math.floor(Math.random() * 9999);
                card.innerHTML = `
                    <div class="intro-card-header">
                        <span class="intro-card-id">ID-${randId}</span>
                        <div style="width: 10px; height: 10px; background: var(--intro-accent);"></div>
                    </div>
                    <h2>${this.texts[i % this.texts.length]}</h2>
                    <div class="intro-card-footer">
                        <span>GRID: ${Math.floor(Math.random() * 10)}x${Math.floor(Math.random() * 10)}</span>
                        <span>DATA_SIZE: ${(Math.random() * 100).toFixed(1)}MB</span>
                    </div>
                    <div style="position:absolute; bottom:2rem; right:2rem; font-size:4rem; opacity:0.1; font-weight:900;">0${i}</div>
                `;
                el.appendChild(card);

                // Spiral / Chaos positioning (User logic)
                const angle = (i / this.config.itemCount) * Math.PI * 6;
                const radius = 400 + Math.random() * 200;
                const x = Math.cos(angle) * (this.winW * 0.3);
                const y = Math.sin(angle) * (this.winH * 0.3);
                const rot = (Math.random() - 0.5) * 30;

                this.items.push({
                    el, type: 'card',
                    x, y, rot,
                    baseZ: -i * this.config.zGap,
                    currentAlpha: -1,
                    currentTrans: null
                });
            }
            this.world.appendChild(el);
        }

        // Create Stars
        for (let i = 0; i < this.config.starCount; i++) {
            const el = document.createElement('div');
            el.className = 'intro-star';
            this.world.appendChild(el);
            this.items.push({
                el, type: 'star',
                x: (Math.random() - 0.5) * 3000,
                y: (Math.random() - 0.5) * 3000,
                baseZ: -Math.random() * this.config.loopSize,
                currentAlpha: -1,
                currentTrans: null
            });
        }
    }

    initLenis() {
        const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const tier = performanceManager.hardware.tier;
        const isLowPerf = tier === 'low' || tier === 'medium';
        
        // VIRTUAL MODE: PC or High-performance devices
        // PHYSICAL MODE: Only for Mobile or Low-performance browsers
        this.isVirtualMode = !isMobileBrowser && (tier === 'ultra' || tier === 'high');

        if (!this.isVirtualMode) {
            // PHYSICAL MODE: USamos Lenis con scroll real
            if (typeof Lenis !== 'undefined') {
                this.lenis = new Lenis({
                    smooth: true,
                    lerp: 0.08,
                    direction: 'vertical',
                    gestureDirection: 'vertical',
                    smoothTouch: true,
                    touchMultiplier: 2,
                });

                this.lenis.on('scroll', ({ scroll, velocity }) => {
                    if (!this.state.warping && this.state.active) {
                        this.state.scroll = scroll;
                        this.state.targetSpeed = velocity;
                    }
                });
            } else {
                // Mobile Fallback: Use manual scroll listener
                window.addEventListener('scroll', () => {
                    if (this.state.active && !this.state.warping) {
                        const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
                        this.state.targetSpeed = (scrollPos - this.state.scroll) * 0.5;
                        this.state.scroll = scrollPos;
                    }
                }, { passive: true });
            }
        } else {
            // VIRTUAL MODE: No instantiation of Lenis or Scroll Listeners on window
            console.log('>> HYPER INTRO: VIRTUAL SCROLL ACTIVE');
        }
    }

    bindEvents() {
        this.handleMouseMove = (e) => {
            if (!this.state.active) return;
            this.state.targetMouseX = (e.clientX / this.winW - 0.5) * 2;
            this.state.targetMouseY = (e.clientY / this.winH - 0.5) * 2;
        };
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });

        this.handleTouch = (e) => {
            if (!this.state.active || !e.touches.length) return;
            const touch = e.touches[0];
            this.state.targetMouseX = (touch.clientX / this.winW - 0.5) * 2;
            this.state.targetMouseY = (touch.clientY / this.winH - 0.5) * 2;
        };
        window.addEventListener('touchstart', this.handleTouch, { passive: true });
        window.addEventListener('touchmove', this.handleTouch, { passive: true });
        
        // Reset position on release for mobile/terminal feel
        const resetPos = () => {
            this.state.targetMouseX = 0;
            this.state.targetMouseY = 0;
        };
        window.addEventListener('touchend', resetPos, { passive: true });
        window.addEventListener('touchcancel', resetPos, { passive: true });
        window.addEventListener('mouseleave', resetPos, { passive: true });

        // VIRTUAL SCROLL: Only for PC/High-end
        if (this.isVirtualMode) {
            this.handleWheel = (e) => {
                if (!this.state.active || this.state.warping) return;
                // Accumulate target speed based on wheel delta (Speed increased as requested)
                this.state.targetSpeed += e.deltaY * 0.12; 
                // Clamp target speed to prevent insane values
                this.state.targetSpeed = Math.max(-150, Math.min(150, this.state.targetSpeed));
            };
            window.addEventListener('wheel', this.handleWheel, { passive: false });
        }
        
        this.handleResize = debounce(() => {
            this.winW = window.innerWidth;
            this.winH = window.innerHeight;
            this.config.loopSize = this.config.itemCount * this.config.zGap;
        }, 200);
        window.addEventListener('resize', this.handleResize, { passive: true });

        const enterBtn = document.getElementById('enterSystemBtn');
        if (enterBtn) enterBtn.addEventListener('click', () => this.warpAndEnter());    }

    async warpAndEnter() {
        if (this.state.warping) return;
        this.state.warping = true;
        
        await audioManager.init();
        audioManager.playBoot();
        audioManager.playBackgroundMusic();
        
        const btn = document.getElementById('enterSystemBtn');
        if(btn) {
            btn.innerText = "ACCESSING...";
            btn.style.borderColor = "#fff";
            btn.style.color = "#fff";
        }

        // Sync content for smoother reveal
        const bodyContent = document.getElementById('body-content');
        if (bodyContent) {
            document.body.classList.add('preparing-system');
            void bodyContent.offsetHeight; 
        }
    }

    startLoop() {
        let lastTime = 0;

        const loop = (time) => {
            if (!this.state.active) return;
            
            this.rafId = requestAnimationFrame(loop);
            this.frameCount++;
            
            if (this.lenis) this.lenis.raf(time);

            const delta = time - lastTime;
            lastTime = time;
            // Use deterministic frame count instead of erratic time check
            const fps = Math.round(1000 / delta) || 60;
            
            // HUD Updates Throttled
            if (this.frameCount % 10 === 0) {
                if (this.feedbackFPS) this.feedbackFPS.innerText = fps;
                if (this.feedbackVel) this.feedbackVel.innerText = Math.abs(this.state.velocity).toFixed(2);
                if (this.feedbackCoord) {
                    this.feedbackCoord.innerText = this.isVirtualMode ? "∞" : this.state.scroll.toFixed(0);
                }
            }

            // Adaptive Degrade Logic (Wait 2s at start before judging)
            if (time > 2000 && this.perfMode < 1) {
                if (fps < 30) {
                    this.perfMode = 1;
                    // Optimized: Use cached items array instead of DOM query
                    this.items.forEach(item => {
                        if (item.type === 'star') item.el.style.display = 'none';
                    });
                    console.warn('>> PERF: Adaptive degrade triggered. Stars disabled.');
                }
            }

            // Warp Logic
            if (this.state.warping) {
                this.state.targetSpeed = 150;
                this.state.scroll += this.state.velocity * 0.5;
                if (Math.abs(this.state.velocity) > 100 && !this.state.fading) {
                    this.state.fading = true;
                    setTimeout(() => this.endIntro(), this.config.isLowSpec ? 500 : 1000);
                }
            }

            // Smooth Velocity (0.1 weight as requested by user)
            this.state.velocity += (this.state.targetSpeed - this.state.velocity) * 0.1;
            
            // Smooth Camera Movement (Lerp)
            this.state.mouseX += (this.state.targetMouseX - this.state.mouseX) * 0.08;
            this.state.mouseY += (this.state.targetMouseY - this.state.mouseY) * 0.08;

            // Apply decay in Virtual Mode so it eventually stops
            if (this.isVirtualMode) {
                this.state.targetSpeed *= 0.95;
                this.state.scroll += this.state.velocity * 0.5; // Infinite accumulation
            }

            // --- RENDER LOGIC ---

            // 1. Camera Tilt & Shake (Modified from User Snippet)
            if (this.world) {
                const shake = this.state.velocity * 0.1; 
                // Enable tilt for mobile too (Relaxed isHyperEnabled check)
                const tiltScale = this.isHyperEnabled ? 5 : 4; 
                const tiltX = (this.state.mouseY * tiltScale - this.state.velocity * 0.2);
                const tiltY = (this.state.mouseX * tiltScale);

                this.world.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            }

            // 2. Dynamic Perspective (Warp)
            if (this.viewport && this.isHyperEnabled) {
                const baseFov = 1000;
                const fov = baseFov - Math.min(Math.abs(this.state.velocity) * 5, 800);
                this.viewport.style.perspective = `${fov}px`;
            }

            // 3. Item Loop (Optimized Infinite Scroll)
            const cameraZ = this.state.scroll * this.config.camSpeed;
            const modC = this.config.loopSize;

            this.items.forEach(item => {
                let relZ = item.baseZ + cameraZ;
                let vizZ = ((relZ % modC) + modC) % modC;
                if (vizZ > 500) vizZ -= modC;

                // Opacity Calculation
                let alpha = 1;
                if (vizZ < -3000) alpha = 0;
                else if (vizZ < -2000) alpha = (vizZ + 3000) / 1000;
                if (vizZ > 100 && item.type !== 'star') alpha = 1 - ((vizZ - 100) / 400);
                if (alpha < 0) alpha = 0;
                
                if (Math.abs(item.currentAlpha - alpha) > 0.001) {
                    item.el.style.opacity = alpha;
                    item.currentAlpha = alpha;
                    if (this.config.isLowSpec) item.el.style.display = alpha <= 0 ? 'none' : 'flex';
                }

                if (alpha > 0) {
                    let trans = `translate3d(${item.x}px, ${item.y}px, ${vizZ}px)`;

                    if (item.type === 'star') {
                        const stretch = Math.max(1, Math.min(1 + Math.abs(this.state.velocity) * 0.1, 20));
                        trans += ` scale3d(1, 1, ${stretch})`;
                    } else if (item.type === 'text') {
                        trans += ` rotateZ(${item.rot}deg)`;
                        // RGB Split effect (Hyper ONLY)
                        if (this.isHyperEnabled && Math.abs(this.state.velocity) > 1) {
                            const offset = this.state.velocity * 1.5;
                            item.el.style.textShadow = `${offset}px 0 var(--intro-glitch-1), ${-offset}px 0 var(--intro-glitch-2)`;
                        } else {
                            item.el.style.textShadow = 'none';
                        }
                    } else {
                        // Card Logic
                        if (this.isHyperEnabled) {
                            // AUTO-ANIMATION: Trigger .is-active when card is in focus range
                            const cardEl = item.el.querySelector('.intro-card');
                            if (cardEl) {
                                const isInFocus = vizZ > -400 && vizZ < 400;
                                cardEl.classList.toggle('is-active', isInFocus);
                            }

                            const t = time * 0.001;
                            const float = Math.sin(t + item.x) * 10;
                            trans += ` rotateZ(${item.rot}deg) rotateY(${float}deg)`;
                        } else {
                            trans += ` rotateZ(${item.rot}deg)`;
                        }
                    }

                    if (item.currentTrans !== trans) {
                        item.el.style.transform = trans;
                        item.currentTrans = trans;
                    }
                }
            });
        };
        
        requestAnimationFrame(loop);
    }

    endIntro(isFast = false) {
        const layer = document.getElementById('hyper-intro-layer');
        if (layer) {
            if (!isFast) {
                const isLowSpec = this.config.isLowSpec;
                layer.style.transition = isLowSpec ? "opacity 0.5s ease-out" : "opacity 0.8s ease-out, filter 0.8s ease-out";
                layer.style.opacity = 0;
                if (!isLowSpec) layer.style.filter = "brightness(2) blur(10px)";
            }
            
            const waitTime = isFast ? 250 : 800;
            
            setTimeout(() => {
                layer.style.display = 'none';
                this.state.active = false;
                if (this.lenis) this.lenis.destroy();
                
                this.cleanup();

                document.body.classList.add('system-ready');
                document.body.classList.remove('preparing-system', 'no-scroll');
                document.documentElement.classList.remove('no-scroll');

                window.scrollTo(0, 0);
                
                const main = document.querySelector('main');
                if(main) {
                    main.style.animation = isFast ? "fadeIn 0.4s ease forwards" : "fadeIn 1s ease forwards";
                }

                if (typeof matrixRain !== 'undefined' && performanceManager.effects.matrixRain) {
                     matrixRain.start(true);
                }
            }, waitTime);
        }
    }

    cleanup() {
        if (this.handleMouseMove) window.removeEventListener('mousemove', this.handleMouseMove);
        if (this.handleTouch) {
            window.removeEventListener('touchstart', this.handleTouch);
            window.removeEventListener('touchmove', this.handleTouch);
        }
        if (this.handleResize) window.removeEventListener('resize', this.handleResize);
        if (this.handleWheel) window.removeEventListener('wheel', this.handleWheel);
    }
}

// Instantiate Global
const hyperIntro = new HyperScrollIntro();

document.addEventListener('DOMContentLoaded', () => {
    // Start the Hyper Scroll Intro
    hyperIntro.init();
});

// ========== BOOT SEQUENCE ==========
// ========== BOOT SEQUENCE ==========
// ========== BOOT SEQUENCE ==========
function startBootSequence() {
    console.log('%c>> BOOT: Starting sequence', 'color: #00FFFF; font-family: monospace;');
    
    const loadProgress = document.getElementById('loadProgress');
    const bootLoaderBar = document.getElementById('bootLoaderBar');
    const bootLog = document.getElementById('bootLog');
    const bootOverlay = document.querySelector('.boot-overlay');
    const dashboard = document.querySelector('.dashboard');
    
    if (!loadProgress || !bootLoaderBar || !bootLog || !bootOverlay || !dashboard) {
        console.error('Boot elements not found!');
        return;
    }
    
    // Boot Log Messages
    const bootLogs = [
        { text: '> INITIALIZING KERNEL...', type: 'system', delay: 100 },
        { text: '> CHECKING MEMORY INTEGRITY... OK', type: 'normal', delay: 400 },
        { text: '> LOADING NEURAL INTERFACE...', type: 'normal', delay: 800 },
        { text: '> CONNECTING TO SECTOR_07...', type: 'system', delay: 1200 },
        { text: '> DECRYPTING DATA STREAMS...', type: 'warning', delay: 1800 },
        { text: '> OPTIMIZING VIRTUAL ENVIRONMENT...', type: 'normal', delay: 2400 },
        { text: '> LOADING ASSETS (2.4GB)...', type: 'normal', delay: 3000 },
        { text: '> BYPASSING SECURITY PROTOCOLS...', type: 'error', delay: 3500 },
        { text: '> ACCESS GRANTED.', type: 'success', delay: 3800 },
        { text: '> SYSTEM READY.', type: 'success', delay: 4000 }
    ];

    let progress = 0;
    const totalDuration = 4500; // ~4.5 seconds total boot time
    const startTime = Date.now();

    // Function to add log line
    const addLog = (text, type = 'normal') => {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.textContent = text;
        bootLog.appendChild(line);
        bootLog.scrollTop = bootLog.scrollHeight; // Auto scroll
    };

    // Schedule logs
    bootLogs.forEach(log => {
        setTimeout(() => addLog(log.text, log.type), log.delay);
    });

    // Animation Loop
    const updateBoot = () => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(elapsed / totalDuration, 1);

        // Non-linear progress curve (ease-out-cubic for feeling of "heavy processing" then speed up)
        // Actually, let's do a "stalled" feel: fast start, slow middle, fast end
        let easedProgress = 0;

        if (percent < 0.3) {
            easedProgress = percent * 2; // Fast start
        } else if (percent < 0.7) {
            easedProgress = 0.6 + (percent - 0.3) * 0.5; // Slow middle
        } else {
            easedProgress = 0.8 + (percent - 0.7) * 0.66; // Fast finish
        }

        progress = Math.min(Math.floor(easedProgress * 100), 100);

        // Update UI
        loadProgress.textContent = progress;
        bootLoaderBar.style.width = `${progress}%`;

        if (percent < 1) {
            requestAnimationFrame(updateBoot);
        } else {
            // Complete
            setTimeout(finishBoot, 200);
        }
    };

    const finishBoot = () => {
        console.log('%c>> BOOT: Complete (100%)', 'color: #39FF14; font-family: monospace;');

        bootOverlay.style.opacity = '0'; // Fade out entire overlay

        setTimeout(() => {
            console.log('%c>> BOOT: Showing dashboard', 'color: #39FF14; font-family: monospace;');
            dashboard.classList.add('visible');
            bootOverlay.style.display = 'none';

            // Mostrar matrix rain después del boot
            const matrixCanvas = document.getElementById('matrixCanvas');
            if (matrixCanvas) {
                matrixCanvas.style.display = 'block';
            }

            // Desbloquear scroll cuando el dashboard esté listo
            setTimeout(() => {
                document.body.classList.remove('no-scroll');
                console.log('%c>> SCROLL: Enabled - Dashboard ready ✓', 'color: #39FF14; font-family: monospace;');
            }, 100);

            setTimeout(() => {
                const terminalBtn = document.getElementById('terminalButton');
                if (terminalBtn) terminalBtn.classList.add('visible');

                if (typeof technicalBackground !== 'undefined' && technicalBackground.show) {
                    technicalBackground.show();
                }

                console.log('%c>> BOOT: System ready ✓', 'color: #39FF14; font-family: monospace;');
            }, 300);
        }, 800); // Wait for opacity transition
    };

    // Start animation
    updateBoot();
}

// ========== SYSTEM TIME ==========
const updateSystemTime = () => {
    const el = document.getElementById('systemTime');
    if (el) el.textContent = new Date().toTimeString().split(' ')[0];
};

// Start time updates after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    updateSystemTime();
    setInterval(updateSystemTime, 1000);
});

// ========== ANIMATED COUNTERS ==========
// ========== UTILITY FUNCTIONS ==========
const animateCounter = (element, target, duration = 1500) => {
    let current = 0;
    const steps = duration / 30;
    const stepIncrement = target / steps;

    const timer = setInterval(() => {
        current = Math.min(current + stepIncrement, target);
        element.textContent = Math.floor(current).toString().padStart(2, '0');
        if (current >= target) clearInterval(timer);
    }, 30);
};

// Intersection Observer for counters
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
            animateCounter(entry.target, parseInt(entry.target.dataset.count, 10));
            entry.target.classList.add('counted');
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(counter => counterObserver.observe(counter));

// ========== CONSOLE FEED ==========
const consoleFeed = document.getElementById('consoleFeed');
const consoleMessages = [
    'INITIALIZING NEURAL INTERFACE...',
    'LOADING SPATIAL ANCHORS // OK',
    'BIOMETRIC SCAN COMPLETE // PASS',
    'SHADER COMPILATION // 100%',
    'ASSET BUNDLES LOADED // 2.3GB',
    'VR HEADSET DETECTED // READY',
    'HAND TRACKING ACTIVE // CALIBRATED',
    'MULTIPLAYER SESSION // CONNECTED',
    'VOLUMETRIC RENDERING // ONLINE',
    'HAPTIC FEEDBACK // ENABLED',
    'AUDIO SPATIALIZER // ACTIVE',
    'PHYSICS ENGINE // RUNNING'
];

function addConsoleLine() {
    const now = new Date();
    const timeStamp = now.toTimeString().split(' ')[0];
    const message = consoleMessages[Math.floor(Math.random() * consoleMessages.length)];
    
    const line = document.createElement('div');
    line.className = 'console-line';
    line.innerHTML = `<span>${timeStamp}</span><span>${message}</span>`;
    
    consoleFeed.prepend(line);
    
    // Keep only last 5 lines
    while (consoleFeed.childNodes.length > 5) {
        consoleFeed.removeChild(consoleFeed.lastChild);
    }
}

// Initial console lines
setTimeout(() => {
    addConsoleLine();
    setInterval(addConsoleLine, 3000);
}, 3500);

// ========== LAST SYNC TIME ==========
const lastSync = document.getElementById('lastSync');
const syncTime = new Date();
lastSync.textContent = syncTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

// ========== LINK BLOCK INTERACTIONS ==========
const linkBlocks = document.querySelectorAll('.link-block');

linkBlocks.forEach(block => {
    block.addEventListener('mouseenter', function() {
        const id = this.dataset.id;
        audioManager.playHover();
        console.log(`%c>> ACCESS LINK_${id}`, 'color: #39FF14; font-family: monospace; font-size: 12px;');
    });

    block.addEventListener('click', function(e) {
        audioManager.playClick();
        // Add subtle glitch effect on click
        this.style.transform = 'scale(0.98)';
        setTimeout(() => {
            this.style.transform = '';
        }, 100);
    });
});

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', (e) => {
    // Konami Code detection
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            terminal.konamiCode();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
    
    // Ctrl + K: Open Terminal
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        terminal.open();
    }
    
    // Ctrl + M: Toggle Audio
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        if (audioManager.bgMusic && !audioManager.bgMusic.paused) {
            audioManager.stopBackgroundMusic();
        } else {
            audioManager.playBackgroundMusic(0.2);
        }
    }
    
    // Ctrl + /: Show Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        shortcutsManager.open();
    }
    
    // ESC: Close modals
    if (e.key === 'Escape') {
        terminal.close();
        shortcutsManager.close();
    }
    
    // Press 'H' to scroll home (only if not in input)
    if ((e.key === 'h' || e.key === 'H') && e.target.tagName !== 'INPUT') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Press 'C' to scroll to console (only if not in input)
    if ((e.key === 'c' || e.key === 'C') && e.target.tagName !== 'INPUT') {
        document.querySelector('.console-block')?.scrollIntoView({ behavior: 'smooth' });
    }
});

// ========== CONSOLE WELCOME MESSAGE ==========
console.log('%c', 'padding: 40px; line-height: 40px;');
console.log(
    '%c■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■\n' +
    '  SECTOR_07 INTERFACE ACCESS\n' +
    '  SYS_V.2.0.226 | KA-0226-MX07\n' +
    '  © 2026 KAITOARTZ\n' +
    '■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■',
    'color: #39FF14; font-family: monospace; font-size: 12px; font-weight: bold;'
);

// ========== GLITCH EFFECT TRIGGER ==========
// ========== GLITCH EFFECT TRIGGER & TEXT DECODING ==========
function triggerGlitch(element, force = false) {
    // Check performance settings unless forced
    if (!force && typeof performanceManager !== 'undefined' && !performanceManager.effects.glitch) return;

    const original = element.getAttribute('data-original-text') || element.textContent;
    // Store original text if not already stored
    if (!element.getAttribute('data-original-text')) {
        element.setAttribute('data-original-text', original);
    }

    const chars = '!<>-_\\/[]{}—=+*^?#________';
    let iterations = 0;

    // Clear any existing interval to prevent overlap
    if (element.dataset.glitchInterval) {
        clearInterval(parseInt(element.dataset.glitchInterval));
    }

    const glitchInterval = setInterval(() => {
        element.textContent = original
            .split('')
            .map((char, index) => {
                if (index < iterations) {
                    return original[index];
                }
                if (char === ' ') return ' '; // Preserve spaces
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

        if (iterations >= original.length) {
            clearInterval(glitchInterval);
            element.textContent = original; // Ensure final state is clean
            delete element.dataset.glitchInterval;
        }

        iterations += 1 / 3;
    }, 30);

    element.dataset.glitchInterval = glitchInterval;
}

// Initial Text Decoding on Boot (Hook into your boot sequence)
function decodeTextElements() {
    if (typeof performanceManager !== 'undefined' && !performanceManager.effects.glitch) return;

    const targets = document.querySelectorAll('.start-title, .start-subtitle, .tech-header-info span, .sector-label');
    targets.forEach((el, index) => {
        setTimeout(() => triggerGlitch(el, true), index * 100 + 500);
    });
}

// Random glitch on title occasionally
setInterval(() => {
    if (Math.random() > 0.8) {
        const title = document.querySelector('.main-title');
        if (title) {
            triggerGlitch(title);
            audioManager.playGlitch();
        }
    }
}, 10000);

// ========== PARTICLE SYSTEM ==========
function createParticles() {
    const container = document.createElement('div');
    container.className = 'particle-container';
    document.body.appendChild(container);

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

setTimeout(createParticles, 3500);

// ========== ACCESSIBILITY ==========
// Add keyboard navigation hints
document.querySelectorAll('.link-block').forEach((link, index) => {
    link.setAttribute('tabindex', index + 1);
    link.setAttribute('role', 'button');
});

// ========== PERFORMANCE MONITORING ==========
if ('PerformanceObserver' in window) {
    const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
                console.log(`%c>> LCP: ${entry.renderTime || entry.loadTime}ms`, 
                    'color: #39FF14; font-family: monospace; font-size: 11px;');
            }
        }
    });

    perfObserver.observe({ entryTypes: ['largest-contentful-paint'] });
}

console.log('%c>> SYSTEM READY. AWAITING INPUT.', 'color: #39FF14; font-family: monospace;');

// ========== DOCK MANAGER ==========
class DockManager {
    constructor() {
        this.dock = null;
        this.burger = null;
        this.audioBtn = null;
        this.langBtn = null;
        this.isExpanded = false;
    }

    init() {
        this.docks = document.querySelectorAll('.control-dock');

        if (this.docks.length === 0) {
            console.warn('>> DOCK ERROR: No .control-dock found');
            return;
        }

        console.log(`>> DOCK SYSTEM: INITIALIZING ${this.docks.length} DOCKS...`);

        this.docks.forEach(dock => {
            // Toggle expansion on deco click
            const deconStart = dock.querySelector('.dock-deco-start');
            const decoEnd = dock.querySelector('.dock-deco-end');
            [deconStart, decoEnd].forEach(el => {
                if (el) {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleDock(dock);
                    });
                }
            });            // Settings/Burger Button (toggles dock expand/collapse)
            const burger = dock.querySelector('.settings-toggle-btn');
            if (burger) {
                burger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // burgerMenu (#burgerMenu) toggles the dock open/close
                    if (burger.id === 'burgerMenu') {
                        if (typeof burgerMenuManager !== 'undefined') {
                            burgerMenuManager.toggleDock(dock);
                        }
                    } else {
                        this.toggleDock(dock);
                    }
                });
            }

            // Config / Settings Panel Open Button
            const configBtn = dock.querySelector('.config-open-btn');
            if (configBtn) {
                configBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof burgerMenuManager !== 'undefined') {
                        burgerMenuManager.toggle();
                    }
                });
            }

            // Audio Button
            const audioBtn = dock.querySelector('.audio-toggle-btn');
            if (audioBtn) {
                audioBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAudio(audioBtn);
                });
            }

            // Language Button
            const langBtn = dock.querySelector('.lang-toggle-btn');
            if (langBtn) {
                langBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleLanguage(langBtn);
                });
            }

            // Theme Button (Shared with ThemeManager but we add click here for sync)
            const themeBtn = dock.querySelector('.theme-toggle-btn');
            if (themeBtn) {
                themeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof themeManager !== 'undefined') {
                        themeManager.handleToggle(e);
                        this.updateAllThemes();
                    }
                });
            }
        });
        
        devLog('DockManager initialized ✓');
    }

    toggleDock(dock) {
        const isCurrentlyExpanded = dock.classList.contains('collapsed') === false;
        const newState = !isCurrentlyExpanded;
        
        dock.classList.toggle('collapsed', !newState);
        dock.setAttribute('data-expanded', newState);
        
        if (typeof audioManager !== 'undefined') audioManager.playClick();
        
        const label = dock.querySelector('.dock-label-min');
        if (label && typeof triggerGlitch === 'function') triggerGlitch(label);
    }    handleAudio(btn) {
        if (audioManager.bgMusic && !audioManager.bgMusic.paused) {
            audioManager.stopBackgroundMusic();
        } else {
            audioManager.playBackgroundMusic(0.2);
        }
        this.updateAllAudioIcons();
        // Note: playClick is intentionally skipped here to avoid audio feedback during mute/unmute
    }

    updateAllAudioIcons() {
        const isPlaying = audioManager.bgMusic && !audioManager.bgMusic.paused;
        document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('.audio-icon') || btn.querySelector('i');
            if (icon) icon.className = isPlaying ? 'fa-solid fa-volume-high audio-icon' : 'fa-solid fa-volume-xmark audio-icon';
            btn.classList.toggle('active', isPlaying);
        });
    }

    handleLanguage(btn) {
        const langText = btn.querySelector('.lang-text');
        if (!langText) return;
        
        const currentLang = langText.textContent.trim();
        const newLang = currentLang === 'ES' ? 'EN' : 'ES';
        
        // Update all docks
        document.querySelectorAll('.lang-toggle-btn .lang-text').forEach(el => {
            el.textContent = newLang;
            if (typeof triggerGlitch === 'function') triggerGlitch(el);
        });
        
        if (typeof i18nManager !== 'undefined') {
            i18nManager.setLanguage(newLang.toLowerCase());
        }
        
        if (typeof audioManager !== 'undefined') audioManager.playClick();
    }

    updateAllThemes() {
        const isDark = document.body.classList.contains('theme-dark');
        document.querySelectorAll('.theme-toggle-btn i').forEach(icon => {
            icon.className = isDark ? 'fa-solid fa-moon theme-icon' : 'fa-solid fa-sun theme-icon';
        });
    }
}

const dockManager = new DockManager();

// ========== THEME TOGGLE SYSTEM ==========
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.colorTheme = localStorage.getItem('colorTheme') || 'default';
        this.toggleButton = null;
        this.toggleButtons = null;
        this.toggleLabel = null;
        this.overlay = null;
    }

    init() {
        this.toggleButtons = document.querySelectorAll('.theme-toggle-btn');
        this.toggleLabel = document.getElementById('toggleLabel');
        
        // Apply saved theme
        this.applyTheme(this.theme);
        this.setColorTheme(this.colorTheme, false);
        
        // Add event listeners to all buttons
        this.toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleToggle(e);
            });
        });

        // Initialize color buttons
        this.initColorButtons();
    }

    initColorButtons() {
        const colorBtns = document.querySelectorAll('.color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                this.setColorTheme(color, true);

                // Update active state
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                audioManager.playClick();
            });

            // Set initial active state: Only the saved theme should be active
            if (btn.dataset.color === this.colorTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    setColorTheme(color, log = true) {
        // Remove existing theme classes
        document.body.classList.remove('theme-pink', 'theme-orange', 'theme-white');

        // Add new class if not default
        if (color !== 'default') {
            document.body.classList.add(`theme-${color}`);
        }

        this.colorTheme = color;
        localStorage.setItem('colorTheme', color);

        if (log) {
            console.log(`%c>> COLOR_THEME: ${color.toUpperCase()}_ACTIVATED`, 'color: var(--toxic-green); font-family: monospace;');
        }
    }

    handleToggle(e) {
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        
        if (this.toggleButton) {
            const rect = this.toggleButton.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
        
        // Play sound
        audioManager.playClick();
        
        // Toggle theme
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        
        // Animate transition
        this.animateTransition(x, y, () => {
            this.applyTheme(this.theme, true);
        });
        
        // Save preference
        localStorage.setItem('theme', this.theme);
    }

    animateTransition(x, y, callback) {
        // Create temporary snapshot overlay
        const snapshot = document.createElement('div');
        snapshot.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10004;
            background: ${this.theme === 'dark' ? '#111111' : '#FFFFFF'};
            opacity: 0;
            transition: opacity 0.4s ease-in-out;
            pointer-events: none;
        `;
        document.body.appendChild(snapshot);
        
        // Fade in overlay
        requestAnimationFrame(() => {
            snapshot.style.opacity = '1';
        });
        
        // Change theme at peak opacity
        setTimeout(() => {
            if (callback) callback();
            
            // Fade out overlay
            setTimeout(() => {
                snapshot.style.opacity = '0';
                
                // Remove overlay after fade
                setTimeout(() => {
                    snapshot.remove();
                }, 400);
            }, 50);
        }, 400);
    }

    applyTheme(theme, animate = false) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            if (this.toggleButton) {
                this.toggleButton.classList.add('light');
            }
            if (this.toggleLabel) {
                this.toggleLabel.textContent = 'DAY_MODE';
            }
            
            if (animate) {
                console.log('%c>> THEME_SWITCH: DAY_MODE_ACTIVATED', 'color: #FFD700; font-family: monospace;');
            }
        } else {
            document.body.classList.remove('light-theme');
            if (this.toggleButton) {
                this.toggleButton.classList.remove('light');
            }
            if (this.toggleLabel) {
                this.toggleLabel.textContent = 'NIGHT_MODE';
            }
            
            if (animate) {
                console.log('%c>> THEME_SWITCH: NIGHT_MODE_ACTIVATED', 'color: #39FF14; font-family: monospace;');
            }
        }
    }
}

const themeManager = new ThemeManager();

// Initialize theme and dock after page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        themeManager.init();
        dockManager.init(); // Add this line
    }, 100);
});

// ========== CUSTOM CURSOR SYSTEM ==========
// ========== CURSOR MANAGER ==========
class CursorManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.cursor = { x: 0, y: 0 };
        this.maxTrail = 20;
        // Pre-allocate array and objects to avoid GC
        this.trail = new Array(this.maxTrail).fill(null).map(() => ({ x: 0, y: 0, life: 0 }));
        this.head = 0; // Ring buffer pointer
        this.running = false;
        this.looping = false; // Tracks active RAF loop
        this.animationId = null;
        this.rgb = { r: 57, g: 255, b: 20 }; // Default toxic green

        // PERF: Bind animate to prevent closure creation in RAF loop
        this.animate = this.animate.bind(this);
    }

    init() {
        this.canvas = document.getElementById('cursorCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.updateColor(); // Initial color fetch
        
        document.addEventListener('mousemove', (e) => {
            if (!this.running) return;
            // Update cursor position in place
            this.cursor.x = e.clientX;
            this.cursor.y = e.clientY;

            // Update trail ring buffer
            const point = this.trail[this.head];
            point.x = e.clientX;
            point.y = e.clientY;
            point.life = 1;

            this.head = (this.head + 1) % this.maxTrail;

            if (!this.looping) {
                this.looping = true;
                this.animate();
            }
        }, { passive: true });
        
        window.addEventListener('resize', debounce(() => this.resize(), 200));
        
        // Observer for theme changes (Performance Optimization: avoid getComputedStyle in loop)
        const observer = new MutationObserver(() => {
            this.updateColor();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // Register with performance manager
        if (typeof performanceManager !== 'undefined') {
            performanceManager.registerEffect('cursor', this);
            if (performanceManager.effects.cursorTrail) {
                this.start();
            }
        } else {
             this.start();
        }
    }

    updateColor() {
        // Use document.body to respect theme classes
        const cursorColor = getComputedStyle(document.body).getPropertyValue('--toxic-green').trim();
        if (cursorColor) {
            this.rgb = this.hexToRgb(cursorColor);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.running && !this.looping) {
            this.looping = true;
            this.animate();
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        if (!this.looping) {
            this.looping = true;
            this.animate();
        }
    }

    stop() {
        this.running = false;
        this.looping = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Clear canvas when stopped
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        // Reset trail without destroying objects
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].life = 0;
        }
    }

    animate() {
        if (!this.running) {
            this.looping = false;
            return;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Use cached RGB instead of calling getComputedStyle every frame
        const { r, g, b } = this.rgb;
        
        // PERF: Set base color once to avoid repeated string concatenation/parsing
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        // Draw trail - Iterate ring buffer from oldest to newest
        for (let i = 0; i < this.maxTrail; i++) {
            const idx = (this.head + i) % this.maxTrail;
            const point = this.trail[idx];

            if (point.life > 0) {
                point.life -= 0.05;
                if (point.life > 0) {
                    const size = 3 * point.life;
                    // PERF: Modulate alpha instead of reconstructing rgba string
                    this.ctx.globalAlpha = point.life * 0.5;
                    this.ctx.fillRect(point.x - size/2, point.y - size/2, size, size);
                }
            }
        }
        
        // PERF: Reset globalAlpha for subsequent drawing operations
        this.ctx.globalAlpha = 1.0;

        // Draw crosshair
        const { x, y } = this.cursor;
        const size = 20;
        this.ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
        this.ctx.moveTo(x - size, y);
        this.ctx.lineTo(x + size, y);
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x, y + size);
        this.ctx.stroke();
        
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.fillRect(x - 1, y - 1, 2, 2);
        
        // Optimization: Stop loop if idle (no trails and static cursor)
        const hasActiveTrails = this.trail.some(p => p.life > 0);
        if (!hasActiveTrails) {
            this.looping = false;
            this.animationId = null;
            return;
        }

        this.animationId = requestAnimationFrame(this.animate);
    }

    hexToRgb(hex) {
        // Handle empty or invalid hex
        if (!hex) return { r: 57, g: 255, b: 20 };

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 57, g: 255, b: 20 };
    }
}

// ========== VOLUME CONTROL SYSTEM ==========
class VolumeController {
    constructor() {
        this.slider = null;
        this.value = null;
        this.icon = null;
    }

    init() {
        this.slider = document.getElementById('volumeSlider');
        this.value = document.getElementById('volumeValue');
        this.icon = document.getElementById('volumeIcon');
        
        if (!this.slider) return;
        
        this.slider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            this.value.textContent = volume + '%';
            audioManager.setVolume(volume / 100);
            
            this.icon.textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
        });
        
        this.icon.addEventListener('click', () => {
            const current = parseInt(this.slider.value);
            this.slider.value = current > 0 ? (this.slider.dataset.lastVolume = current, 0) : (this.slider.dataset.lastVolume || 20);
            this.slider.dispatchEvent(new Event('input'));
            audioManager.playClick();
        });
    }
}

// ========== TERMINAL SYSTEM ==========
class Terminal {
    constructor() {
        this.modal = null;
        this.output = null;
        this.input = null;
        this.backdrop = null;
        this.history = [];
        this.historyIndex = -1;
        
        this.commands = {
            help: () => this.showHelp(),
            about: () => this.showAbout(),
            skills: () => this.showSkills(),
            projects: () => this.showProjects(),
            contact: () => this.showContact(),
            clear: () => this.clearOutput(),
            exit: () => this.close(),
            quit: () => this.close(),
            theme: (arg) => this.toggleTheme(arg),
            audio: (arg) => this.audioControl(arg),
            matrix: () => this.toggleMatrix(),
            parallax: () => this.toggleParallaxEffect(),
            cursor: () => this.toggleCursorEffect(),
            scanlines: () => this.toggleScanlinesEffect(),
            glitch: () => this.toggleGlitchEffect(),
            particles: () => this.toggleParticlesEffect(),
            performance: (arg) => this.setPerformance(arg),
            fps: (arg) => this.setMatrixFPS(arg),
            konami: () => this.konamiCode(),
            hack: () => this.hackEffect(),
            time: () => this.showTime(),
            whoami: () => this.whoami(),
            ls: () => this.listFiles(),
            cat: (file) => this.readFile(file),
        };
    }

    init() {
        this.modal = document.getElementById('terminalModal');
        this.output = document.getElementById('terminalOutput');
        this.input = document.getElementById('terminalInput');
        
        if (!this.modal) return;
        
        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal-backdrop';
        this.backdrop.addEventListener('click', () => this.close());
        document.body.appendChild(this.backdrop);
        
        // Close button
        document.getElementById('terminalClose').addEventListener('click', () => this.close());
        
        // Input handling
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand(this.input.value.trim());
                this.input.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                } else {
                    this.historyIndex = -1;
                    this.input.value = '';
                }
            }
        });
    }

    open() {
        this.modal.classList.add('active');
        this.backdrop.classList.add('active');
        this.input.focus();
        document.body.classList.add('no-scroll');
        audioManager.playSuccess();
    }

    close() {
        this.modal.classList.remove('active');
        this.backdrop.classList.remove('active');
        document.body.classList.remove('no-scroll');
        audioManager.playClick();
    }

    executeCommand(cmd) {
        if (!cmd) return;
        
        this.history.push(cmd);
        this.historyIndex = -1;
        
        const [command, ...args] = cmd.split(' ');
        const arg = args.join(' ');
        
        // Add command to output
        this.addOutput(`<span class="terminal-prompt">$ </span>${cmd}`, false);
        
        if (this.commands[command.toLowerCase()]) {
            this.commands[command.toLowerCase()](arg);
        } else {
            this.addOutput(`Command not found: ${command}. Type 'help' for available commands.`);
        }
        
        audioManager.playClick();
    }

    addOutput(text, isCommand = true) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = text;
        this.output.appendChild(line);
        this.output.scrollTop = this.output.scrollHeight;
    }

    clearOutput() {
        this.output.innerHTML = '<div class=\"terminal-line\"><span class=\"terminal-prompt\">$ </span><span>Terminal cleared</span></div>';
    }

    showHelp() {
        this.addOutput(`
Available commands:<br/>
• help - Show this help message<br/>
• about - Information about KAITOARTZ<br/>
• skills - Display skills and technologies<br/>
• projects - Show recent projects<br/>
• contact - Contact information<br/>
• theme [dark/light] - Switch theme<br/>
• audio [play/stop/test] - Control background music<br/>
<br/>
<span style="color: #00FFFF;">VISUAL EFFECTS:</span><br/>
• matrix - Toggle Matrix rain effect<br/>
• parallax - Toggle parallax layers<br/>
• cursor - Toggle cursor trail<br/>
• scanlines - Toggle CRT scanlines<br/>
• glitch - Toggle glitch effects<br/>
• particles - Toggle particle effects<br/>
<br/>
<span style="color: #FFD700;">PERFORMANCE:</span><br/>
• performance [ultra/high/medium/low] - Set performance preset<br/>
• fps [number] - Set Matrix rain FPS (12-60)<br/>
<br/>
• time - Show current system time<br/>
• whoami - Display user info<br/>
• ls - List files<br/>
• cat [file] - Read file contents<br/>
• hack - Simulate hacking sequence<br/>
• clear - Clear terminal<br/>
• exit/quit - Close terminal<br/>
• konami - ??? (try the Konami code)
        `);
    }

    showAbout() {
        this.addOutput(`
<span style="color: #00ff00;">╔════════════════════════════════════╗</span><br/>
<span style="color: #00ff00;">║</span>  KAITOARTZ - GAME DEVELOPER    <span style="color: #00ff00;">║</span><br/>
<span style="color: #00ff00;">╚════════════════════════════════════╝</span><br/>
<br/>
Game Developer & Designer | Egresado en Artes<br/>
y Tecnologías de la Comunicación | Jammer<br/>
Speaker | Especialista en Unity & VR<br/>
<br/>
Propongo planes de acción y organizo equipos<br/>
en torno a la materialización de videojuegos,<br/>
desde su origen conceptual hasta su publicación.<br/>
<br/>
S/N: KA-0226-MX07 | NODE_07
        `);
    }


    showSkills() {
        this.addOutput(`
    <div style="border-bottom: 1px solid var(--toxic-green); margin-bottom: 10px; padding-bottom: 5px;">
        <span style="color: var(--toxic-green); font-weight: bold;">>> SYSTEM_ANALYSIS // SKILLS_MATRIX</span>
    </div>
    <span style="color: #00ff00;">TECHNICAL_SKILLS:</span><br/>
    ▓▓▓▓▓▓▓▓▓▓ Unity/C# [95%]<br/>
▓▓▓▓▓▓▓▓▓░ C# / JavaScript [90%]<br/>
▓▓▓▓▓▓▓▓░░ VR/AR Development [85%]<br/>
▓▓▓▓▓▓▓░░░ 3D Modeling [75%]<br/>
▓▓▓▓▓▓▓▓▓░ Shader Programming [90%]<br/>
▓▓▓▓▓▓▓▓░░ Web Technologies [80%]
        `);
    }

    showProjects() {
        this.addOutput(`
<span style="color: #00ff00;">RECENT_PROJECTS:</span><br/>
<br/>
[01] VR_GALLERY - Immersive art exhibition<br/>
[02] NEURAL_INTERFACE - Brain-computer integration<br/>
[03] HOLOGRAM_SIM - Real-time holographic display<br/>
[04] EDU_XR - Educational VR platform<br/>
<br/>
Visit portfolio for more details...
        `);
    }

    showContact() {
        this.addOutput(`
<span style="color: #00ff00;">CONTACT_PROTOCOL:</span><br/>
<br/>
📧 EMAIL: kaitoartz.info@gmail.com<br/>
📱 PHONE: +569 46817299<br/>
📍 LOC: Maipú, Santiago, Chile<br/>
💼 LINKEDIN: linkedin.com/in/kaitoarts<br/>
🐙 GITHUB: github.com/kaitoartz<br/>
🎮 ITCH.IO: kaitoartz.itch.io<br/>
<br/>
STATUS: <span style="color: #00ff00;">ONLINE</span> | ACCEPTING_COLLABORATIONS
        `);
    }


    toggleTheme(arg) {
        if (!arg) {
            this.addOutput(`Usage: theme [dark/light/pink/orange/white/default]`);
            return;
        }

        const mode = arg.toLowerCase();

        if (mode === 'dark' || mode === 'light') {
            themeManager.theme = mode === 'dark' ? 'light' : 'dark'; // Toggle logic if explicit
            if (themeManager.theme !== mode) themeManager.handleToggle({}); // Trigger if current doesn't match
            else this.addOutput(`Already in ${mode} mode`);

        } else if (['pink', 'orange', 'white', 'default'].includes(mode)) {
            themeManager.setColorTheme(mode, true);
            this.addOutput(`Accent color set to: <span style="color: var(--toxic-green)">${mode.toUpperCase()}</span>`);
        } else {
            this.addOutput(`Unknown theme/color: ${mode}`);
            this.addOutput(`Available: dark, light, pink, orange, white, default`);
        }
    }

    audioControl(arg) {
        if (arg === 'play') {
            audioManager.playBackgroundMusic(0.3);
            this.addOutput(`<span style="color: #39FF14;">♫ Background music started (30% volume)</span>`);
        } else if (arg === 'stop') {
            audioManager.stopBackgroundMusic();
            this.addOutput(`<span style="color: #FF6B6B;">⏹ Background music stopped</span>`);
        } else if (arg === 'test') {
            this.addOutput(`<span style="color: #00FFFF;">Testing audio system...</span>`);
            this.addOutput(`Audio Context: ${audioManager.audioContext ? '✓ Active' : '✗ Inactive'}`);
            this.addOutput(`Background Music: ${audioManager.bgMusic ? '✓ Loaded' : '✗ Not loaded'}`);
            if (audioManager.bgMusic) {
                this.addOutput(`  - Duration: ${audioManager.bgMusic.duration.toFixed(2)}s`);
                this.addOutput(`  - Paused: ${audioManager.bgMusic.paused}`);
                this.addOutput(`  - Volume: ${(audioManager.bgMusic.volume * 100).toFixed(0)}%`);
                this.addOutput(`  - Current Time: ${audioManager.bgMusic.currentTime.toFixed(2)}s`);
            }
            this.addOutput(`Analyser Node: ${audioManager.analyserNode ? '✓ Connected' : '✗ Not connected'}`);
        } else {
            this.addOutput(`Usage: audio [play/stop/test]<br>  play - Start background music<br>  stop - Stop background music<br>  test - Show audio system status`);
        }
    }

    toggleMatrix() {
        const isActive = matrixRain.toggle();
        if (isActive) {
            this.addOutput(`<span style="color: #39FF14;">Matrix rain ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Matrix rain DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    toggleParallaxEffect() {
        const currentState = performanceManager.effects.parallax;
        performanceManager.toggleEffect('parallax', !currentState);
        if (!currentState) {
            this.addOutput(`<span style="color: #39FF14;">Parallax effect ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Parallax effect DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    toggleCursorEffect() {
        const currentState = performanceManager.effects.cursorTrail;
        performanceManager.toggleEffect('cursorTrail', !currentState);
        if (!currentState) {
            this.addOutput(`<span style="color: #39FF14;">Cursor trail ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Cursor trail DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    toggleScanlinesEffect() {
        const currentState = performanceManager.effects.scanlines;
        performanceManager.toggleEffect('scanlines', !currentState);
        if (!currentState) {
            this.addOutput(`<span style="color: #39FF14;">Scanlines ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Scanlines DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    toggleGlitchEffect() {
        const currentState = performanceManager.effects.glitch;
        performanceManager.toggleEffect('glitch', !currentState);
        if (!currentState) {
            this.addOutput(`<span style="color: #39FF14;">Glitch effect ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Glitch effect DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    toggleParticlesEffect() {
        const currentState = performanceManager.effects.particles;
        performanceManager.toggleEffect('particles', !currentState);
        if (!currentState) {
            this.addOutput(`<span style="color: #39FF14;">Particles ACTIVATED ✓</span>`);
            audioManager.playSound('success');
        } else {
            this.addOutput(`<span style="color: #FF6B6B;">Particles DEACTIVATED</span>`);
            audioManager.playSound('click');
        }
    }

    setPerformance(preset) {
        const validPresets = ['ultra', 'high', 'medium', 'low', 'auto'];
        
        if (!preset || !validPresets.includes(preset.toLowerCase())) {
            this.addOutput(`
Usage: performance [preset]<br>
<br>
Available presets:<br>
• <span style="color: #FFD700;">ultra</span> - All effects enabled (high-end systems)<br>
• <span style="color: #00FF00;">high</span> - Most effects enabled<br>
• <span style="color: #FFA500;">medium</span> - Balanced performance<br>
• <span style="color: #FF6B6B;">low</span> - Minimal effects (best performance)<br>
• <span style="color: #00FFFF;">auto</span> - Automatic detection<br>
<br>
Current: <span style="color: #39FF14;">${performanceManager.currentPreset}</span>
            `);
            return;
        }
        
        performanceManager.applyPreset(preset.toLowerCase());
        this.addOutput(`
<span style="color: #39FF14;">Performance preset changed to: ${preset.toUpperCase()}</span><br>
<br>
Effects status:<br>
• Matrix Rain: ${performanceManager.effects.matrixRain ? '✓' : '✗'}<br>
• Parallax: ${performanceManager.effects.parallax ? '✓' : '✗'}<br>
• Cursor Trail: ${performanceManager.effects.cursorTrail ? '✓' : '✗'}<br>
• Scanlines: ${performanceManager.effects.scanlines ? '✓' : '✗'}<br>
• Glitch: ${performanceManager.effects.glitch ? '✓' : '✗'}<br>
• Particles: ${performanceManager.effects.particles ? '✓' : '✗'}
        `);
        audioManager.playSound('success');
    }

    setMatrixFPS(value) {
        if (!value) {
            this.addOutput(`
Usage: fps [number]<br>
<br>
Set Matrix rain frame rate (12-60 FPS)<br>
Current FPS: <span style="color: #39FF14;">${matrixRain.fps}</span><br>
<br>
Recommendations:<br>
• 12-18 FPS - Low-end systems<br>
• 24 FPS - Balanced (default)<br>
• 30 FPS - Smooth animation<br>
• 60 FPS - High-end systems only
            `);
            return;
        }
        
        const fps = parseInt(value);
        if (isNaN(fps) || fps < 12 || fps > 60) {
            this.addOutput(`<span style="color: #FF6B6B;">Error: FPS must be between 12 and 60</span>`);
            return;
        }
        
        matrixRain.fps = fps;
        matrixRain.frameInterval = 1000 / fps;
        
        this.addOutput(`
<span style="color: #39FF14;">Matrix rain FPS set to: ${fps}</span><br>
Frame interval: ${matrixRain.frameInterval.toFixed(2)}ms
        `);
        audioManager.playSound('success');
    }

    showTime() {
        const now = new Date();
        this.addOutput(`
SYSTEM_TIME: ${now.toTimeString()}<br>
DATE: ${now.toDateString()}<br>
TIMESTAMP: ${now.getTime()}
        `);
    }

    whoami() {
        this.addOutput(`
USER: visitor@kaitoartz.dev<br>
ACCESS_LEVEL: PUBLIC<br>
SESSION_ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}<br>
IP: 127.0.0.1 (localhost)<br>
STATUS: <span style="color: #00ff00;">AUTHENTICATED</span>
        `);
    }

    listFiles() {
        this.addOutput(`
<span style="color: #00ff00;">drwxr-xr-x</span>  portfolio/<br>
<span style="color: #00ff00;">drwxr-xr-x</span>  projects/<br>
<span style="color: #00ff00;">drwxr-xr-x</span>  skills/<br>
<span style="color: #ffffff;">-rw-r--r--</span>  README.txt<br>
<span style="color: #ffffff;">-rw-r--r--</span>  about.txt<br>
<span style="color: #ffffff;">-rw-r--r--</span>  contact.txt
        `);
    }

    readFile(file) {
        const files = {
            'README.txt': 'Welcome to KAITOARTZ terminal interface. Type "help" for commands.',
            'about.txt': 'VR Developer specializing in immersive experiences and real-time rendering.',
            'contact.txt': 'Contact info available via "contact" command.'
        };
        
        if (files[file]) {
            this.addOutput(files[file]);
        } else {
            this.addOutput(`cat: ${file}: No such file or directory`);
        }
    }

    konamiCode() {
        this.addOutput(`
<span style="color: #ff00ff;">╔═══════════════════════════════╗</span><br>
<span style="color: #ff00ff;">║  🎮 KONAMI CODE ACTIVATED!  ║</span><br>
<span style="color: #ff00ff;">╚═══════════════════════════════╝</span><br>
<br>
<span style="color: #00ff00;">█▀▀ █▀█ █▄░█ █▀▀ █▀█ ▄▀█ ▀█▀ █▀</span><br>
<span style="color: #00ff00;">█▄▄ █▄█ █░▀█ █▄█ █▀▄ █▀█ ░█░ ▄█</span><br>
<br>
Achievement unlocked: Retro Gamer<br>
+30 XP | Secret mode enabled
        `);
        document.body.style.animation = 'rainbow 2s infinite';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 5000);
    }

    matrixEffect() {
        this.addOutput(`
<span style="color: #00ff00;">Initializing Matrix protocol...</span><br>
<span style="color: #00ff00;">10101001 11010110 01101001</span><br>
<span style="color: #00ff00;">11001010 10110101 01010110</span><br>
<span style="color: #00ff00;">01101010 11010101 10101010</span><br>
<br>
<span style="color: #00ff00; animation: blink 1s infinite;">█ CONNECTED TO THE MATRIX █</span>
        `);
    }

    hackEffect() {
        this.addOutput(`<span style="color: #ff0000;">Initiating hack sequence...</span>`);
        
        const steps = [
            'Scanning network...',
            'Found 3 vulnerabilities',
            'Exploiting SQL injection...',
            'Bypassing firewall...',
            'Extracting data... 47%',
            'Extracting data... 89%',
            'Upload complete',
            '<span style="color: #00ff00;">ACCESS GRANTED</span>'
        ];
        
        let delay = 0;
        steps.forEach(step => {
            setTimeout(() => {
                this.addOutput(`> ${step}`);
            }, delay);
            delay += 500;
        });
    }
}

// ========== SHORTCUTS MODAL ==========
class ShortcutsManager {
    constructor() {
        this.modal = null;
        this.backdrop = null;
    }

    init() {
        this.modal = document.getElementById('shortcutsModal');
        if (!this.modal) return;
        
        document.getElementById('shortcutsClose').addEventListener('click', () => this.close());
    }

    open() {
        if (!this.backdrop) {
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'modal-backdrop';
            this.backdrop.addEventListener('click', () => this.close());
            document.body.appendChild(this.backdrop);
        }
        
        this.modal.classList.add('active');
        this.backdrop.classList.add('active');
        document.body.classList.add('no-scroll');
        audioManager.playSuccess();
    }

    close() {
        this.modal.classList.remove('active');
        if (this.backdrop) {
            this.backdrop.classList.remove('active');
        }
        document.body.classList.remove('no-scroll');
        audioManager.playClick();
    }
}

// ========== KEYBOARD SHORTCUTS ==========
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

// Initialize all managers
const cursorManager = new CursorManager();
const volumeController = new VolumeController();
const terminal = new Terminal();
const shortcutsManager = new ShortcutsManager();


// ========== TECHNICAL BACKGROUND MANAGER ==========
class TechnicalBackground {
    constructor() {
        this.container = null;
        this.startTime = Date.now();
    }

    init() {
        this.container = document.querySelector('.tech-background');
        if (!this.container) return;
        
        // Update timestamp
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
        
        // Update uptime counter
        this.updateUptime();
        setInterval(() => this.updateUptime(), 1000);
    }

    show() {
        if (this.container) {
            setTimeout(() => {
                this.container.classList.add('visible');
            }, 500);
        }
    }

    updateTimestamp() {
        const element = document.getElementById('techTimestamp');
        if (element) {
            const now = new Date();
            element.textContent = now.toTimeString().split(' ')[0];
        }
    }

    updateUptime() {
        const element = document.getElementById('uptimeCounter');
        if (element) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            element.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}

const technicalBackground = new TechnicalBackground();

// ========== SKILLS MANAGER (ASSET TAGS) ==========
class SkillsManager {
    constructor() {
        this.container = null;
        this.skills = [
            { name: 'UNITY_ENGINE', value: 95, color: '#39FF14', icon: 'fa-brands fa-unity', code: 'U-3D' },
            { name: 'C# / SCRIPTING', value: 95, color: '#39FF14', icon: 'fa-solid fa-code', code: 'CS-90' },
            { name: 'VR / XR DEV', value: 90, color: '#00FFFF', icon: 'fa-solid fa-vr-cardboard', code: 'XR-V2' },
            { name: 'HLSL / SHADERS', value: 85, color: '#FF00CC', icon: 'fa-solid fa-wand-magic-sparkles', code: 'SH-FX' },
            { name: '3D OPTIMIZATION', value: 90, color: '#00FFFF', icon: 'fa-solid fa-gauge-high', code: 'OPT-Z' },
            { name: 'UNREAL_ENGINE', value: 50, color: '#FFFF00', icon: 'fa-solid fa-cube', code: 'UE-05' }
        ];
    }

    init() {
        this.container = document.getElementById('skillsGrid');
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.innerHTML = this.skills.map((skill, index) => `
            <div class="skill-card-tech" style="--skill-color: ${skill.color}; animation-delay: ${index * 100}ms">
                <!-- Decorative Corner Cut -->
                <div class="card-corner-cut"></div>
                
                <div class="skill-main-content">
                    <div class="skill-header-row">
                        <span class="skill-id">ID_0${index + 1} // ${skill.code}</span>
                        <i class="skill-icon-small ${skill.icon}"></i>
                    </div>
                    
                    <div class="skill-name-large">${skill.name}</div>
                    
                    <div class="skill-bar-complex">
                        <div class="skill-bar-track">
                            <div class="skill-bar-fill" style="width: ${skill.value}%"></div>
                        </div>
                        <div class="skill-value-number">${skill.value}%</div>
                    </div>
                </div>

                <!-- Industrial Sidebar / Barcode -->
                <div class="skill-sidebar">
                    <div class="mini-barcode"></div>
                    <div class="warning-icon" title="High Voltage">⚡</div>
                </div>
            </div>
        `).join('');
    }
}


// ========== AWARDS MANAGER ==========
class AwardsManager {
    constructor() {
        this.awards = [
            {
                title: 'NOVA - BEST ATMOSPHERE',
                event: 'SANDA GAME JAM 2025',
                rank: '1ST PLACE',
                description: 'Winner for Best Narratice & Atmosphere. Honorable mentions in UI and Inclusive Team.',
                icon: 'fa-solid fa-trophy',
                color: '#FFD700'
            },
            {
                title: 'CREHA BITAT',
                event: 'SOCIAL IMPACT JAM 2024',
                rank: '2ND PLACE',
                description: 'Recognition for social impact and educational value in video games.',
                icon: 'fa-solid fa-medal',
                color: '#C0C0C0'
            },
            {
                title: 'SHAPE KISSER',
                event: 'GAME JAM ONLINE 2020',
                rank: '2ND PLACE',
                description: 'Award for inclusive puzzle mechanics and accessibility design.',
                icon: 'fa-solid fa-puzzle-piece',
                color: '#CD7F32'
            },
            {
                title: 'BE THE HERO',
                event: 'WOMEN GAME JAM 2025',
                rank: 'FINALIST',
                description: 'Developed in 48 hours. Explored ethical dilemmas and collaborative storytelling.',
                icon: 'fa-solid fa-star',
                color: '#00FFFF'
            }
        ];
        this.modal = null;
        this.backdrop = null;
    }

    init() {
        this.modal = document.getElementById('awardsModal');
        if (!this.modal) return;

        // Render Cards
        this.render();

        // Event Listeners
        const btn = document.getElementById('awardsBtn');
        if (btn) btn.addEventListener('click', () => this.open());

        const closeBtn = document.getElementById('awardsClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    }

    render() {
        const container = document.getElementById('awardsContainer');
        if (!container) return;

        container.innerHTML = this.awards.map((award, index) => `
            <div class="award-card" style="--award-color: ${award.color};">
                <div class="award-icon-box">
                    <i class="${award.icon}" style="color: ${award.color};"></i>
                </div>
                <div class="award-content">
                    <div class="award-rank" style="color: ${award.color};">${award.rank}</div>
                    <div class="award-title">${award.title}</div>
                    <div class="award-event">${award.event}</div>
                    <div class="award-desc">${award.description}</div>
                </div>
                <div class="award-deco-corner"></div>
            </div>
        `).join('');
    }

    open() {
        this.modal.classList.add('active');
        document.body.classList.add('no-scroll');
        audioManager.playSuccess();
        
        // Close on click outside
        this.modal.onclick = (e) => {
            if (e.target === this.modal) this.close();
        };

        // Anime.js Entry Animation
        if (typeof anime !== 'undefined') {
            anime({
                targets: '.award-card',
                translateY: [50, 0],
                opacity: [0, 1],
                delay: anime.stagger(100, {start: 200}),
                easing: 'easeOutElastic(1, .6)'
            });
        }
    }

    close() {
        this.modal.classList.remove('active');
        document.body.classList.remove('no-scroll');
        audioManager.playClick();
    }
}

const awardsManager = new AwardsManager();

// ========== NOTIFICATIONS SYSTEM ==========
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
    }

    init() {
        this.container = document.getElementById('notificationsContainer');
    }

    show(title, message, type = 'info', duration = 5000) {
        if (!this.container) return;
        
        const id = Date.now();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;
        
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${title}</div>
                <button class="notification-close" aria-label="Close Notification">&times;</button>
            </div>
            <div class="notification-message">${message}</div>
        `;
        
        this.container.appendChild(notification);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.remove(id);
        });
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        
        this.notifications.push({ id, element: notification });
    }

    remove(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;
        
        notification.element.classList.add('removing');
        setTimeout(() => {
            notification.element.remove();
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300);
    }

    success(title, message, duration = 5000) {
        this.show(title, message, 'success', duration);
    }

    error(title, message, duration = 5000) {
        this.show(title, message, 'error', duration);
    }

    warning(title, message, duration = 5000) {
        this.show(title, message, 'warning', duration);
    }

    info(title, message, duration = 5000) {
        this.show(title, message, 'info', duration);
    }
}

// ========== AUDIO VISUALIZER ==========
class AudioVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.active = false;
        this.animationId = null;
        this.gradientCache = [];
        this.lastHeight = 0;

        // Bind for RAF optimization
        this.draw = this.draw.bind(this);
    }

    init(audioManager) {
        this.canvas = document.getElementById('audioVisualizer');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Setup visibility observer to stop render loop when off-screen
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.analyser) {
                    this.start();
                } else {
                    this.stop(false); // Don't reset UI status, just stop rendering
                }
            });
        });
        this.observer.observe(this.canvas);

        // Use the already-created analyser node
        if (audioManager && audioManager.analyserNode) {
            this.analyser = audioManager.analyserNode;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            // Only start if visible (IntersectionObserver will handle it, but we set initial state)
            // this.active = true;
            // this.draw();
            
            const statusEl = document.getElementById('visualizerStatus');
            if (statusEl) statusEl.textContent = 'ACTIVE';
        } else {
            this.drawStandby();
        }
    }

    start() {
        if (this.active) return;
        if (!this.analyser) return; // Cannot start if not initialized
        this.active = true;
        this.draw();
        const statusEl = document.getElementById('visualizerStatus');
        if (statusEl) statusEl.textContent = 'ACTIVE';
    }

    stop(updateUI = true) {
        this.active = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (updateUI) {
            const statusEl = document.getElementById('visualizerStatus');
            if (statusEl) statusEl.textContent = 'STANDBY';
            this.drawStandby();
        }
    }

    draw() {
        if (!this.active) return;
        
        this.animationId = requestAnimationFrame(this.draw);
        
        this.analyser.getByteFrequencyData(this.dataArray);

        // Skip rendering when there is no audio data (silence)
        if (!this.dataArray.some(v => v > 0)) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Clear cache if height changed
        if (height !== this.lastHeight) {
            this.gradientCache = [];
            this.lastHeight = height;
        }
        
        const barWidth = (width / this.bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const value = this.dataArray[i];

            // Optimization: Skip 0 values
            if (value === 0) {
                x += barWidth + 1;
                continue;
            }

            barHeight = (value / 255) * height;
            
            // Optimization: Cache gradients
            if (!this.gradientCache[value]) {
                const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
                gradient.addColorStop(0, '#39FF14');
                gradient.addColorStop(0.5, '#00FFFF');
                gradient.addColorStop(1, '#FF00FF');
                this.gradientCache[value] = gradient;
            }
            
            ctx.fillStyle = this.gradientCache[value];
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }

    drawStandby() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let x = 0; x < width; x += 5) {
            ctx.lineTo(x, height / 2 + Math.sin(x * 0.05) * 10);
        }
        
        ctx.stroke();
    }
}

// ========== TIMELINE MANAGER ==========
class TimelineManager {
    constructor() {
        this.experiences = [
            {
                date: 'OCT 2025 - PRESENT',
                title: 'Desarrollador Unity',
                company: 'IST (Instituto de Seguridad del Trabajo)',
                description: 'Desarrollo de proyectos de Realidad Virtual y creación de Experiencias Inmersivas.'
            },
            {
                date: 'AGO 2025 - AGO 2025',
                title: 'Diseñador de Videojuegos',
                company: 'SANDA (SANDA GAME JAM)',
                description: 'Desarrollo de NOVA. 1er Lugar Mejor Atmósfera/Narrativa. Menciones honoríficas en UI y Equipo Inclusivo.'
            },
            {
                date: 'AGO 2025 - AGO 2025',
                title: 'Programador Informático',
                company: 'WOMEN GAME JAM CHILE',
                description: 'Desarrollo de "Be The Hero" en 48 horas. Exploración de dilemas éticos y trabajo colaborativo.'
            },
            {
                date: 'FEB 2025 - JUN 2025',
                title: 'Unity VR Dev & Animation',
                company: 'STAFFY LTDA.',
                description: 'Frameworks VR para MetaQuest 3. Optimización técnica, modelado 3D (Blender) y liderazgo de proyectos.'
            },
            {
                date: 'MAR 2021 - DIC 2025',
                title: 'Licenciatura en Artes y Tecnologías',
                company: 'UNIACC',
                description: 'Comunicador Digital: Diseño y Desarrollo de Videojuegos. Formación en arte, tecnologías y gestión de proyectos.'
            },
            {
                date: 'JUL 2024 - OCT 2024',
                title: 'Unity Developer',
                company: 'DREAMS OF HEAVEN',
                description: 'Desarrollo multiplataforma, C#, herramientas de editor y plugins personalizados para optimización de flujos.'
            },
            {
                date: 'MAY 2024 - MAY 2024',
                title: 'Desarrollador de Videojuegos',
                company: 'KUWALA',
                description: 'Desarrollo de "Creha Bitat", ganador del 2º Lugar en la Social Impact Game Jam 2024.'
            },
            {
                date: 'ABR 2022 - ABR 2024',
                title: 'Técnico Informático',
                company: 'DUST2.GG',
                description: 'Distribución de componentes gaming y soluciones tecnológicas. Soporte y hardware.'
            },
            {
                date: 'ENE 2021 - NOV 2021',
                title: 'Barista',
                company: 'TAVELLI',
                description: 'Gestión de comandas y atención al cliente. Coordinación multidisciplinaria.'
            },
             {
                date: 'SEP 2020 - SEP 2020',
                title: 'Desarrollador Unity',
                company: 'FFSTUDIOS SPA',
                description: 'Desarrollo de "Shape Kisser", 2º Lugar en Game Jam Online 2020. Mecánicas de puzzle inclusivas.'
            },
            {
                date: 'DIC 2021 - DIC 2022',
                title: 'Informática y Comunicaciones',
                company: 'DESAFÍO LATAM',
                description: 'Associate\'s degree. Fundamentos de desarrollo web y flujos de trabajo.'
            }
        ];
    }

    init() {
        this.render();
    }

    render() {
        const container = document.getElementById('timelineContainer');
        if (!container) return;
        
        container.innerHTML = this.experiences.map(exp => `
            <div class="timeline-item" style="opacity: 0; transform: translateX(-20px);">
                <div class="timeline-dot"></div>
                <div class="timeline-date">${exp.date}</div>
                <div class="timeline-title">${exp.title}</div>
                <div class="timeline-company">${exp.company}</div>
                <div class="timeline-description">${exp.description}</div>
            </div>
        `).join('');

        // Animation with Anime.js
        if (typeof anime !== 'undefined') {
            anime({
                targets: '.timeline-item',
                opacity: [0, 1],
                translateX: [-20, 0],
                delay: anime.stagger(150),
                easing: 'easeOutQuad',
                duration: 800
            });
        }
    }
}

// ========== MATRIX RAIN EFFECT ==========
class MatrixRain {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.columns = 0;
        this.drops = [];
        this.fontSize = 16; // Aumentado para menos columnas
        this.characters = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        this.charLength = this.characters.length;

        // Performance: Pre-calculate random indices and characters
        this.charArray = this.characters.split(''); // Faster access
        this.randomIndices = new Uint8Array(4096); // Buffer size power of 2
        this.randomIndex = 0;
        this.fillRandomBuffer();

        this.animationId = null;
        this.isActive = false;
        this.fps = 24; // Limitado a 24fps para mejor rendimiento
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / this.fps;

        // Bind for RAF optimization
        this.draw = this.draw.bind(this);
    }

    fillRandomBuffer() {
        for (let i = 0; i < this.randomIndices.length; i++) {
            this.randomIndices[i] = Math.floor(Math.random() * this.charLength);
        }
    }

    init() {
        this.canvas = document.getElementById('matrixCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        window.addEventListener('resize', debounce(() => this.resize(), 200));
        
        // Register with performance manager
        performanceManager.registerEffect('matrixRain', this);
        
        // Start based on performance settings
        if (performanceManager.effects.matrixRain) {
            this.start();
        }
        
        devLog('Matrix Rain initialized');
    }

    resize() {
        // Optimize resolution for mobile/low-end
        const preset = performanceManager.currentPreset;
        const tier = performanceManager.hardware.tier;
        // Determine effective low mode (explicit low OR auto+low tier)
        const isLow = preset === 'low' || (preset === 'auto' && tier === 'low');

        let scale = 1;

        if (isLow) {
            scale = 0.5; // Reduce resolution by half for low performance mode
        } else if (performanceManager.hardware.isMobile) {
            scale = 1;
        } else {
            scale = Math.min(window.devicePixelRatio, 1.5);
        }

        this.logicalWidth = window.innerWidth;
        this.logicalHeight = window.innerHeight;

        this.canvas.width = this.logicalWidth * scale;
        this.canvas.height = this.logicalHeight * scale;
        this.ctx.scale(scale, scale);

        // Adjust font size scaling if necessary, but here we keep it simple relative to logical pixels
        // The scale() call above handles the drawing coordinate space

        this.columns = Math.floor(this.logicalWidth / this.fontSize);
        this.drops = Array(this.columns).fill(1);

        // Optimize: Set font once on resize instead of every frame
        this.ctx.font = `${this.fontSize}px monospace`;
    }

    draw(currentTime = 0) {
        if (this.isActive) {
            this.animationId = requestAnimationFrame(this.draw);
        }
        
        // Control de FPS
        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed < this.frameInterval) {
            return;
        }
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

        // Semi-transparent black for trailing effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        this.ctx.fillRect(0, 0, this.logicalWidth || window.innerWidth, this.logicalHeight || window.innerHeight);

        // Green text
        this.ctx.fillStyle = '#39FF14';
        // Font is set in resize() to avoid parsing overhead every frame

        // Dibujar solo cada segunda columna para mejor rendimiento (excepto en Ultra)
        const step = (typeof performanceManager !== 'undefined' && performanceManager.currentPreset === 'ultra') ? 1 : 2;

        for (let i = 0; i < this.drops.length; i += step) {
            // Optimization: Use pre-calculated random buffer
            const charIdx = this.randomIndices[this.randomIndex];
            const text = this.charArray[charIdx];
            this.randomIndex = (this.randomIndex + 1) & 4095; // Fast modulus

            const x = i * this.fontSize;
            const y = this.drops[i] * this.fontSize;

            this.ctx.fillText(text, x, y);

            // Reset drop to top randomly
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }

            this.drops[i]++;
        }
    }

    start(force = false) {
        // Optimization: Don't start if Intro is active to save resources
        if (!force && typeof hyperIntro !== 'undefined' && hyperIntro.state.active) return;

        if (this.isActive) return;
        this.isActive = true;
        this.canvas.style.opacity = '0.15';
        this.draw();
    }

    stop() {
        this.isActive = false;
        this.canvas.style.opacity = '0';
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    toggle() {
        if (this.isActive) {
            this.stop();
            return false;
        } else {
            this.start();
            return true;
        }
    }
}

// ========== PARALLAX MANAGER ==========
class ParallaxManager {
    constructor() {
        this.layers = [];
        this.lastScrollY = 0;
        this.ticking = false;
    }

    init() {
        const layers = document.querySelectorAll('.parallax-layer');
        if (layers.length === 0) return;

        // Optimization: Pre-calculate speed and cache elements to avoid DOM access in loop
        this.items = Array.from(layers).map(layer => ({
            el: layer,
            speed: parseFloat(layer.dataset.speed) || 0.5
        }));

        // Optimization: Use passive listener to prevent blocking scroll
        window.addEventListener('scroll', () => this.requestTick(), { passive: true });
        
        // Register with performance manager
        performanceManager.registerEffect('parallax', this);
        
        // Apply initial state
        if (!performanceManager.effects.parallax) {
            this.items.forEach(item => item.el.style.display = 'none');
        }
        
        devLog('Parallax initialized with', this.items.length, 'layers');
    }

    requestTick() {
        // Optimization: Skip calculations if effect is disabled
        if (!performanceManager.effects.parallax) return;

        if (!this.ticking) {
            window.requestAnimationFrame(() => this.update());
            this.ticking = true;
        }
    }

    update() {
        this.lastScrollY = window.scrollY;
        
        this.items.forEach(item => {
            const yPos = -(this.lastScrollY * item.speed);
            item.el.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });

        this.ticking = false;
    }
}

// ========== CONTACT FORM MANAGER ==========
const SUBMIT_COOLDOWN_MS = 30000;

class ContactFormManager {
    constructor() {
        this.form = null;
        this.nameInput = null;
        this.emailInput = null;
        this.messageInput = null;
        this.submitBtn = null;
        this.statusDiv = null;
        this.lastSubmitTime = 0;
    }

    init() {
        this.form = document.querySelector('.contact-form');
        if (!this.form) return;

        this.nameInput = document.getElementById('contactName');
        this.emailInput = document.getElementById('contactEmail');
        this.messageInput = document.getElementById('contactMessage');
        this.honeypotInput = document.getElementById('contactWebsite');
        this.submitBtn = document.getElementById('submitBtn');
        this.statusDiv = document.getElementById('formStatus');

        this.attachListeners();
    }

    attachListeners() {
        // Real-time validation
        this.nameInput.addEventListener('blur', () => this.validateField(this.nameInput, 'name'));
        this.emailInput.addEventListener('blur', () => this.validateField(this.emailInput, 'email'));
        this.messageInput.addEventListener('blur', () => this.validateField(this.messageInput, 'message'));

        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Clear errors on input
        [this.nameInput, this.emailInput, this.messageInput].forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('error');
                const errorDiv = input.nextElementSibling;
                if (errorDiv && errorDiv.classList.contains('form-error')) {
                    errorDiv.classList.remove('show');
                    errorDiv.textContent = '';
                }
            });
        });
    }

    validateField(input, type) {
        const value = input.value.trim();
        const errorDiv = input.nextElementSibling;
        let error = '';

        switch(type) {
            case 'name':
                if (value.length < 2) error = 'ERROR: NAME_IDENTIFIER TOO SHORT';
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) error = 'ERROR: INVALID EMAIL_PROTOCOL';
                break;
            case 'message':
                if (value.length < 10) error = 'ERROR: MESSAGE_PAYLOAD INSUFFICIENT';
                break;
        }

        if (error) {
            input.classList.add('error');
            errorDiv.textContent = error;
            errorDiv.classList.add('show');
            audioManager.playSound('error');
            return false;
        }

        return true;
    }

    validateAll() {
        const nameValid = this.validateField(this.nameInput, 'name');
        const emailValid = this.validateField(this.emailInput, 'email');
        const messageValid = this.validateField(this.messageInput, 'message');
        return nameValid && emailValid && messageValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Anti-spam: honeypot check
        if (this.honeypotInput && this.honeypotInput.value) {
            this.showStatus('TRANSMISSION_SUCCESSFUL ✓', 'success');
            this.form.reset();
            return;
        }

        // Rate limiting: 30 seconds between submissions
        const now = Date.now();
        if (now - this.lastSubmitTime < SUBMIT_COOLDOWN_MS) {
            this.showStatus('RATE_LIMIT: WAIT BEFORE RETRANSMITTING', 'error');
            return;
        }

        if (!this.validateAll()) {
            this.showStatus('VALIDATION_ERROR: CHECK ALL FIELDS', 'error');
            return;
        }

        this.lastSubmitTime = now;

        this.submitBtn.disabled = true;
        this.submitBtn.classList.add('transmitting');
        this.showStatus('TRANSMITTING_DATA...', 'transmitting');

        const formData = {
            name: this.nameInput.value.trim(),
            email: this.emailInput.value.trim(),
            message: this.messageInput.value.trim(),
            timestamp: new Date().toISOString()
        };

        try {
            // Send to Formspree
            const response = await fetch('https://formspree.io/f/mgovdlpb', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            this.showStatus('TRANSMISSION_SUCCESSFUL ✓', 'success');
            audioManager.playSound('success');
            notificationManager.show('Message transmitted successfully!', 'success');
            this.form.reset();
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showStatus('TRANSMISSION_FAILED: TRY AGAIN', 'error');
            audioManager.playSound('error');
            notificationManager.show('Transmission error. Please retry.', 'error');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.classList.remove('transmitting');
        }
    }

    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = 'form-status show ' + type;
        
        setTimeout(() => {
            this.statusDiv.classList.remove('show');
        }, 5000);
    }
}

// ========== BURGER MENU MANAGER ==========
class BurgerMenuManager {
    constructor() {
        this.panel = null;
        this.closeBtn = null;
        this.docks = [];
        this.isOpen = false;
    }

    init() {
        this.panel = document.getElementById('settingsPanel');
        this.closeBtn = document.getElementById('settingsClose');
        this.docks = document.querySelectorAll('.control-dock');

        if (!this.panel || this.docks.length === 0) return;        this.docks.forEach(dock => {
            // Note: .settings-toggle-btn and deco clicks are handled exclusively by DockManager
            // to avoid double-firing. BurgerMenuManager.toggleDock() is called from DockManager.

            // Toggle dock on click on dock background (not a button)
            dock.addEventListener('click', (e) => {
                if (e.target.closest('.dock-btn')) return;
                this.toggleDock(dock);
            });
        });

        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.panel.contains(e.target) && !e.target.closest('.settings-toggle-btn') && !e.target.closest('.config-open-btn')) {
                this.close();
            }
        });
    }

    handleBurgerClick(e, dock) {
        e.stopPropagation();
        const isCollapsed = dock.classList.contains('collapsed');
        
        if (!this.isOpen && isCollapsed) {
            this.expandDock(dock);
        } else {
            this.toggle();
        }
    }    toggleDock(dock) {
        if (dock.classList.contains('collapsed')) {
            this.expandDock(dock);
        } else {
            // If settings panel is open, close it first
            if (this.isOpen) this.close();
            this.collapseDock(dock);
        }
    }

    expandDock(dock) {
        dock.classList.remove('collapsed');
        dock.dataset.expanded = 'true';
        audioManager.playSound('click');
    }

    collapseDock(dock) {
        if (!this.isOpen) {
            dock.classList.add('collapsed');
            dock.dataset.expanded = 'false';
            audioManager.playSound('click');
        }
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }    open() {
        this.docks.forEach(dock => this.expandDock(dock));
        this.panel.classList.add('active');
        document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
        });
        document.querySelectorAll('.config-open-btn').forEach(btn => {
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
        });
        this.isOpen = true;
        
        setTimeout(() => {
            this.docks.forEach(dock => dock.classList.add('hidden'));
        }, 100);
        
        audioManager.playSound('click');
    }

    close() {
        this.panel.classList.remove('active');
        document.querySelectorAll('.settings-toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        });
        document.querySelectorAll('.config-open-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        });
        this.isOpen = false;
        this.docks.forEach(dock => dock.classList.remove('hidden'));
        audioManager.playSound('click');
    }
}

// ========== LANGUAGE MANAGER ==========
class LanguageManager {
    constructor() {
        this.currentLang = 'es';
    }

    init() {
        // Dock buttons
        document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newLang = this.currentLang === 'es' ? 'en' : 'es';
                this.switchLanguage(newLang);
            });
        });

        // Settings panel buttons
        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchLanguage(btn.dataset.lang);
            });
        });

        const saved = localStorage.getItem('language');
        if (saved) this.switchLanguage(saved);
    }

    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('language', lang);

        document.querySelectorAll('.lang-toggle-btn .lang-text').forEach(el => {
            el.textContent = lang.toUpperCase();
        });

        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        document.querySelectorAll('[data-en]').forEach(el => {
            el.textContent = el.dataset[lang] || el.dataset.en;
        });

        audioManager.playSound('click');
    }
}

// ========== SETTINGS MANAGER ==========
class SettingsManager {
    constructor() {
        // No need for these properties anymore as we query all buttons directly
    }    init() {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTheme();
            });
        });

        // Audio buttons are handled exclusively by DockManager to prevent double-fire.
        // SettingsManager only updates the button UI state.
        
        this.updateThemeButton();
        this.updateAudioButton();
    }

    toggleTheme() {
        themeManager.handleToggle({});
        this.updateThemeButton();
        audioManager.playSound('click');
    }

    updateThemeButton() {
        const isDark = themeManager.theme === 'dark';
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('.theme-icon') || btn.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fa-solid fa-moon theme-icon' : 'fa-solid fa-sun theme-icon';
            }
        });
    }

    async toggleAudio() {
        if (audioManager.bgMusic && !audioManager.bgMusic.paused) {
            audioManager.stopBackgroundMusic();
            this.updateAudioButton(false);
        } else {
            await audioManager.playBackgroundMusic(0.3);
            this.updateAudioButton(true);
        }
        audioManager.playSound('click');
    }

    updateAudioButton(isPlaying = null) {
        const playing = isPlaying !== null ? isPlaying : (audioManager.bgMusic && !audioManager.bgMusic.paused);
        document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('.audio-icon') || btn.querySelector('i');
            if (icon) {
                icon.className = playing ? 'fa-solid fa-volume-high audio-icon' : 'fa-solid fa-volume-xmark audio-icon';
            }
            btn.classList.toggle('active', playing);
        });
    }
}

// ========== PROJECT LIGHTBOX MANAGER ==========
class ProjectLightboxManager {
    constructor() {
        this.lightbox = null;
        this.image = null;
        this.closeBtn = null;
    }

    init() {
        this.lightbox = document.getElementById('projectLightbox');
        this.image = document.getElementById('lightboxImage');
        this.closeBtn = document.getElementById('lightboxClose');

        if (!this.lightbox) return;

        this.closeBtn.addEventListener('click', () => this.close());
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) this.close();
        });

        // Add click handlers to project images
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('project-image')) {
                this.open(e.target.src);
            }
        });
    }

    open(src) {
        this.image.src = src;
        this.lightbox.classList.add('active');
        document.body.classList.add('no-scroll');
        audioManager.playSound('click');
    }

    close() {
        this.lightbox.classList.remove('active');
        document.body.classList.remove('no-scroll');
        audioManager.playSound('click');
    }
}

// ========== PROJECT DATA MANAGER ==========
const projectsData = [
    {
        id: '01',
        title: 'CREHA_BITACORA',
        category: 'unity',
        description: 'Juego educativo sobre corredores biologicos',
        image: ASSET_PATH + 'projects/crehabitat.webp',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/crehabitat'
    },
    {
        id: '02',
        title: 'CANDY_PARTY',
        category: 'unity',
        description: 'Juego de fiesta con temática de dulces.',
        image: ASSET_PATH + 'projects/candyparty.webp',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/candy-party'
    },
    {
        id: '03',
        title: 'SHAPE_KISSER',
        category: 'unity',
        description: 'Juego de puzzle con temática de formas geométricas.',
        image: 'https://img.itch.zone/aW1nLzQyMzU1MDUucG5n/347x500/SM7ekS.png',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/shapekisser'
    },
    {
        id: '04',
        title: 'DETECTOR_CAMERA',
        category: 'web',
        description: 'Detector de postura con Mediapipe.',
        image: ASSET_PATH + 'projects/mediapipe.webp',
        tech: ['HTML', 'CSS', 'JS', 'MEDIAPIPE'],
        link: 'https://desarrolladorvr.github.io/'
    },
    {
        id: '04',
        title: 'PORTAL_JUEGOS',
        category: 'web',
        description: 'Portal Web de Juegos Educativos.',
        image: ASSET_PATH + 'projects/IstGames.webp',
        tech: ['HTML', 'CSS', 'JS'],
        link: 'https://istgames.netlify.app/'
    },
    {
        id: '05',
        title: 'METAVERSE_AVATAR',
        category: '3d',
        description: 'High-fidelity avatar system with facial tracking.',
        image: 'https://placehold.co/600x400/111/39FF14?text=METAVERSE',
        tech: ['BLENDER', 'UNITY', 'LIP_SYNC'],
        link: '#'
    },
    {
        id: '06',
        title: 'WEBGL_PORTFOLIO',
        category: 'web',
        description: 'Immersive 3D portfolio using Three.js.',
        image: 'https://placehold.co/600x400/111/39FF14?text=WEBGL',
        tech: ['THREE.JS', 'REACT', 'WEBGL'],
        link: '#'
    },
    {
        id: '07',
        title: 'DARALI_DEVEL',
        category: 'unreal',
        description: 'Horror game development project.',
        image: 'https://img.itch.zone/aW1hZ2UvMzEzNzgyMi8xOTA2NjM0OC5qcGc=/original/%2Bw3lwe.jpg',
        tech: ['UNREAL_ENGINE', 'C++', 'HORROR'],
        link: 'https://corejeux.itch.io/darali-devel'
    },
    {
        id: '08',
        title: 'UNITY_OPTIMIZER',
        category: '3d',
        description: 'Suite Open Source para gestión de assets. Reduce tiempos de importación en un 40%. Valoración 4.8/5.',
        image: 'https://placehold.co/600x400/111/39FF14?text=TOOLS',
        tech: ['TOOLING', 'C#', 'EDITOR_SCRIPTING'],
        link: 'https://github.com/kaitoartz'
    }
];

class ProjectManager {
    constructor() {
        this.container = document.getElementById('projectsGrid');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.activeFilter = 'all';
    }

    init() {
        if (!this.container) return;

        // Render all projects initially
        this.renderProjects(projectsData);

        // Setup Filters
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.setFilter(filter);

                // Update active state
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                audioManager.playClick();
            });
        });
    }

    renderProjects(projects) {
        this.container.innerHTML = projects.map((proj, index) => `
            <div class="project-card" data-category="${proj.category}" style="animation-delay: ${index * 100}ms">
                <div class="project-image-container">
                    <img src="${proj.image}" 
                         alt="${proj.title}" 
                         class="project-image" 
                         loading="lazy" 
                         decoding="async"
                         onerror="this.src='https://placehold.co/600x400/111/39FF14?text=NO_IMG'">
                    <div class="project-overlay">
                        <button class="view-project-btn" onclick="audioManager.playClick(); window.open('${proj.link}', '_blank')">VIEW_DATA</button>
                    </div>
                </div>
                <div class="project-info">
                    <div class="project-header">
                        <span class="project-id">ID_${proj.id}</span>
                        <span class="project-category">${proj.category.toUpperCase()}</span>
                    </div>
                    <h3 class="project-title">${proj.title}</h3>
                    <p class="project-desc">${proj.description}</p>
                    <div class="project-tech">
                        ${proj.tech.map(t => `<span>${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    setFilter(filter) {
        this.activeFilter = filter;

        // Animate out
        const cards = Array.from(this.container.children);
        cards.forEach(card => card.classList.add('filtering-out'));

        setTimeout(() => {
            const filtered = filter === 'all'
                ? projectsData
                : projectsData.filter(p => p.category === filter);

            this.renderProjects(filtered);
        }, 300);
    }
}

// ========== VIDEO MANAGER ==========
class VideoManager {
    constructor() {
        this.modal = null;
        this.iframe = null;
        this.videoId = '1157471071'; 
        this.videoHash = 'c3e7f59c16';
    }

    init() {
        this.modal = document.getElementById('videoModal');
        this.iframe = document.getElementById('vimeoPlayer');
        if (!this.modal || !this.iframe) return;

        const btn = document.getElementById('vrVideoBtn');
        const closeBtn = document.getElementById('videoClose');

        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    open() {
        this.modal.classList.add('active');
        document.body.classList.add('no-scroll');
        if (typeof audioManager !== 'undefined') audioManager.playSuccess();
        
        const loader = document.getElementById('videoLoading');
        const statusText = document.getElementById('videoStatus');
        
        // Reset Loader State
        if (loader) loader.style.display = 'flex';
        if (statusText) statusText.innerText = "INITIALIZING...";

        // Check Connection
        if (!navigator.onLine) {
             if (statusText) statusText.innerText = "OFFLINE // DATA_UNAVAILABLE";
             // Optional: Don't load iframe if offline to save resources/errors
             return;
        }

        // Include the hash parameter for unlisted videos
        this.iframe.src = `https://player.vimeo.com/video/${this.videoId}?h=${this.videoHash}&autoplay=1&title=0&byline=0&portrait=0`;
        
        // Timeout for slow connection feedback
        this.loadTimeout = setTimeout(() => {
            if (loader && loader.style.display !== 'none') {
                if (statusText) statusText.innerText = "WARN: SLOW CONNECTION...";
            }
        }, 5000);

        // Real Load Event
        this.iframe.onload = () => {
            clearTimeout(this.loadTimeout);
            // Small buffer to ensure visual smoothness
            setTimeout(() => {
                if (loader) loader.style.display = 'none';
            }, 500);
        };
    }

    close() {
        this.modal.classList.remove('active');
        this.iframe.src = '';
        document.body.classList.remove('no-scroll');
        if (typeof audioManager !== 'undefined') audioManager.playHover();
    }
}
const videoManager = new VideoManager();

// ========== SCROLL REVEAL MANAGER ==========
class ScrollRevealManager {
    constructor() {
        this.observer = null;
        this.elements = [];
    }

    init() {
        this.elements = document.querySelectorAll('.grid-item');
        
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal');
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);

        this.elements.forEach(el => this.observer.observe(el));
        console.log('Scroll Reveal initialized with', this.elements.length, 'elements');
    }
}

const skillsManager = new SkillsManager();
const projectManager = new ProjectManager(); // Fixed name
const notificationManager = new NotificationManager();
const audioVisualizer = new AudioVisualizer();
const timelineManager = new TimelineManager();
const matrixRain = new MatrixRain();
const parallaxManager = new ParallaxManager();
const contactFormManager = new ContactFormManager();
const burgerMenuManager = new BurgerMenuManager();
const languageManager = new LanguageManager();
const settingsManager = new SettingsManager();
const projectLightboxManager = new ProjectLightboxManager();
// const projectFiltersManager = new ProjectFiltersManager(); // Removed
const scrollRevealManager = new ScrollRevealManager();

document.addEventListener('DOMContentLoaded', () => {
    devLog('%c>> DOM: Ready', 'color: #39FF14; font-family: monospace;');
    
    // Initialize Performance Manager first (Critical for deciding other inits)
    performanceManager.init();
    devLog('%c>> INIT: Performance Manager ✓', 'color: #39FF14; font-family: monospace;');
    
    // Critical UI systems - Init immediately
    burgerMenuManager.init();
    settingsManager.init();
    languageManager.init();
    contactFormManager.init();
    projectManager.init();

    // Deferred initialization for heavy/non-critical systems
    const initDeferredSystems = () => {
        try {
            // UI Interactive elements
            volumeController.init();
            terminal.init();
            shortcutsManager.init();
            awardsManager.init();
            videoManager.init();
            projectLightboxManager.init();
            notificationManager.init();
            timelineManager.init();
            skillsManager.init();
            scrollRevealManager.init();

            // Heavy Visuals
            if (window.innerWidth > 767) {
                cursorManager.init();
                performanceManager.registerEffect('cursor', cursorManager);
            }
            
            technicalBackground.init();
            parallaxManager.init();
            matrixRain.init();
            
            devLog('%c>> SYSTEM: Deferred modules loaded ✓', 'color: #39FF14; font-weight: bold; font-family: monospace;');
            
            // Terminal button
            const terminalButton = document.getElementById('terminalButton');
            if (terminalButton) {
                terminalButton.addEventListener('click', () => terminal.open());
            }

            // Welcome notification
            setTimeout(() => {
                if (document.querySelector('.dashboard')?.classList.contains('visible')) {
                    const presetName = performanceManager.currentPreset.toUpperCase();
                    const tier = performanceManager.hardware.tier.toUpperCase();
                    notificationManager.success(
                        'SYSTEM_ONLINE', 
                        `Performance preset: ${presetName} | Hardware tier: ${tier}`
                    );
                }
            }, 2000);

        } catch (error) {
            console.error('%c>> ERROR: Deferred init failed', 'color: #FF6B6B; font-family: monospace;', error);
        }
    };

    // Use requestIdleCallback if available, otherwise fallback to setTimeout
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => initDeferredSystems(), { timeout: 2000 });
    } else {
        setTimeout(initDeferredSystems, 200);
    }
});
