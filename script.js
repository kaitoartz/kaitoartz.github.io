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
            background: 'assets/audio/background.mp3',
            hover: 'assets/audio/hover.mp3',
            click: 'assets/audio/click.mp3',
            boot: 'assets/audio/boot.mp3',
            glitch: 'assets/audio/glitch.mp3',
            success: 'assets/audio/success.mp3'
        };
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
            console.log('%c>> AUDIO SYSTEM: INITIALIZED', 'color: #39FF14; font-family: monospace;');
            // No cargamos archivos con fetch (problema de CORS en file://)
            // Los archivos se cargarán cuando se necesiten
        }
    }

    playSound(soundName, volume = 1.0, loop = false) {
        if (!this.enabled || !this.audioContext) return;
        
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

    playBackgroundMusic(volume = 0.3) {
        if (!this.enabled || !this.audioContext) {
            console.log('%c>> MUSIC: AudioContext not initialized', 'color: #FF6B6B; font-family: monospace;');
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
        const playPromise = this.bgMusic.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('%c>> MUSIC: ♫ Playing! Volume: ' + (volume * 100).toFixed(0) + '%', 'color: #39FF14; font-family: monospace;');
            }).catch(error => {
                console.log('%c>> MUSIC: Play blocked - ' + error.message, 'color: #FF6B6B; font-family: monospace;');
                console.log('%c>> MUSIC: User interaction may be required', 'color: #FFAA00; font-family: monospace;');
            });
        }
    }

    stopBackgroundMusic() {
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
    playHover() { this.playSound('hover', 0.3); }
    playBoot() { this.playSound('boot', 0.6); }
    playGlitch() { this.playSound('glitch', 0.4); }
    playSuccess() { this.playSound('success', 0.5); }
}

const audioManager = new AudioManager();

// ========== START BUTTON ==========
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const startScreen = document.querySelector('.start-screen');
    const bootOverlay = document.querySelector('.boot-overlay');

    startButton.addEventListener('click', async () => {
        console.log('%c>> SYSTEM: Start button clicked', 'color: #39FF14; font-family: monospace;');
        
        // Initialize audio on user interaction
        await audioManager.init();
        audioManager.playClick();
        audioManager.playBoot();
        
        // Start background music with proper timing
        setTimeout(() => {
            console.log('%c>> SYSTEM: Starting background music...', 'color: #00FFFF; font-family: monospace;');
            audioManager.playBackgroundMusic(0.3); // Increased volume to 30%
            
            // Initialize visualizer after audio nodes are ready
            setTimeout(() => {
                audioVisualizer.init(audioManager);
            }, 300);
        }, 1000);

        // Hide start screen
        startScreen.style.transition = 'opacity 0.5s ease-out';
        startScreen.style.opacity = '0';
        
        setTimeout(() => {
            startScreen.style.display = 'none';
            bootOverlay.style.display = 'block';
            
            // Start boot sequence
            startBootSequence();
        }, 500);
    });
});

