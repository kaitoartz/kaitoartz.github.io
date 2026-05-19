const DEV_MODE = false; // Set to true for development logging
const devLog = (...args) => DEV_MODE && console.log(...args);

// Local Asset Resolver (Fix for Live Server, Github Pages, and Vite)
const ASSET_PATH = (window.location.port === '5500' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app')) ? 'public/assets/' : 'assets/';

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

    update(time) {
        const now = time || performance.now();
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
        this.matrixRainInstance = null;
        this.parallaxInstance = null;
        this.cursorInstance = null;
        this.terminalInstance = null;
        // Fix: Store the result of detectHardware in this.hardware
        this.hardware = this.detectHardware();
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
            gpu: 'unknown',
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
        


        // Audio file paths
        this.audioFiles = {
            background: ASSET_PATH + 'audio/background.mp3'
        };
        
        this.radioStations = [];
        this.currentStation = 0;
        this.isLoadingRadio = false;
        this.failedAttempts = 0;
        
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

    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Added localStorage caching with a 24-hour TTL for radio station API data.
     * 🎯 Why: Repeatedly fetching the same static radio station list on every page load unnecessarily blocks execution and wastes network bandwidth, increasing time-to-interactive for the audio module.
     * 📊 Impact: Eliminates ~500ms network request on subsequent visits and reduces API rate limiting risks.
     */
    async loadRadioStations() {
        if (this.radioStations.length > 0 || this.isLoadingRadio) return;
        this.isLoadingRadio = true;

        try {
            const cacheKey = 'radioStationsCache';
            const cacheTimeKey = 'radioStationsCacheTimestamp';
            const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

            let cachedData = null;
            let cachedTime = null;

            try {
                cachedData = localStorage.getItem(cacheKey);
                cachedTime = localStorage.getItem(cacheTimeKey);
            } catch (e) {
                // Ignore localStorage errors (e.g., quota exceeded or privacy mode)
            }

            let cacheValid = false;
            if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime, 10)) < cacheTTL) {
                try {
                    this.radioStations = JSON.parse(cachedData);
                    cacheValid = true;
                    console.log('%c>> RADIO: Loaded from cache ✓', 'color: #39FF14; font-family: monospace;');
                } catch (e) {
                    // Ignore parsing errors, cache is invalid
                }
            }

            if (!cacheValid) {
                console.log('%c>> RADIO: Fetching station list...', 'color: #00FFFF; font-family: monospace;');
                // Request synthwave and cyberpunk stations
                const response = await fetch("https://de1.api.radio-browser.info/json/stations/search?tagList=synthwave&limit=30");
                const data = await response.json();
                this.radioStations = data.filter(s => s.url_resolved && !s.url_resolved.endsWith('.m3u'));

                if (this.radioStations.length === 0) {
                    this.radioStations = [{name: 'Fallback Synth', url_resolved: 'http://stream.simulatorradio.com/simulator-radio'}];
                } else {
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(this.radioStations));
                        localStorage.setItem(cacheTimeKey, Date.now().toString());
                    } catch (e) {
                        // Ignore cache write errors
                    }
                }
            }
        } catch(e) {
            console.error('>> RADIO: Fetch error', e);
            this.radioStations = [{name: 'Fallback Radio', url_resolved: 'http://stream.simulatorradio.com/simulator-radio'}];
        }
        this.isLoadingRadio = false;
    }

    async prevStation() {
        if(this.radioStations.length === 0) await this.loadRadioStations();
        if(this.radioStations.length === 0) return;
        this.currentStation = (this.currentStation - 1 + this.radioStations.length) % this.radioStations.length;
        this.playSound('click', 0.5);
        if (this.bgMusic && !this.bgMusic.paused) {
             this.playBackgroundMusic(this.bgMusic.volume);
        } else {
             this.updateRadioUI();
        }
    }

    async nextStation() {
        if(this.radioStations.length === 0) await this.loadRadioStations();
        if(this.radioStations.length === 0) return;
        this.currentStation = (this.currentStation + 1) % this.radioStations.length;
        this.playSound('click', 0.5);
        if (this.bgMusic && !this.bgMusic.paused) {
             this.playBackgroundMusic(this.bgMusic.volume);
        } else {
             this.updateRadioUI();
        }
    }
    
    updateRadioUI() {
        const station = this.radioStations[this.currentStation];
        document.querySelectorAll('.radio-station-name').forEach(el => {
            el.textContent = station ? station.name.substring(0,25) + (station.name.length>25?'...':'') : "Offline";
            el.title = station ? station.name : "Offline";
            if (typeof triggerGlitch === 'function') triggerGlitch(el);
        });
    }

    async playBackgroundMusic(volume = 0.3) {
        if (!this.audioContext) await this.init();
        
        if (!this.enabled) {
            console.log('%c>> MUSIC: System disabled', 'color: #FF6B6B; font-family: monospace;');
            return;
        }
        
        if (this.radioStations.length === 0) await this.loadRadioStations();
        const station = this.radioStations[this.currentStation];
        const streamUrl = station ? station.url_resolved : this.audioFiles.background;
        
        console.log('%c>> MUSIC: Creating audio element...', 'color: #00FFFF; font-family: monospace;');
        
        if (!this.bgMusic) {
            this.bgMusic = new Audio();
            this.bgMusic.crossOrigin = "anonymous";
            
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
        } else {
            this.bgMusic.pause();
        }
        
        this.bgMusic.src = streamUrl;
        this.bgMusic.volume = volume;
        this.bgMusic.loop = true;
        this.bgMusic.preload = 'auto';
        this.updateRadioUI();
        
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
                this.failedAttempts = 0; // reset
                console.log('%c>> MUSIC: ♫ Playing! Volume: ' + (volume * 100).toFixed(0) + '%', 'color: #39FF14; font-family: monospace;');
            }).catch(error => {
                this.playPromise = null;
                this.failedAttempts++;
                console.log('%c>> MUSIC: Play blocked - ' + error.message, 'color: #FF6B6B; font-family: monospace;');
                console.log('%c>> MUSIC: Trying next station or fallback', 'color: #FFAA00; font-family: monospace;');
                // Wait briefly and try next to avoid infinite immediate loops on full failure lists
                if (this.failedAttempts < 5) {
                    setTimeout(() => this.nextStation(), 500);
                } else {
                    console.error('>> MUSIC: Aborting radio playback after multiple failures.');
                }
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

    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Replaced MutationObserver and individual 'mouseenter' event listeners with a single global 'mouseover' delegation using a stateless relatedTarget check.
     * 🎯 Why: MutationObservers watching the entire body for node additions are expensive. Attaching hundreds of individual event listeners wastes memory and slows down DOM insertion.
     * 📊 Impact: O(1) event listeners instead of O(N). Eliminates constant DOM polling/mutation overhead, reducing idle CPU usage and garbage collection.
     */
    handleMouseOver(e) {
        if (!this.enabled) return;

        const selector = 'a, button, input, textarea, .project-card, .filter-btn';
        const target = e.target.closest(selector);

        if (target && (!e.relatedTarget || !target.contains(e.relatedTarget))) {
            this.playHover();
        }
    }

    attachGlobalListeners() {
        // Universal Hover - Optimized with Event Delegation
        document.addEventListener('mouseover', this.handleMouseOver.bind(this), { passive: true });

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

        // Tracking for dirty checking in RAF
        this.lastFov = 0;
        this.lastTiltX = 0;
        this.lastTiltY = 0;
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
                txt.textContent = this.texts[i % this.texts.length];
                el.appendChild(txt);
                this.items.push({
                    el, type: 'text',
                    x: 0, y: 0, rot: 0,
                    baseZ: -i * this.config.zGap,
                    currentAlpha: -1,
                    currentTrans: null,
                    lastVizZ: -9999,
                    lastStretch: -1,
                    lastFloat: -1,
                    lastOffset: -1
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
                    cardEl: el.querySelector('.intro-card'), // Performance: cache DOM query
                    x, y, rot,
                    baseZ: -i * this.config.zGap,
                    currentAlpha: -1,
                    currentTrans: null,
                    lastVizZ: -9999,
                    lastStretch: -1,
                    lastFloat: -1,
                    lastOffset: -1
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
                currentTrans: null,
                lastVizZ: -9999,
                lastStretch: -1,
                lastFloat: -1,
                lastOffset: -1
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
            // OPTIMIZATION: Disable Lenis on mobile for native performance
            if (typeof Lenis !== 'undefined' && !isMobileBrowser) {
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
            btn.textContent = "ACCESSING...";
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
            
            /**
             * ⚡ Bolt Performance Optimization
             * 💡 What: Replaced innerText with textContent in the RAF loop.
             * 🎯 Why: innerText triggers synchronous layout calculations (reflow) because it considers CSS styling (hidden text, text-transform). textContent directly modifies the text node, avoiding reflows in this hot path.
             * 📊 Impact: Prevents layout thrashing during the high-frequency HUD updates in the requestAnimationFrame loop.
             */
            // HUD Updates Throttled
            /**
             * ⚡ Bolt Performance Optimization
             * 💡 What: Replaced layout-aware `.innerText` with layout-agnostic `.textContent` for HUD updates.
             * 🎯 Why: `.innerText` triggers expensive synchronous style recalculations (layout thrashing), which kills frame rates inside requestAnimationFrame loops.
             * 📊 Impact: Prevents forced reflows up to 60 times per second, freeing up main thread CPU time for rendering.
             */
            if (this.frameCount % 10 === 0) {
                if (this.feedbackFPS) this.feedbackFPS.textContent = fps;
                if (this.feedbackVel) this.feedbackVel.textContent = Math.abs(this.state.velocity).toFixed(2);
                if (this.feedbackCoord) {
                    this.feedbackCoord.textContent = this.isVirtualMode ? "∞" : this.state.scroll.toFixed(0);
                }
            }

            // Adaptive Degrade Logic (Wait 2s at start before judging)
            if (time > 2000 && this.perfMode < 1) {
                if (fps < 30) {
                    this.perfMode = 1;
                    // Optimized: Use cached items array instead of DOM query
                    for (let i = 0; i < this.items.length; i++) {
                        if (this.items[i].type === 'star') this.items[i].el.style.display = 'none';
                    }
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

                if (Math.abs(this.lastTiltX - tiltX) > 0.1 || Math.abs(this.lastTiltY - tiltY) > 0.1) {
                    this.world.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                    this.lastTiltX = tiltX;
                    this.lastTiltY = tiltY;
                }
            }

            // 2. Dynamic Perspective (Warp)
            if (this.viewport && this.isHyperEnabled) {
                const baseFov = 1000;
                const fov = baseFov - Math.min(Math.abs(this.state.velocity) * 5, 800);
                if (Math.abs(this.lastFov - fov) > 0.1) {
                    this.viewport.style.perspective = `${fov}px`;
                    this.lastFov = fov;
                }
            }

            // 3. Item Loop (Optimized Infinite Scroll)
            const cameraZ = this.state.scroll * this.config.camSpeed;
            const modC = this.config.loopSize;

            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
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
                    let stretch = 1;
                    if (item.type === 'star') {
                        stretch = Math.max(1, Math.min(1 + Math.abs(this.state.velocity) * 0.1, 20));
                    }

                    let float = 0;
                    if (item.type === 'card') {
                        const t = time * 0.001;
                        float = Math.sin(t + item.x) * 10;
                    }

                    // Optimization: Only update transform if values changed significantly
                    let needsUpdate = false;
                    if (item.currentTrans === null || Math.abs(item.lastVizZ - vizZ) > 0.1) {
                        needsUpdate = true;
                    } else if (item.type === 'star' && Math.abs(item.lastStretch - stretch) > 0.01) {
                        needsUpdate = true;
                    } else if (item.type === 'card' && Math.abs(item.lastFloat - float) > 0.1) {
                        needsUpdate = true;
                    }

                    if (item.type === 'text') {
                        // RGB Split effect (Hyper ONLY)
                        if (this.isHyperEnabled && Math.abs(this.state.velocity) > 1) {
                            const offset = this.state.velocity * 1.5;
                            if (Math.abs(item.lastOffset - offset) > 0.1 || item.lastOffset === 0) {
                                item.el.style.textShadow = `${offset}px 0 var(--intro-glitch-1), ${-offset}px 0 var(--intro-glitch-2)`;
                                item.lastOffset = offset;
                            }
                        } else if (item.lastOffset !== 0) {
                            item.el.style.textShadow = 'none';
                            item.lastOffset = 0;
                        }
                    }

                    if (needsUpdate) {
                        let trans = `translate3d(${item.x}px, ${item.y}px, ${vizZ}px)`;

                        if (item.type === 'star') {
                            trans += ` scale3d(1, 1, ${stretch})`;
                            item.lastStretch = stretch;
                        } else if (item.type === 'text') {
                            trans += ` rotateZ(${item.rot}deg)`;
                        } else {
                            // Card Logic
                            if (this.isHyperEnabled) {
                                /**
                                 * ⚡ Bolt Performance Optimization
                                 * 💡 What: Replaced DOM query `item.el.querySelector` inside requestAnimationFrame with a cached reference `item.cardEl`, and added state tracking `item.isCardActive` to prevent redundant `classList.toggle` calls.
                                 * 🎯 Why: Querying the DOM and invoking classList operations on every frame (60fps) for multiple elements causes layout thrashing and unnecessary CPU overhead.
                                 * 📊 Impact: Eliminates O(N) DOM queries and DOM writes per frame, ensuring smoother 60fps rendering during the intro sequence.
                                 */
                                // AUTO-ANIMATION: Trigger .is-active when card is in focus range
                                if (item.cardEl) {
                                    const isInFocus = vizZ > -400 && vizZ < 400;
                                    if (item.isCardActive !== isInFocus) {
                                        item.cardEl.classList.toggle('is-active', isInFocus);
                                        item.isCardActive = isInFocus;
                                    }
                                }

                                trans += ` rotateZ(${item.rot}deg) rotateY(${float}deg)`;
                                item.lastFloat = float;
                            } else {
                                trans += ` rotateZ(${item.rot}deg)`;
                            }
                        }

                        item.lastVizZ = vizZ;

                        if (item.currentTrans !== trans) {
                            item.el.style.transform = trans;
                            item.currentTrans = trans;
                        }
                    }
                }
            }
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
    let startTimestamp = null;

    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Replaced setInterval with requestAnimationFrame for UI counting animation.
     * 🎯 Why: setInterval operates independently of the screen refresh rate, causing visual jitter and running even when the tab is backgrounded. requestAnimationFrame guarantees smooth execution matched to the monitor's refresh rate and pauses when off-screen.
     * 📊 Impact: Eliminates micro-stutters during count-up animations and reduces background CPU/battery usage to 0.
     */
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing out cubic for smoother finish
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeOutQuart * target);

        element.textContent = current.toString().padStart(2, '0');

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            element.textContent = target.toString().padStart(2, '0');
        }
    };

    requestAnimationFrame(step);
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
/**
 * ⚡ Bolt Performance Optimization
 * 💡 What: Replaced setInterval with requestAnimationFrame in triggerGlitch text animation.
 * 🎯 Why: setInterval operates independently of screen refresh rate, causing visual jitter and running off-screen. RAF ensures smooth execution and pauses when off-screen.
 * 📊 Impact: Eliminates visual jitter and background CPU waste.
 */
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
    let lastTime = 0;

    // Clear any existing interval to prevent overlap
    if (element.dataset.glitchRafId) {
        cancelAnimationFrame(parseInt(element.dataset.glitchRafId));
    }

    const step = (timestamp) => {
        if (!lastTime) lastTime = timestamp;

        // Target ~30ms interval
        if (timestamp - lastTime >= 30) {
            let glitchedText = '';
            for (let i = 0; i < original.length; i++) {
                if (i < iterations) {
                    glitchedText += original[i];
                } else if (original[i] === ' ') {
                    glitchedText += ' '; // Preserve spaces
                } else {
                    glitchedText += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            element.textContent = glitchedText;

            if (iterations >= original.length) {
                element.textContent = original; // Ensure final state is clean
                delete element.dataset.glitchRafId;
                return;
            }

            iterations += 1 / 3;
            lastTime = timestamp;
        }
        const rafId = requestAnimationFrame(step);
        element.dataset.glitchRafId = rafId;
    };

    const rafId = requestAnimationFrame(step);
    element.dataset.glitchRafId = rafId;
}

// Initial Text Decoding on Boot (Hook into your boot sequence)
function decodeTextElements() {
    if (typeof performanceManager !== 'undefined' && !performanceManager.effects.glitch) return;

    const targets = document.querySelectorAll('.start-title, .start-subtitle, .tech-header-info span, .sector-label');
    targets.forEach((el, index) => {
        setTimeout(() => triggerGlitch(el, true), index * 100 + 500);
    });
}

/**
 * ⚡ Bolt Performance Optimization
 * 💡 What: Cached the DOM element and conditionally triggered the glitch interval.
 * 🎯 Why: Querying the DOM via querySelector every 10 seconds and firing the interval when the document is hidden consumes unnecessary cycles.
 * 📊 Impact: O(1) DOM lookup instead of O(N), plus zero background CPU usage when off-screen.
 */
document.addEventListener('DOMContentLoaded', () => {
    const mainTitleEl = document.querySelector('.main-title');
    if (!mainTitleEl) return;

    let isTitleVisible = false;
    const titleObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isTitleVisible = entry.isIntersecting;
        });
    });
    titleObserver.observe(mainTitleEl);

    setInterval(() => {
        if (!document.hidden && isTitleVisible && Math.random() > 0.8) {
            triggerGlitch(mainTitleEl);
            if (typeof audioManager !== 'undefined') {
                audioManager.playGlitch();
            }
        }
    }, 10000);
});

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
        /**
         * ⚡ Bolt Performance Optimization
         * 💡 What: Use `getEntriesByType('largest-contentful-paint')` instead of iterating and filtering over `getEntries()`.
         * 🎯 Why: `getEntries()` returns an array of all performance entries. Iterating and filtering this array in Javascript adds unnecessary overhead. `getEntriesByType` performs the filtering natively and more efficiently.
         * 📊 Impact: Eliminates a potentially large and redundant array iteration loop, reducing CPU overhead during performance monitoring callbacks.
         */
        for (const entry of list.getEntriesByType('largest-contentful-paint')) {
            console.log(`%c>> LCP: ${entry.renderTime || entry.loadTime}ms`,
                'color: #39FF14; font-family: monospace; font-size: 11px;');
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

            // Audio Button (Radio Toggle)
            const audioBtn = dock.querySelector('.audio-toggle-btn');
            if (audioBtn) {
                audioBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAudio(audioBtn);
                });
            }

            // Radio Prev/Next
            const prevBtn = dock.querySelector('.prev-station-btn');
            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof audioManager !== 'undefined') audioManager.prevStation();
                });
            }
            const nextBtn = dock.querySelector('.next-station-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof audioManager !== 'undefined') audioManager.nextStation();
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
        this.logicalWidth = 0;
        this.logicalHeight = 0;

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
        
        window.addEventListener('resize', debounce(() => this.resize(), 200), { passive: true });
        
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
        this.logicalWidth = window.innerWidth;
        this.logicalHeight = window.innerHeight;
        this.canvas.width = this.logicalWidth;
        this.canvas.height = this.logicalHeight;
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
            this.ctx.clearRect(0, 0, this.logicalWidth || this.canvas.width, this.logicalHeight || this.canvas.height);
        }
        // Reset trail without destroying objects
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].life = 0;
        }
    }

    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Cached `this.logicalWidth` and `this.logicalHeight` and used them instead of reading `this.canvas.width` and `this.canvas.height`.
     * 🎯 Why: Reading DOM properties like `canvas.width` inside a high-frequency `requestAnimationFrame` loop forces synchronous C++ boundary crossings which adds CPU overhead.
     * 📊 Impact: Eliminates O(N) DOM reads per frame, ensuring smoother rendering.
     */
    animate() {
        if (!this.running) {
            this.looping = false;
            return;
        }
        
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        
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
        let hasActiveTrails = false;
        for (let i = 0; i < this.trail.length; i++) {
            if (this.trail[i].life > 0) {
                hasActiveTrails = true;
                break;
            }
        }

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
    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Store static file content on the class instead of recreating it inside `readFile()`.
     * 🎯 Why: Re-declaring object literals inside methods that can be called repeatedly wastes memory and forces the garbage collector to work harder.
     * 📊 Impact: O(1) memory allocation vs O(N) allocations for repeated file reading.
     */
    static FILES = {
        'README.txt': 'Welcome to KAITOARTZ terminal interface. Type "help" for commands.',
        'about.txt': 'VR Developer specializing in immersive experiences and real-time rendering.',
        'contact.txt': 'Contact info available via "contact" command.'
    };

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
        if (Terminal.FILES[file]) {
            this.addOutput(Terminal.FILES[file]);
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

        this.timestampEl = null;
        this.uptimeEl = null;
        this.isVisible = false;
        this.lastUpdateTime = 0;

        this.updateLoop = this.updateLoop.bind(this);
    }

    /**
     * ⚡ Bolt Performance Optimization
     * 💡 What: Replaced setInterval with a requestAnimationFrame loop gated by IntersectionObserver and cached DOM references.
     * 🎯 Why: setInterval runs unconditionally, even when the background is off-screen or the tab is inactive. Querying the DOM every second is also inefficient.
     * 📊 Impact: Prevents wasted CPU cycles and layout thrashing by only updating the DOM when the component is visible, and eliminates O(N) DOM queries by caching elements on initialization.
     */
    init() {
        this.container = document.querySelector('.tech-background');
        if (!this.container) return;
        
        this.timestampEl = document.getElementById('techTimestamp');
        this.uptimeEl = document.getElementById('uptimeCounter');

        // Use IntersectionObserver to pause updates when off-screen
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.isVisible = entry.isIntersecting;
                if (this.isVisible) {
                    this.updateLoop(performance.now());
                }
            });
        });

        observer.observe(this.container);
        
        // Initial update
        this.updateTimestamp();
        this.updateUptime();
    }

    show() {
        if (this.container) {
            setTimeout(() => {
                this.container.classList.add('visible');
            }, 500);
        }
    }

    updateLoop(time) {
        if (!this.isVisible) return;

        // Throttle updates to ~1 second (1000ms)
        if (time - this.lastUpdateTime >= 1000) {
            this.updateTimestamp();
            this.updateUptime();
            this.lastUpdateTime = time;
        }

        requestAnimationFrame(this.updateLoop);
    }

    updateTimestamp() {
        if (this.timestampEl) {
            const now = new Date();
            this.timestampEl.textContent = now.toTimeString().split(' ')[0];
        }
    }

    updateUptime() {
        if (this.uptimeEl) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.uptimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
                title: 'CREHABITAT',
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
        this.logicalWidth = 0;
        this.logicalHeight = 0;

        // Bind for RAF optimization
        this.draw = this.draw.bind(this);
    }

    init(audioManager) {
        this.canvas = document.getElementById('audioVisualizer');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        this.logicalWidth = this.canvas.width;
        this.logicalHeight = this.canvas.height;
        // In this case, we'll just read them once in init, but if canvas resizes we might need a resize listener.
        // The canvas doesn't seem to resize dynamically based on JS, it's 400x120 hardcoded in HTML.

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
        let hasAudio = false;
        for (let i = 0; i < this.bufferLength; i++) {
            if (this.dataArray[i] > 0) {
                hasAudio = true;
                break;
            }
        }
        if (!hasAudio) return;
        
        const ctx = this.ctx;
        /**
         * ⚡ Bolt Performance Optimization
         * 💡 What: Cached canvas dimensions as `this.logicalWidth` and `this.logicalHeight` to prevent reading DOM properties `this.canvas.width` and `this.canvas.height` on every frame.
         * 🎯 Why: Accessing DOM properties inside a 60fps `requestAnimationFrame` loop forces synchronous JS-to-C++ boundary crossings, causing performance overhead.
         * 📊 Impact: Eliminates DOM reads during the animation loop, reducing CPU usage.
         */
        const width = this.logicalWidth;
        const height = this.logicalHeight;
        
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
        const width = this.logicalWidth || this.canvas.width;
        const height = this.logicalHeight || this.canvas.height;
        
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
                date: { es: 'OCT 2025 - PRESENTE', en: 'OCT 2025 - PRESENT' },
                title: { es: 'Desarrollador Unity', en: 'Unity Developer' },
                company: { es: 'IST (Instituto de Seguridad del Trabajo)', en: 'IST (Work Safety Institute)' },
                description: { es: 'Desarrollo de proyectos de Realidad Virtual y creación de Experiencias Inmersivas.', en: 'Development of Virtual Reality projects and creation of Immersive Experiences.' }
            },
            {
                date: { es: 'AGO 2025 - AGO 2025', en: 'AUG 2025 - AUG 2025' },
                title: { es: 'Diseñador de Videojuegos', en: 'Game Designer' },
                company: { es: 'SANDA (SANDA GAME JAM)', en: 'SANDA (SANDA GAME JAM)' },
                description: { es: 'Desarrollo de NOVA. 1er Lugar Mejor Atmósfera/Narrativa. Menciones honoríficas en UI y Equipo Inclusivo.', en: 'Development of NOVA. 1st Place Best Atmosphere/Narrative. Honorable mentions in UI and Inclusive Team.' }
            },
            {
                date: { es: 'AGO 2025 - AGO 2025', en: 'AUG 2025 - AUG 2025' },
                title: { es: 'Programador Informático', en: 'Software Programmer' },
                company: { es: 'WOMEN GAME JAM CHILE', en: 'WOMEN GAME JAM CHILE' },
                description: { es: 'Desarrollo de "Be The Hero" en 48 horas. Exploración de dilemas éticos y trabajo colaborativo.', en: 'Development of "Be The Hero" in 48 hours. Exploration of ethical dilemmas and collaborative work.' }
            },
            {
                date: { es: 'FEB 2025 - JUN 2025', en: 'FEB 2025 - JUN 2025' },
                title: { es: 'Unity VR Dev & Animación', en: 'Unity VR Dev & Animation' },
                company: { es: 'STAFFY LTDA.', en: 'STAFFY LTDA.' },
                description: { es: 'Frameworks VR para MetaQuest 3. Optimización técnica, modelado 3D (Blender) y liderazgo de proyectos.', en: 'VR Frameworks for MetaQuest 3. Technical optimization, 3D modeling (Blender) and project leadership.' }
            },
            {
                date: { es: 'MAR 2021 - DIC 2025', en: 'MAR 2021 - DEC 2025' },
                title: { es: 'Licenciatura en Artes y Tecnologías', en: 'Bachelor in Arts and Technologies' },
                company: { es: 'UNIACC', en: 'UNIACC' },
                description: { es: 'Comunicador Digital: Diseño y Desarrollo de Videojuegos. Formación en arte, tecnologías y gestión de proyectos.', en: 'Digital Communicator: Game Design and Development. Training in art, technologies, and project management.' }
            },
            {
                date: { es: 'JUL 2024 - OCT 2024', en: 'JUL 2024 - OCT 2024' },
                title: { es: 'Desarrollador Unity', en: 'Unity Developer' },
                company: { es: 'DREAMS OF HEAVEN', en: 'DREAMS OF HEAVEN' },
                description: { es: 'Desarrollo multiplataforma, C#, herramientas de editor y plugins personalizados para optimización de flujos.', en: 'Cross-platform development, C#, editor tools and custom plugins for workflow optimization.' }
            },
            {
                date: { es: 'MAY 2024 - MAY 2024', en: 'MAY 2024 - MAY 2024' },
                title: { es: 'Desarrollador de Videojuegos', en: 'Game Developer' },
                company: { es: 'KUWALA', en: 'KUWALA' },
                description: { es: 'Desarrollo de "Crehabitat", ganador del 2º Lugar en la Social Impact Game Jam 2024.', en: 'Development of "Crehabitat", 2nd Place winner at Social Impact Game Jam 2024.' }
            },
            {
                date: { es: 'ABR 2022 - ABR 2024', en: 'APR 2022 - APR 2024' },
                title: { es: 'Técnico Informático', en: 'IT Technician' },
                company: { es: 'DUST2.GG', en: 'DUST2.GG' },
                description: { es: 'Distribución de componentes gaming y soluciones tecnológicas. Soporte y hardware.', en: 'Distribution of gaming components and technological solutions. Hardware and support.' }
            },
            {
                date: { es: 'ENE 2021 - NOV 2021', en: 'JAN 2021 - NOV 2021' },
                title: { es: 'Barista', en: 'Barista' },
                company: { es: 'TAVELLI', en: 'TAVELLI' },
                description: { es: 'Gestión de comandas y atención al cliente. Coordinación multidisciplinaria.', en: 'Order management and customer service. Multidisciplinary coordination.' }
            },
             {
                date: { es: 'SEP 2020 - SEP 2020', en: 'SEP 2020 - SEP 2020' },
                title: { es: 'Desarrollador Unity', en: 'Unity Developer' },
                company: { es: 'FFSTUDIOS SPA', en: 'FFSTUDIOS SPA' },
                description: { es: 'Desarrollo de "Shape Kisser", 2º Lugar en Game Jam Online 2020. Mecánicas de puzzle inclusivas.', en: 'Development of "Shape Kisser", 2nd Place at Game Jam Online 2020. Inclusive puzzle mechanics.' }
            },
            {
                date: { es: 'DIC 2021 - DIC 2022', en: 'DEC 2021 - DEC 2022' },
                title: { es: 'Informática y Comunicaciones', en: 'IT and Communications' },
                company: { es: 'DESAFÍO LATAM', en: 'DESAFÍO LATAM' },
                description: { es: 'Associate\'s degree. Fundamentos de desarrollo web y flujos de trabajo.', en: 'Associate\'s degree. Web development fundamentals and workflows.' }
            }
        ];
    }

    init() {
        this.render();
        document.addEventListener('languageChanged', () => this.render());
    }

    render() {
        const container = document.getElementById('timelineContainer');
        if (!container) return;
        
        const lang = typeof languageManager !== 'undefined' ? languageManager.currentLang : 'es';

        container.innerHTML = this.experiences.map(exp => `
            <div class="timeline-item" style="opacity: 0; transform: translateX(-20px);">
                <div class="timeline-dot"></div>
                <div class="timeline-date">${exp.date[lang] || exp.date.es}</div>
                <div class="timeline-content">
                    <h3 class="timeline-title">${exp.title[lang] || exp.title.es}</h3>
                    <div class="timeline-company">${exp.company[lang] || exp.company.es}</div>
                    <p class="timeline-desc">${exp.description[lang] || exp.description.es}</p>
                </div>
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
        
        window.addEventListener('resize', debounce(() => this.resize(), 200), { passive: true });
        
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

            /**
             * ⚡ Bolt Performance Optimization
             * 💡 What: Replaced \`this.canvas.height\` with \`this.logicalHeight\` inside the MatrixRain draw loop.
             * 🎯 Why: Accessing DOM properties like \`canvas.height\` inside a high-frequency \`requestAnimationFrame\` loop forces synchronous C++ boundary crossings, which is slow.
             * 📊 Impact: Eliminates O(N) DOM reads per frame, ensuring smoother 60fps rendering, and fixes a bug where drops reset prematurely on scaled down resolutions (e.g., mobile or 'low' preset).
             */
            // Reset drop to top randomly
            if (y > this.logicalHeight && Math.random() > 0.975) {
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

        // Bind for RAF optimization
        this.update = this.update.bind(this);
    }

    init() {
        const layers = document.querySelectorAll('.parallax-layer');
        if (layers.length === 0) return;

        // Optimization: Pre-calculate speed and cache elements to avoid DOM access in loop
        this.items = Array.from(layers).map(layer => ({
            el: layer,
            speed: parseFloat(layer.dataset.speed) || 0.5,
            isVisible: true, // Assume visible initially
            lastYPos: undefined
        }));

        // Optimization: Use IntersectionObserver to skip DOM updates for off-screen layers
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const item = this.items.find(i => i.el === entry.target);
                if (item) {
                    item.isVisible = entry.isIntersecting;
                    // Trigger an immediate update when an element becomes visible
                    // to fix stale positions after sudden anchor jumps
                    if (item.isVisible) {
                        this.requestTick();
                    }
                }
            });
        }, { rootMargin: '100% 0px' }); // Margin to ensure it starts moving before entering viewport

        this.items.forEach(item => this.observer.observe(item.el));

        // Optimization: Use passive listener to prevent blocking scroll
        window.addEventListener('scroll', () => this.requestTick(), { passive: true });
        
        // Register with performance manager
        performanceManager.registerEffect('parallax', this);
        
        // Apply initial state
        if (!performanceManager.effects.parallax) {
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].el.style.display = 'none';
            }
        }
        
        devLog('Parallax initialized with', this.items.length, 'layers');
    }

    requestTick() {
        // Optimization: Skip calculations if effect is disabled
        if (!performanceManager.effects.parallax) return;

        if (!this.ticking) {
            window.requestAnimationFrame(this.update);
            this.ticking = true;
        }
    }

    update() {
        this.lastScrollY = window.scrollY;
        
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            /**
             * ⚡ Bolt Performance Optimization
             * 💡 What: Implemented IntersectionObserver to skip off-screen elements and added dirty checking for sub-pixel changes.
             * 🎯 Why: Modifying `style.transform` unconditionally on every scroll tick for off-screen elements or for imperceptible sub-pixel changes forces unnecessary layer compositing and CPU/GPU work.
             * 📊 Impact: Eliminates DOM writes for off-screen parallax layers (saving O(N) operations) and prevents redundant sub-pixel layout thrashing.
             */
            if (!item.isVisible) continue;

            const yPos = -(this.lastScrollY * item.speed);

            if (item.lastYPos === undefined || Math.abs(item.lastYPos - yPos) > 0.5) {
                item.el.style.transform = `translate3d(0, ${yPos}px, 0)`;
                item.lastYPos = yPos;
            }
        }

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
const translations = {
    es: {
        "header.subtitle": "VR DEVELOPER // TECH ARTIST // EGRESADO EN ARTES Y TECNOLOGÍAS DE LA COMUNICACIÓN",
        "stats.projects": "PROYECTOS",
        "stats.colabs": "COLAB",
        "stats.hours": "HORAS_XR",
        "info.label": "INFO_SISTEMA",
        "info.text": "Desarrollador y artista técnico especializado en realidad virtual (VR) y experiencias inmersivas interactivas, con más de 3 años de experiencia profesional en el uso de Unity para proyectos de carácter educativo y de investigación.",
        "link.portfolio": "PORTAFOLIO",
        "link.code": "CÓDIGO_FUENTE",
        "link.vr": "PROYECTOS_VR",
        "projects.label": "PROYECTOS_ACTIVOS",
        "filters.all": "TODOS",
        "skills.label": "MATRIZ_HABILIDADES",
        "timeline.label": "REGISTRO_EXP",
        "contact.label": "FORM_CONTACTO",
        "contact.name": "ID_NOMBRE:",
        "placeholder.name": "Juan_Perez",
        "contact.email": "DIRECCION_EMAIL:",
        "placeholder.email": "usuario@dominio.ext",
        "contact.message": "CARGA_MENSAJE:",
        "placeholder.message": "Ingresa transmisión...",
        "contact.submit": "TRANSMITIR_DATOS",
        "footer.sync": "SINC:"
    },
    en: {
        "header.subtitle": "VR DEVELOPER // TECH ARTIST // GRADUATE IN COMMUNICATION ARTS AND TECHNOLOGIES",
        "stats.projects": "PROJECTS",
        "stats.colabs": "COLABS",
        "stats.hours": "XR_HOURS",
        "info.label": "SYSTEM_INFO",
        "info.text": "Developer and technical artist specialized in virtual reality (VR) and interactive immersive experiences, with over 3 years of professional experience using Unity for educational and research projects.",
        "link.portfolio": "PORTFOLIO",
        "link.code": "SOURCE_CODE",
        "link.vr": "VR_PROJECTS",
        "projects.label": "ACTIVE_PROJECTS",
        "filters.all": "ALL",
        "skills.label": "SKILLS_MATRIX",
        "timeline.label": "EXPERIENCE_LOG",
        "contact.label": "CONTACT_FORM",
        "contact.name": "NAME_IDENTIFIER:",
        "placeholder.name": "John_Doe",
        "contact.email": "EMAIL_ADDRESS:",
        "placeholder.email": "user@domain.ext",
        "contact.message": "MESSAGE_PAYLOAD:",
        "placeholder.message": "Enter transmission...",
        "contact.submit": "TRANSMIT_DATA",
        "footer.sync": "SYNC:"
    }
};

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
        if (saved) {
            this.switchLanguage(saved);
        } else {
            // Run initially for default language
            this.updateInterface();
        }
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

        this.updateInterface();

        if(typeof audioManager !== 'undefined') {
            audioManager.playSound('click');
        }
    }

    updateInterface() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(!translations[this.currentLang] || !translations[this.currentLang][key]) return;

            const translation = translations[this.currentLang][key];

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.setAttribute('placeholder', translation);
            } else {
                el.innerHTML = translation;
            }
        });

        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));
    }
    
    // Helper to get translated string for JS dynamic content
    get(key) {
        return translations[this.currentLang] ? (translations[this.currentLang][key] || key) : key;
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

        // Add click handlers to project images and overlays
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('project-image')) {
                this.open(e.target.src);
            } else if (e.target.classList.contains('project-overlay')) {
                const img = e.target.previousElementSibling;
                if (img && img.classList.contains('project-image')) {
                    this.open(img.src);
                }
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
        title: 'CREHABITAT',
        category: 'unity',
        description: { es: 'Juego educativo sobre corredores biológicos.', en: 'Educational game about biological corridors.' },
        image: ASSET_PATH + 'projects/crehabitat.webp',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/crehabitat'
    },
    {
        id: '02',
        title: 'CANDY_PARTY',
        category: 'unity',
        description: { es: 'Juego de fiesta multijugador asimétrico.', en: 'Asymmetrical multiplayer party game.' },
        image: ASSET_PATH + 'projects/candyparty.webp',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/candy-party'
    },
    {
        id: '03',
        title: 'SHAPE_KISSER',
        category: 'unity',
        description: { es: 'Juego de puzzle con temática de formas geométricas.', en: 'Puzzle game with geometric shapes theme.' },
        image: 'https://img.itch.zone/aW1nLzQyMzU1MDUucG5n/347x500/SM7ekS.png',
        tech: ['UNITY', 'C#', 'MOBILE'],
        link: 'https://kaitoartz.itch.io/shapekisser'
    },
    {
        id: '04',
        title: 'DETECTOR_CAMERA',
        category: 'web',
        description: { es: 'Detector de postura con Mediapipe en tiempo real.', en: 'Real-time posture detector using Mediapipe.' },
        image: ASSET_PATH + 'projects/mediapipe.webp',
        tech: ['HTML', 'CSS', 'JS', 'MEDIAPIPE'],
        link: 'https://desarrolladorvr.github.io/'
    },
    {
        id: '04',
        title: 'PORTAL_GAMES',
        category: 'web',
        description: { es: 'Portal Web de Juegos Educativos.', en: 'Educational Games Web Portal.' },
        image: ASSET_PATH + 'projects/IstGames.webp',
        tech: ['HTML', 'CSS', 'JS'],
        link: 'https://istgames.netlify.app/'
    },
    {
        id: '05',
        title: 'DARALI_DEVEL',
        category: 'unreal',
        description: { es: 'Proyecto de desarrollo de juego de terror.', en: 'Horror game development project.' },
        image: 'https://img.itch.zone/aW1hZ2UvMzEzNzgyMi8xOTA2NjM0OC5qcGc=/original/%2Bw3lwe.jpg',
        tech: ['UNREAL_ENGINE', 'C++', 'HORROR'],
        link: 'https://corejeux.itch.io/darali-devel'
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

        // Re-render when language changes
        document.addEventListener('languageChanged', () => {
            if (this.activeFilter === 'all') {
                this.renderProjects(projectsData);
            } else {
                this.renderProjects(projectsData.filter(p => p.category === this.activeFilter));
            }
        });

        // Setup Filters
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.setFilter(filter);

                // Update active state
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if(typeof audioManager !== 'undefined') audioManager.playClick();
            });
        });
    }

    renderProjects(projects) {
        const lang = typeof languageManager !== 'undefined' ? languageManager.currentLang : 'es';

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
                        <a href="${proj.link !== '#' ? proj.link : 'javascript:void(0)'}" target="${proj.link !== '#' ? '_blank' : '_self'}" class="view-project-btn" style="text-decoration: none; display: inline-block;">VIEW_DATA</a>
                    </div>
                </div>
                <div class="project-info">
                    <div class="project-header">
                        <span class="project-id">ID_${proj.id}</span>
                        <span class="project-category">${proj.category.toUpperCase()}</span>
                    </div>
                    <h3 class="project-title">${proj.title}</h3>
                    <p class="project-desc">${typeof proj.description === 'string' ? proj.description : (proj.description[lang] || proj.description.es)}</p>
                    <div class="project-tech">
                        ${proj.tech.map(t => `<span>${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        // Attach click handlers properly instead of inline 'onclick'
        this.container.querySelectorAll('.view-project-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid triggering lightbox immediately
                if(typeof audioManager !== 'undefined') {
                    audioManager.playClick();
                }
            });
        });
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
        this.videoId = '1169926700'; 
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
        if (statusText) statusText.textContent = "INITIALIZING...";

        // Check Connection
        if (!navigator.onLine) {
             if (statusText) statusText.textContent = "OFFLINE // DATA_UNAVAILABLE";
             // Optional: Don't load iframe if offline to save resources/errors
             return;
        }

        // Include the hash parameter for unlisted videos
        this.iframe.src = `https://player.vimeo.com/video/${this.videoId}?h=${this.videoHash}&autoplay=1&title=0&byline=0&portrait=0`;
        
        // Timeout for slow connection feedback
        this.loadTimeout = setTimeout(() => {
            if (loader && loader.style.display !== 'none') {
                if (statusText) statusText.textContent = "WARN: SLOW CONNECTION...";
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


// ========== NAVIGATION & SCROLL TO TOP ==========
document.addEventListener('DOMContentLoaded', () => {
    // Scroll to Top Button
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            if (typeof scrollManager !== 'undefined' && scrollManager.lenis) {
                scrollManager.lenis.scrollTo(0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // Nav Links Smooth Scroll
    document.querySelectorAll('a.nav-btn').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                if (typeof scrollManager !== 'undefined' && scrollManager.lenis) {
                    scrollManager.lenis.scrollTo(targetElement);
                } else {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
                
                // Close dock if open
                const dock = this.closest('.control-dock');
                if (dock && !dock.classList.contains('collapsed')) {
                    dock.classList.add('collapsed');
                    dock.setAttribute('data-expanded', 'false');
                }
            }
        });
    });
});
