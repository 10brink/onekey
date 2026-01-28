# One-Key Orchestra - Technical Documentation

## What Is This?

One-Key Orchestra is a browser-based musical game where you create music by pressing a single key (spacebar) or tapping the screen. Think of it like conducting an orchestra with a baton that only moves in one direction — the *when* of your input determines *what* plays.

The game runs on a 4-beat loop at 100 BPM. Each beat is mapped to a different instrument:
- **Beat 1**: Bass (deep, foundational)
- **Beat 2**: Melody (bright, mid-range)
- **Beat 3**: Pad (warm, sustained)
- **Beat 4**: Percussion (sharp, rhythmic)

Hit on time? Beautiful music. Hit off-beat? Deliberate dissonance. There's no fail state — just different musical outcomes.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ InputHandler │────▶│    main.js   │────▶│ AudioEngine │
│  (timing)   │     │ (coordinator)│     │  (sounds)   │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    ▼              ▼
              ┌──────────┐  ┌─────────────┐
              │BeatTracker│  │VisualEngine │
              │ (tempo)   │  │ (graphics)  │
              └──────────┘  └─────────────┘
```

### The Flow

1. **InputHandler** captures spacebar/touch with `performance.now()` timestamp
2. **main.js** coordinates: asks BeatTracker "what beat is this closest to?"
3. **BeatTracker** calculates: nearest beat (1-4), timing accuracy (perfect/good/off)
4. **AudioEngine** plays: correct instrument with appropriate envelope, or dissonant version
5. **VisualEngine** animates: shape corresponding to instrument, glitch if off-beat

## File Breakdown

### `js/Instruments.js`
The "character sheet" for each instrument. Defines:
- Oscillator type (sine, triangle, square)
- Base frequency
- Visual color and shape
- ADSR envelope parameters

Also contains the 8-bar chord progression that modulates frequencies over time.

### `js/BeatTracker.js`
The metronome brain. Tracks time since game start and converts it to musical position:
- Current beat (1-4)
- Bar number (for chord progressions)
- Progress through current beat (0-1)

The `evaluateTiming()` method is the heart of the gameplay — it takes a hit timestamp and returns:
- Which beat it's closest to
- How accurate the timing was (within 50ms = perfect, 150ms = good, else = off)

### `js/AudioEngine.js`
Pure Web Audio API synthesis — no sample files needed. Each note is built from:
- An oscillator generating the base waveform
- A gain node shaping the volume envelope (ADSR)
- Optional harmonics for richness

For dissonance, it layers:
- A slightly detuned (+5%) version of the note
- A minor 2nd interval (the "wrong" note)
- A filtered noise burst

The "minor 2nd interval" trick is borrowed from how horror movie soundtracks work — it's the smallest musical interval and sounds inherently unsettling.

### `js/VisualEngine.js`
Canvas-based graphics running at 60fps. Each instrument has a signature animation:
- **Bass (circle)**: Expanding ring from center
- **Melody (line)**: Line drawn across screen
- **Pad (wave)**: Horizontal sine wave
- **Percussion (particles)**: Exploding particle burst

Off-beat hits trigger a "glitch" effect: screen shake + red scan lines. The visual engine also draws the 4-dot beat indicator at screen bottom.

### `js/InputHandler.js`
Handles the deceptively tricky task of capturing precise input timing. Key details:
- Uses `performance.now()` for microsecond precision (Date.now() isn't accurate enough for music)
- Tracks hold duration for legato vs staccato
- Debounces to prevent double-triggers from mechanical key bounce

### `js/main.js`
The conductor that brings it all together. Manages:
- Game state (start screen vs playing)
- Module initialization
- The render loop (requestAnimationFrame)
- Routing input events through the timing → audio → visual pipeline

## Technical Decisions & Why

### Why Oscillators Over Audio Samples?
1. **No loading time** — game starts instantly
2. **Infinite pitch variation** — easy to implement chord progressions
3. **Easy detuning** — dissonance is just `freq * 1.05`
4. **Smaller footprint** — no audio files to manage

The trade-off is that oscillator sounds are "synthetic" rather than realistic, but that aesthetic fits the game.

### Why Canvas Over DOM Animation?
1. **Particle systems** — DOM can't efficiently handle 30+ moving elements
2. **Smooth 60fps** — no layout thrashing
3. **Glitch effects** — direct pixel manipulation for screen shake

### Why 100 BPM?
It's the "Goldilocks tempo" — fast enough to feel musical (not plodding), slow enough for humans to hit accurately. At 100 BPM, each beat is 600ms apart, giving comfortable timing windows.

### Why No Fail State?
Traditional rhythm games punish mistakes. One-Key Orchestra treats them as *different* music. This reduces frustration and encourages experimentation. The dissonance still sounds intentional because it's musically constructed (minor 2nds, detuning) rather than random noise.

## Lessons Learned

### The AudioContext Autoplay Battle
Browsers block audio from playing until user interaction. The solution:
```javascript
// In startGame(), triggered by click/keypress
await this.audioEngine.initialize();
```
The `initialize()` method creates the AudioContext and calls `resume()` if needed.

### Timing Precision Matters
The difference between "feels responsive" and "feels laggy" is about 50ms. Using `performance.now()` instead of `Date.now()` provides sub-millisecond precision that makes the game feel tight.

### ADSR Envelopes Prevent Clicks
Abruptly starting/stopping oscillators causes audible clicks. The ADSR envelope (Attack-Decay-Sustain-Release) ramps volume smoothly:
```
    ┌──┐
   /    \     ← Attack ramps up, Decay to sustain level
  /      ────┐
 /           │← Sustain holds
/            └── Release fades out
```

### Canvas Trail Effect
Instead of clearing the canvas completely each frame, we draw a semi-transparent rectangle:
```javascript
ctx.fillStyle = 'rgba(18, 18, 24, 0.2)';
ctx.fillRect(0, 0, width, height);
```
This creates a natural "motion blur" as old frames fade rather than vanish.

## Future Ideas
- **Multiple songs** with different chord progressions and tempos
- **Recording/playback** of player sessions
- **Multiplayer** — two players on different keys creating counterpoint
- **Difficulty modes** — tighter timing windows, faster tempos
- **Visual themes** — different color palettes and animation styles

## Quick Reference

| Beat | Instrument | Frequency | Color | Shape |
|------|------------|-----------|-------|-------|
| 1 | Bass | 110 Hz | Gold #d4a574 | Circle |
| 2 | Melody | 440 Hz | Blue #64b5f6 | Line |
| 3 | Pad | 330 Hz | Purple #ba68c8 | Wave |
| 4 | Percussion | 880 Hz | Red #ef5350 | Particles |

| Timing | Window | Result |
|--------|--------|--------|
| Perfect | ±50ms | Clean sound, full visuals |
| Good | ±150ms | Clean sound, normal visuals |
| Off | >150ms | Dissonant sound, glitch visuals |
