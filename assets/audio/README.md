# Audio Assets Guide

Place your audio files in this directory with the following names:

## 📁 Required Audio Files:

### Background Music (Loop)
- **File:** `background.mp3`
- **Type:** Ambient/Cyberpunk music
- **Duration:** 1-3 minutes (will loop automatically)
- **Volume:** Will play at 20% by default (adjustable in code)
- **Recommended:** Dark ambient, synthwave, or cyberpunk beats

### UI Sound Effects

1. **hover.mp3**
   - Triggered when mouse enters link blocks
   - Duration: 50-100ms
   - Style: Subtle beep or whoosh

2. **click.mp3**
   - Triggered on button/link clicks
   - Duration: 50-150ms
   - Style: Sharp click or tech beep

3. **boot.mp3**
   - Triggered on system boot sequence
   - Duration: 1-2 seconds
   - Style: Tech startup sound, rising pitch

4. **glitch.mp3**
   - Triggered on random glitch effects
   - Duration: 100-300ms
   - Style: Digital glitch, static burst

5. **success.mp3**
   - Triggered on successful actions
   - Duration: 200-500ms
   - Style: Confirmation beep, positive tone

## 🎵 Format Recommendations:
- **Format:** MP3 (best compatibility)
- **Alternative:** OGG, WAV
- **Bitrate:** 128-192 kbps for effects, 256+ for background
- **Sample Rate:** 44.1 kHz or 48 kHz

## 🔊 Free Sound Resources:
- **Freesound.org** - https://freesound.org/
- **Zapsplat** - https://www.zapsplat.com/
- **Mixkit** - https://mixkit.co/free-sound-effects/
- **Pixabay Audio** - https://pixabay.com/music/

## 🎛️ Volume Adjustment:
You can adjust volumes in `script.js`:
- Background music: `playBackgroundMusic(0.2)` - Change 0.2 to 0.0-1.0
- Sound effects: Already set in the code (hover: 0.3, click: 0.5, etc.)

## ⚠️ Fallback Behavior:
If audio files are not found, the system automatically uses synthesized tones as fallback.
No errors will occur - the page will work with or without audio files.