// ========== BOOT SEQUENCE ==========
// ========== BOOT SEQUENCE ==========
function startBootSequence() {
    console.log('%c>> BOOT: Starting sequence', 'color: #00FFFF; font-family: monospace;');
    
    const loadProgress = document.getElementById('loadProgress');
    const bootOverlay = document.querySelector('.boot-overlay');
    const dashboard = document.querySelector('.dashboard');
    
    if (!loadProgress || !bootOverlay || !dashboard) {
        console.error('Boot elements not found!');
        return;
    }
    
    let progress = 0;

    const loadInterval = setInterval(() => {
        progress = Math.min(progress + Math.floor(Math.random() * 15) + 10, 100);
        loadProgress.textContent = progress;
        
        if (progress >= 100) {
            clearInterval(loadInterval);
            console.log('%c>> BOOT: Complete (100%)', 'color: #39FF14; font-family: monospace;');
            
            setTimeout(() => {
                bootOverlay.classList.add('complete');
                
                setTimeout(() => {
                    console.log('%c>> BOOT: Showing dashboard', 'color: #39FF14; font-family: monospace;');
                    dashboard.classList.add('visible');
                    bootOverlay.style.display = 'none';
                    
                    setTimeout(() => {
                        const terminalBtn = document.getElementById('terminalButton');
                        if (terminalBtn) terminalBtn.classList.add('visible');
                        
                        if (typeof technicalBackground !== 'undefined' && technicalBackground.show) {
                            technicalBackground.show();
                        }
                        
                        console.log('%c>> BOOT: System ready ✓', 'color: #39FF14; font-family: monospace;');
                    }, 300);
                }, 1000);
            }, 500);
        }
    }, 150);
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
function triggerGlitch(element) {
    const original = element.textContent;
    const chars = '!<>-_\\/[]{}—=+*^?#________';
    let iterations = 0;

    const glitchInterval = setInterval(() => {
        element.textContent = original
            .split('')
            .map((char, index) => {
                if (index < iterations) {
                    return original[index];
                }
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

        if (iterations >= original.length) {
            clearInterval(glitchInterval);
        }

        iterations += 1 / 3;
    }, 30);
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

// ========== THEME TOGGLE SYSTEM ==========
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.toggleButton = null;
        this.toggleLabel = null;
        this.overlay = null;
    }

    init() {
        this.toggleButton = document.getElementById('themeToggle');
        this.toggleLabel = document.getElementById('toggleLabel');
        
        // Apply saved theme
        this.applyTheme(this.theme, false);
        
        // Add event listener
        this.toggleButton.addEventListener('click', (e) => this.handleToggle(e));
    }

    handleToggle(e) {
        const rect = this.toggleButton.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
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
            this.toggleButton.classList.add('light');
            this.toggleLabel.textContent = 'DAY_MODE';
            
            if (animate) {
                console.log('%c>> THEME_SWITCH: DAY_MODE_ACTIVATED', 'color: #FFD700; font-family: monospace;');
            }
        } else {
            document.body.classList.remove('light-theme');
            this.toggleButton.classList.remove('light');
            this.toggleLabel.textContent = 'NIGHT_MODE';
            
            if (animate) {
                console.log('%c>> THEME_SWITCH: NIGHT_MODE_ACTIVATED', 'color: #39FF14; font-family: monospace;');
            }
        }
    }
}

const themeManager = new ThemeManager();

// Initialize theme after page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        themeManager.init();
    }, 100);
});

