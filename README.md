# One-Key Orchestra

A browser-based musical game where you create music with a single key. Press spacebar on the beat to layer instruments — timing determines the sound.

**[Play Now](https://nicktenbrink.com/games/onekey)** *(update with your actual URL)*

## How to Play

1. Press **SPACE** (or tap on mobile) in time with the beat
2. Each beat triggers a different instrument:
   - **Beat 1**: Melody (blue)
   - **Beat 2**: Pad (purple)
   - **Beat 3**: Bass (gold)
   - **Beat 4**: Percussion (red)
3. Hit on time = clean sound. Hit off-beat = intentional dissonance
4. There's no fail state — just different music

## Features

- **Three genres**: Pop (100 BPM), Lo-Fi (75 BPM), Emotional House (128 BPM)
- **Real-time synthesis**: All sounds generated with Web Audio API — no samples
- **Visual feedback**: Each instrument has unique animations; off-beat hits trigger glitch effects
- **Chord progressions**: Music evolves over 8-bar cycles
- **Mobile support**: Touch-friendly with responsive design
- **Retina/HiDPI**: Crisp rendering on high-DPI displays

## Tech Stack

- Vanilla JavaScript (ES6 modules)
- Web Audio API for synthesis
- Canvas 2D for visuals
- No dependencies, no build step

## Run Locally

```bash
# Clone the repo
git clone https://github.com/yourusername/onekey.git
cd onekey

# Serve with any static server
npx serve .
# or
python -m http.server 8000
```

Open `http://localhost:8000` (or the port shown).

> **Note**: Must be served over HTTP due to ES modules. Opening `index.html` directly won't work.

## Project Structure

```
onekey/
├── index.html          # Main page
├── style.css           # Styling
└── js/
    ├── main.js         # Game coordinator
    ├── AudioEngine.js  # Web Audio synthesis
    ├── VisualEngine.js # Canvas rendering
    ├── BeatTracker.js  # Tempo & timing
    ├── InputHandler.js # Keyboard/touch input
    ├── Instruments.js  # Sound definitions
    └── Genres.js       # Genre presets
```

## Controls

| Key | Action |
|-----|--------|
| Space | Play note |
| Escape | Pause/Resume |

## Credits

Built with [Claude Code](https://claude.ai/code)

## License

MIT
