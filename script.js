// ========== START BUTTON ==========
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const startScreen = document.querySelector('.start-screen');
    const bootOverlay = document.querySelector('.boot-overlay');

    startButton.addEventListener('click', () => {
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
function startBootSequence() {
    const loadProgress = document.getElementById('loadProgress');
    let progress = 0;

    // Simulate loading
    const loadInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadInterval);
        }
        loadProgress.textContent = progress;
    }, 200);

    // Hide boot overlay after animation
    setTimeout(() => {
        document.querySelector('.boot-overlay').style.display = 'none';
    }, 3300);
}

// ========== SYSTEM TIME ==========
function updateSystemTime() {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];
    document.getElementById('systemTime').textContent = timeString;
}

setInterval(updateSystemTime, 1000);
updateSystemTime();

// ========== ANIMATED COUNTERS ==========
function animateCounter(element, target) {
    let current = 0;
    const increment = Math.ceil(target / 50);
    const duration = 1500;
    const steps = duration / 30;
    const stepIncrement = target / steps;

    const timer = setInterval(() => {
        current += stepIncrement;
        if (current >= target) {
            element.textContent = target.toString().padStart(2, '0');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toString().padStart(2, '0');
        }
    }, 30);
}

// Intersection Observer for counters
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
            const target = parseInt(entry.target.dataset.count, 10);
            animateCounter(entry.target, target);
            entry.target.classList.add('counted');
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(counter => {
    counterObserver.observe(counter);
});

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
        console.log(`%c>> ACCESS LINK_${id}`, 'color: #39FF14; font-family: monospace; font-size: 12px;');
    });

    block.addEventListener('click', function(e) {
        // Add subtle glitch effect on click
        this.style.transform = 'scale(0.98)';
        setTimeout(() => {
            this.style.transform = '';
        }, 100);
    });
});

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', (e) => {
    // Press 'H' to scroll home
    if (e.key === 'h' || e.key === 'H') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Press 'C' to scroll to console
    if (e.key === 'c' || e.key === 'C') {
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
        if (title) triggerGlitch(title);
    }
}, 10000);

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