// ========== CUSTOM CURSOR SYSTEM ==========
// ========== CURSOR MANAGER ==========
class CursorManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.cursor = { x: 0, y: 0 };
        this.trail = [];
        this.maxTrail = 20;
    }

    init() {
        this.canvas = document.getElementById('cursorCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        document.addEventListener('mousemove', (e) => {
            this.cursor = { x: e.clientX, y: e.clientY };
            this.trail.push({ ...this.cursor, life: 1 });
            if (this.trail.length > this.maxTrail) this.trail.shift();
        });
        
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw trail
        this.trail.forEach(point => {
            point.life -= 0.05;
            const size = 3 * point.life;
            this.ctx.fillStyle = `rgba(57, 255, 20, ${point.life * 0.5})`;
            this.ctx.fillRect(point.x - size/2, point.y - size/2, size, size);
        });
        this.trail = this.trail.filter(p => p.life > 0);
        
        // Draw crosshair
        const { x, y } = this.cursor;
        const size = 20;
        this.ctx.strokeStyle = '#39FF14';
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
        this.ctx.moveTo(x - size, y);
        this.ctx.lineTo(x + size, y);
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x, y + size);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#39FF14';
        this.ctx.fillRect(x - 1, y - 1, 2, 2);
        
        requestAnimationFrame(() => this.animate());
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
        audioManager.playSuccess();
    }

    close() {
        this.modal.classList.remove('active');
        this.backdrop.classList.remove('active');
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
Available commands:<br>
• help - Show this help message<br>
• about - Information about KAITOARTZ<br>
• skills - Display skills and technologies<br>
• projects - Show recent projects<br>
• contact - Contact information<br>
• theme [dark/light] - Switch theme<br>
• audio [play/stop/test] - Control background music<br>
• matrix - Toggle Matrix rain effect<br>
• time - Show current system time<br>
• whoami - Display user info<br>
• ls - List files<br>
• cat [file] - Read file contents<br>
• hack - Simulate hacking sequence<br>
• clear - Clear terminal<br>
• exit/quit - Close terminal<br>
• konami - ??? (try the Konami code)
        `);
    }

    showAbout() {
        this.addOutput(`
<span style="color: #00ff00;">╔════════════════════════════════════╗</span><br>
<span style="color: #00ff00;">║</span>  KAITOARTZ - VR DEVELOPER      <span style="color: #00ff00;">║</span><br>
<span style="color: #00ff00;">╚════════════════════════════════════╝</span><br>
<br>
Diseño experiencias XR con estética brutalista<br>
y pipelines experimentales. Especializado en<br>
visualización en tiempo real, instalaciones<br>
inmersivas y herramientas educativas interactivas.<br>
<br>
S/N: KA-0226-MX07 | NODE_07
        `);
    }

    showSkills() {
        this.addOutput(`
<span style="color: #00ff00;">TECHNICAL_SKILLS:</span><br>
▓▓▓▓▓▓▓▓▓▓ Unity/Unreal [95%]<br>
▓▓▓▓▓▓▓▓▓░ C# / JavaScript [90%]<br>
▓▓▓▓▓▓▓▓░░ VR/AR Development [85%]<br>
▓▓▓▓▓▓▓░░░ 3D Modeling [75%]<br>
▓▓▓▓▓▓▓▓▓░ Shader Programming [90%]<br>
▓▓▓▓▓▓▓▓░░ Web Technologies [80%]
        `);
    }

    showProjects() {
        this.addOutput(`
<span style="color: #00ff00;">RECENT_PROJECTS:</span><br>
<br>
[01] VR_GALLERY - Immersive art exhibition<br>
[02] NEURAL_INTERFACE - Brain-computer integration<br>
[03] HOLOGRAM_SIM - Real-time holographic display<br>
[04] EDU_XR - Educational VR platform<br>
<br>
Visit portfolio for more details...
        `);
    }

    showContact() {
        this.addOutput(`
<span style="color: #00ff00;">CONTACT_PROTOCOL:</span><br>
<br>
📧 EMAIL: [Set your email in HTML]<br>
💼 LINKEDIN: [Add your link]<br>
🐙 GITHUB: [Add your link]<br>
🎮 ITCH.IO: [Add your link]<br>
<br>
STATUS: <span style="color: #00ff00;">ONLINE</span> | ACCEPTING_COLLABORATIONS
        `);
    }

    toggleTheme(arg) {
        if (arg === 'dark' || arg === 'light') {
            themeManager.theme = arg === 'dark' ? 'light' : 'dark';
            themeManager.handleToggle({});
            this.addOutput(`Theme switched to ${arg} mode`);
        } else {
            this.addOutput(`Usage: theme [dark/light]`);
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
        audioManager.playSuccess();
    }

    close() {
        this.modal.classList.remove('active');
        if (this.backdrop) {
            this.backdrop.classList.remove('active');
        }
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

// ========== SKILLS RADAR CHART ==========
class SkillsRadar {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.skills = [
            { name: 'VR/AR', value: 90, color: '#39FF14' },
            { name: 'Programming', value: 85, color: '#FF6B6B' },
            { name: '3D/Shaders', value: 80, color: '#00FFFF' },
            { name: 'Design', value: 75, color: '#FF00FF' }
        ];
        this.animationProgress = 0;
    }

    init() {
        this.canvas = document.getElementById('skillsRadar');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.animate();
    }

    animate() {
        if (this.animationProgress < 1) {
            this.animationProgress += 0.02;
            if (this.animationProgress > 1) this.animationProgress = 1;
        }
        
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    draw() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid circles
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#FFFFFF';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, (radius / 5) * i, 0, Math.PI * 2);
            ctx.globalAlpha = 0.2;
            ctx.stroke();
        }
        
        // Draw axes
        const angleStep = (Math.PI * 2) / this.skills.length;
        ctx.globalAlpha = 0.3;
        
        this.skills.forEach((_, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        });
        
        // Draw data polygon
        ctx.beginPath();
        ctx.globalAlpha = 0.3;
        
        this.skills.forEach((skill, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const value = (skill.value / 100) * radius * this.animationProgress;
            const x = centerX + Math.cos(angle) * value;
            const y = centerY + Math.sin(angle) * value;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.closePath();
        ctx.fillStyle = '#39FF14';
        ctx.fill();
        
        // Draw data points and values
        ctx.globalAlpha = 1;
        this.skills.forEach((skill, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const value = (skill.value / 100) * radius * this.animationProgress;
            const x = centerX + Math.cos(angle) * value;
            const y = centerY + Math.sin(angle) * value;
            
            // Point
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = skill.color;
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label
            const labelX = centerX + Math.cos(angle) * (radius + 25);
            const labelY = centerY + Math.sin(angle) * (radius + 25);
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#FFFFFF';
            ctx.font = '10px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(skill.name, labelX, labelY);
            ctx.fillText(Math.round(skill.value * this.animationProgress) + '%', labelX, labelY + 12);
        });
    }
}

// ========== PROJECTS MANAGER ==========
class ProjectsManager {
    constructor() {
        this.projects = [
            {
                title: 'VR_MUSEUM',
                description: 'Instalación interactiva de arte en realidad virtual con shaders procedurales',
                image: 'https://via.placeholder.com/300x150/111111/39FF14?text=VR+MUSEUM',
                tags: ['Unity', 'VR', 'Shaders'],
                github: '#',
                demo: '#'
            },
            {
                title: 'SHADER_LAB',
                description: 'Colección de shaders experimentales para visualización en tiempo real',
                image: 'https://via.placeholder.com/300x150/111111/39FF14?text=SHADER+LAB',
                tags: ['GLSL', 'WebGL', 'Three.js'],
                github: '#',
                demo: '#'
            },
            {
                title: 'XR_EDUCATION',
                description: 'Plataforma educativa inmersiva con tracking de manos',
                image: 'https://via.placeholder.com/300x150/111111/39FF14?text=XR+EDUCATION',
                tags: ['Meta Quest', 'Hand Tracking', 'C#'],
                github: '#',
                demo: '#'
            }
        ];
    }

    init() {
        this.render();
    }

    render() {
        const container = document.getElementById('projectsGrid');
        if (!container) return;
        
        container.innerHTML = this.projects.map(project => `
            <div class="project-card">
                <div class="project-card-inner">
                    <div class="project-card-front">
                        <img src="${project.image}" alt="${project.title}" class="project-image">
                        <div class="project-title">${project.title}</div>
                        <div class="project-description">${project.description}</div>
                        <div class="project-tags">
                            ${project.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                    <div class="project-card-back">
                        <div class="project-title">${project.title}</div>
                        <div class="project-description">${project.description}</div>
                        <div class="project-tags">
                            ${project.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}
                        </div>
                        <div class="project-links">
                            <a href="${project.github}" class="project-link" target="_blank">GITHUB</a>
                            <a href="${project.demo}" class="project-link" target="_blank">DEMO</a>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

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
                <button class="notification-close">&times;</button>
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
    }

    init(audioManager) {
        this.canvas = document.getElementById('audioVisualizer');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Use the already-created analyser node
        if (audioManager && audioManager.analyserNode) {
            this.analyser = audioManager.analyserNode;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.active = true;
            this.draw();
            
            const statusEl = document.getElementById('visualizerStatus');
            if (statusEl) statusEl.textContent = 'ACTIVE';
        } else {
            this.drawStandby();
        }
    }

    draw() {
        if (!this.active) return;
        
        requestAnimationFrame(() => this.draw());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);
        
        const barWidth = (width / this.bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            barHeight = (this.dataArray[i] / 255) * height;
            
            const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, '#39FF14');
            gradient.addColorStop(0.5, '#00FFFF');
            gradient.addColorStop(1, '#FF00FF');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }

    drawStandby() {
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
                date: '2024 - PRESENT',
                title: 'VR Developer',
                company: 'TECH_CORP',
                description: 'Desarrollo de experiencias inmersivas con Meta Quest y Unity'
            },
            {
                date: '2023 - 2024',
                title: 'Technical Artist',
                company: 'DIGITAL_STUDIO',
                description: 'Creación de shaders y pipelines de renderizado en tiempo real'
            },
            {
                date: '2022 - 2023',
                title: 'Research Support',
                company: 'UNIVERSITY_LAB',
                description: 'Investigación en visualización de datos y AR educativo'
            },
            {
                date: '2021 - 2022',
                title: 'Junior Developer',
                company: 'STARTUP_XR',
                description: 'Prototipado rápido de aplicaciones XR'
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
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-date">${exp.date}</div>
                <div class="timeline-title">${exp.title}</div>
                <div class="timeline-company">${exp.company}</div>
                <div class="timeline-description">${exp.description}</div>
            </div>
        `).join('');
    }
}

// ========== MATRIX RAIN EFFECT ==========
class MatrixRain {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.columns = 0;
        this.drops = [];
        this.fontSize = 14;
        this.characters = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        this.animationId = null;
        this.isActive = false;
    }

    init() {
        this.canvas = document.getElementById('matrixCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
        
        // Start automatically
        this.start();
        console.log('Matrix Rain initialized');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        this.drops = Array(this.columns).fill(1);
    }

    draw() {
        // Semi-transparent black for trailing effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Green text
        this.ctx.fillStyle = '#39FF14';
        this.ctx.font = `${this.fontSize}px monospace`;

        for (let i = 0; i < this.drops.length; i++) {
            const text = this.characters[Math.floor(Math.random() * this.characters.length)];
            const x = i * this.fontSize;
            const y = this.drops[i] * this.fontSize;

            this.ctx.fillText(text, x, y);

            // Reset drop to top randomly
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }

            this.drops[i]++;
        }

        if (this.isActive) {
            this.animationId = requestAnimationFrame(() => this.draw());
        }
    }

    start() {
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
        this.layers = document.querySelectorAll('.parallax-layer');
        if (this.layers.length === 0) return;

        window.addEventListener('scroll', () => this.requestTick());
        console.log('Parallax initialized with', this.layers.length, 'layers');
    }

    requestTick() {
        if (!this.ticking) {
            window.requestAnimationFrame(() => this.update());
            this.ticking = true;
        }
    }

    update() {
        this.lastScrollY = window.scrollY;
        
        this.layers.forEach(layer => {
            const speed = parseFloat(layer.dataset.speed) || 0.5;
            const yPos = -(this.lastScrollY * speed);
            layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });

        this.ticking = false;
    }
}

// ========== CONTACT FORM MANAGER ==========
class ContactFormManager {
    constructor() {
        this.form = null;
        this.nameInput = null;
        this.emailInput = null;
        this.messageInput = null;
        this.submitBtn = null;
        this.statusDiv = null;
    }

    init() {
        this.form = document.querySelector('.contact-form');
        if (!this.form) return;

        this.nameInput = document.getElementById('contactName');
        this.emailInput = document.getElementById('contactEmail');
        this.messageInput = document.getElementById('contactMessage');
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

        if (!this.validateAll()) {
            this.showStatus('VALIDATION_ERROR: CHECK ALL FIELDS', 'error');
            return;
        }

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
            // Simulate transmission (replace with actual FormSpree/EmailJS)
            await this.simulateTransmission(formData);
            
            this.showStatus('TRANSMISSION_SUCCESSFUL ✓', 'success');
            audioManager.playSound('success');
            notificationManager.show('Message transmitted successfully!', 'success');
            this.form.reset();
            
        } catch (error) {
            this.showStatus('TRANSMISSION_FAILED: TRY AGAIN', 'error');
            audioManager.playSound('error');
            notificationManager.show('Transmission error. Please retry.', 'error');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.classList.remove('transmitting');
        }
    }

    async simulateTransmission(data) {
        // TODO: Replace with actual FormSpree or EmailJS integration
        // For now, simulate async transmission
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('Contact Form Data:', data);
                resolve();
            }, 2000);
        });
    }

    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = 'form-status show ' + type;
        
        setTimeout(() => {
            this.statusDiv.classList.remove('show');
        }, 5000);
    }
}

const skillsRadar = new SkillsRadar();
const projectsManager = new ProjectsManager();
const notificationManager = new NotificationManager();
const audioVisualizer = new AudioVisualizer();
const timelineManager = new TimelineManager();
const matrixRain = new MatrixRain();
const parallaxManager = new ParallaxManager();
const contactFormManager = new ContactFormManager();

document.addEventListener('DOMContentLoaded', () => {
    console.log('%c>> DOM: Ready', 'color: #39FF14; font-family: monospace;');
    
    setTimeout(() => {
        try {
            if (window.innerWidth > 767) {
                cursorManager.init();
                console.log('%c>> INIT: Cursor ✓', 'color: #39FF14; font-family: monospace;');
            }
            
            volumeController.init();
            console.log('%c>> INIT: Volume ✓', 'color: #39FF14; font-family: monospace;');
            
            terminal.init();
            console.log('%c>> INIT: Terminal ✓', 'color: #39FF14; font-family: monospace;');
            
            shortcutsManager.init();
            console.log('%c>> INIT: Shortcuts ✓', 'color: #39FF14; font-family: monospace;');
            
            technicalBackground.init();
            console.log('%c>> INIT: Tech Background ✓', 'color: #39FF14; font-family: monospace;');
            
            // Initialize new features
            skillsRadar.init();
            console.log('%c>> INIT: Skills Radar ✓', 'color: #39FF14; font-family: monospace;');
            
            projectsManager.init();
            console.log('%c>> INIT: Projects ✓', 'color: #39FF14; font-family: monospace;');
            
            notificationManager.init();
            console.log('%c>> INIT: Notifications ✓', 'color: #39FF14; font-family: monospace;');
            
            timelineManager.init();
            console.log('%c>> INIT: Timeline ✓', 'color: #39FF14; font-family: monospace;');
            
            contactFormManager.init();
            console.log('%c>> INIT: Contact Form ✓', 'color: #39FF14; font-family: monospace;');
            
            parallaxManager.init();
            console.log('%c>> INIT: Parallax ✓', 'color: #39FF14; font-family: monospace;');
            
            matrixRain.init();
            console.log('%c>> INIT: Matrix Rain ✓', 'color: #39FF14; font-family: monospace;');
            
            // Terminal button click handler
            const terminalButton = document.getElementById('terminalButton');
            if (terminalButton) {
                terminalButton.addEventListener('click', () => {
                    terminal.open();
                });
            }
            
            // Welcome notification after boot
            setTimeout(() => {
                if (document.querySelector('.dashboard').classList.contains('visible')) {
                    notificationManager.success('SYSTEM_ONLINE', 'All systems initialized successfully');
                }
            }, 3000);
            
            console.log('%c>> SYSTEM: All modules loaded ✓', 'color: #39FF14; font-weight: bold; font-family: monospace;');
        } catch (error) {
            console.error('%c>> ERROR: Init failed', 'color: #FF6B6B; font-family: monospace;', error);
        }
    }, 100);
});
