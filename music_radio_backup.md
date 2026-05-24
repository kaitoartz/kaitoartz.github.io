# Music & Radio Systems Backup

This document holds the full backup of the background music, radio players, volume controls, visualizers, and command integrations that were removed from the portfolio site. You can use these snippets to restore the systems if requested in the future.

---

## 1. HTML Components (index.html)

### A. Audio Visualizer Block
```html
        <!-- AUDIO VISUALIZER -->
        <section class="grid-item visualizer-block">
            <div class="corner top-left">+</div>
            <div class="corner top-right">+</div>
            <div class="corner bottom-left">+</div>
            <div class="corner bottom-right">+</div>
            
            <div class="block-label">AUDIO_SPECTRUM // <span class="label-code">FFT_512</span></div>
            <canvas id="audioVisualizer" width="400" height="120" aria-label="Audio frequency spectrum visualizer" role="img"></canvas>
            <div class="visualizer-status">
                <span id="visualizerStatus">STANDBY</span>
            </div>
        </section>
```

### B. Keyboard Shortcut Item
```html
            <div class="shortcut-item"><kbd>Ctrl</kbd> + <kbd>M</kbd><span>Toggle Audio</span></div>
```

---

## 2. CSS Components (src/styles/styles.css)

### A. Mobile Collapse Media Query
```css
    .visualizer-block,
```

### B. Responsive Override
```css
    .visualizer-block {
        padding: 15px !important;
    }

    #audioVisualizer {
        width: 100%;
        height: 80px;
    }
```

### C. Main Visualizer Styling
```css
/* ========== AUDIO VISUALIZER ========== */
.visualizer-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 15px;
    height: 180px;
    grid-column: span 2;
    order: 6;
    /* Full width bottom */
}

@media (min-width: 1200px) {
    .visualizer-block {
        grid-column: span 4;
        /* Full width */
    }
}

#audioVisualizer {
    width: 100%;
    max-width: 400px;
    height: 120px;
    border: var(--border) solid var(--border-color);
    background: rgba(0, 0, 0, 0.5);
}

.visualizer-status {
    font-size: 0.8rem;
    letter-spacing: 2px;
    color: var(--accent-color);
}
```

---

## 3. JavaScript Components (src/scripts/script.js)

### A. AudioManager Config & State (Constructor)
```javascript
        this.bgMusic = null;
        this.mediaSource = null;
        this.analyserNode = null;
        
        // Audio file paths
        this.audioFiles = {
            background: ASSET_PATH + 'audio/background.mp3'
        };
        
        // Safety for async race conditions
        this.playPromise = null;
```

### B. AudioManager Methods
```javascript
    async playBackgroundMusic(volume = 0.3) {
        if (!this.audioContext) await this.init();
        
        if (!this.enabled) {
            console.log('%c>> MUSIC: System disabled', 'color: #FF6B6B; font-family: monospace;');
            return;
        }
        
        const streamUrl = this.audioFiles.background;
        
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
```

### C. Keyboard Shortcut Listener (Ctrl + M)
```javascript
    // Ctrl + M: Toggle Audio
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        if (audioManager.bgMusic && !audioManager.bgMusic.paused) {
            audioManager.stopBackgroundMusic();
        } else {
            audioManager.playBackgroundMusic(0.2);
        }
    }
```

### D. SettingsManager / DockManager Control Integrations
```javascript
            // Audio Button (Radio Toggle)
            const audioBtn = dock.querySelector('.audio-toggle-btn');
            if (audioBtn) {
                audioBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAudio(audioBtn);
                });
            }
```

```javascript
    handleAudio(btn) {
        if (audioManager.bgMusic && !audioManager.bgMusic.paused) {
            audioManager.stopBackgroundMusic();
        } else {
            audioManager.playBackgroundMusic(0.2);
        }
        this.updateAllAudioIcons();
    }

    updateAllAudioIcons() {
        const isPlaying = audioManager.bgMusic && !audioManager.bgMusic.paused;
        document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('.audio-icon') || btn.querySelector('i');
            if (icon) icon.className = isPlaying ? 'fa-solid fa-volume-high audio-icon' : 'fa-solid fa-volume-xmark audio-icon';
            btn.classList.toggle('active', isPlaying);
        });
    }
```

```javascript
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
```

### E. Terminal Commands (Terminal & TerminalManager)
```javascript
            audio: (arg) => this.audioControl(arg),
```

```javascript
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
```

### F. VolumeController Class & Instantiation
```javascript
// ========== VOLUME CONTROLLER ==========
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
```

```javascript
const volumeController = new VolumeController();
```
```javascript
            volumeController.init();
```

### G. AudioVisualizer Class & Instantiation
```javascript
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

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.analyser) {
                    this.start();
                } else {
                    this.stop(false);
                }
            });
        });
        this.observer.observe(this.canvas);

        if (audioManager && audioManager.analyserNode) {
            this.analyser = audioManager.analyserNode;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            const statusEl = document.getElementById('visualizerStatus');
            if (statusEl) statusEl.textContent = 'ACTIVE';
        } else {
            this.drawStandby();
        }
    }

    start() {
        if (this.active) return;
        if (!this.analyser) return;
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

        let hasAudio = false;
        for (let i = 0; i < this.bufferLength; i++) {
            if (this.dataArray[i] > 0) {
                hasAudio = true;
                break;
            }
        }
        if (!hasAudio) return;
        
        const ctx = this.ctx;
        const width = this.logicalWidth;
        const height = this.logicalHeight;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        if (height !== this.lastHeight) {
            this.gradientCache = [];
            this.lastHeight = height;
        }
        
        const barWidth = (width / this.bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const value = this.dataArray[i];

            if (value === 0) {
                x += barWidth + 1;
                continue;
            }

            barHeight = (value / 255) * height;
            
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
```

```javascript
const audioVisualizer = new AudioVisualizer();
```

---
