/**
 * main.js - Entry point and game coordinator for One-Key Orchestra
 *
 * Initializes all game modules, manages game state (start screen vs playing),
 * runs the main game loop, and coordinates input -> timing -> audio -> visuals.
 */

import { AudioEngine } from './AudioEngine.js';
import { VisualEngine } from './VisualEngine.js';
import { BeatTracker } from './BeatTracker.js';
import { InputHandler } from './InputHandler.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.startScreen = document.getElementById('startScreen');
        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.homeButton = document.getElementById('homeButton');

        this.audioEngine = new AudioEngine();
        this.visualEngine = new VisualEngine(this.canvas);
        this.beatTracker = new BeatTracker(100); // 100 BPM
        this.inputHandler = new InputHandler();

        this.isPlaying = false;
        this.isPaused = false;
        this.lastBeat = 0;
        this.metronomeEnabled = true; // Subtle beat indication
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;

        this.setupEventListeners();
        this.startRenderLoop();
    }

    setupEventListeners() {
        // Start button click
        this.startButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.startGame();
        });

        // Also start on any keypress from start screen
        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying && (e.code === 'Space' || e.code === 'Enter')) {
                e.preventDefault();
                this.startGame();
            }
        });

        // Touch to start on mobile
        this.startScreen.addEventListener('touchstart', (e) => {
            // Only start if not clicking a genre button
            if (!e.target.closest('.genre-btn') && !this.isPlaying) {
                e.preventDefault();
                this.startGame();
            }
        }, { passive: false });

        // Genre selection
        const genreBtns = document.querySelectorAll('.genre-btn');
        genreBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                // Update UI
                genreBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Set genre
                const genreId = btn.dataset.genre;
                this.audioEngine.setGenre(genreId);

                // Update beat tracker BPM if not playing (will be set on start)
                // If playing, setGenre handles BPM update but we need to sync tracker
                if (this.isPlaying) {
                    this.beatTracker.setBPM(this.audioEngine.bpm);
                } else {
                    // Just update the preview BPM
                    this.beatTracker.setBPM(this.audioEngine.genre.bpm);
                }
            });
        });

        // Pause button
        this.pauseButton.addEventListener('click', () => this.togglePause());

        // Home button
        this.homeButton.addEventListener('click', () => this.goHome());

        // Escape key updates
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.isPlaying) {
                this.togglePause();
            }
        });

        // Note start callback
        this.inputHandler.onNoteStart = (timestamp) => {
            this.handleNoteStart(timestamp);
        };

        // Note end callback (for hold duration)
        this.inputHandler.onNoteEnd = (startTime, endTime) => {
            // Hold duration affects the current/last played note
            // The actual sound is triggered on note start
        };
    }

    async startGame() {
        if (this.isPlaying) return;

        try {
            // Initialize audio (must be on user interaction)
            await this.audioEngine.initialize();

            // Sync visual engine's beat tracker with audio context
            this.beatTracker.setAudioContext(this.audioEngine.ctx);

            // Start continuous drums (uses current genre)
            this.audioEngine.startContinuousDrums();

            // Hide start screen, show pause button
            this.startScreen.classList.add('hidden');
            this.pauseButton.classList.remove('hidden');
            this.homeButton.classList.remove('hidden');

            // Start systems
            this.beatTracker.start();
            this.inputHandler.start();
            this.isPlaying = true;
            this.isPaused = false;

            console.log('Game started! Press spacebar on the beat.');
        } catch (error) {
            console.error('Failed to start game:', error);
        }
    }

    goHome() {
        if (!this.isPlaying) return;

        // Stop game systems
        this.beatTracker.stop();
        this.inputHandler.stop();
        this.audioEngine.stopInstruments(); // Keeps drums playing

        // Reset state
        this.isPlaying = false;
        this.isPaused = false;
        this.score = 0;
        this.streak = 0;

        // UI Updates
        this.startScreen.classList.remove('hidden');
        this.pauseButton.classList.add('hidden');
        this.homeButton.classList.add('hidden');
        this.pauseButton.classList.remove('paused'); // Reset pause icon
    }

    handleNoteStart(timestamp) {
        // Evaluate timing accuracy
        const timing = this.beatTracker.evaluateTiming(timestamp);

        // Calculate hold duration (use default if note is quick)
        const holdDuration = Math.max(150, this.inputHandler.getHoldDuration() || 200);

        // Update score based on accuracy
        if (timing.accuracy === 'perfect') {
            this.score += 100 * (1 + this.streak * 0.1); // Bonus for streak
            this.streak++;
        } else if (timing.accuracy === 'good') {
            this.score += 50 * (1 + this.streak * 0.05);
            this.streak++;
        } else {
            // Off beat - lose points and reset streak
            this.score = Math.max(0, this.score - 25);
            this.streak = 0;
        }

        // Track best streak
        if (this.streak > this.bestStreak) {
            this.bestStreak = this.streak;
        }

        // Round score
        this.score = Math.round(this.score);

        // Play the appropriate instrument
        this.audioEngine.playNote(
            timing.nearestBeat,
            timing.barNumber,
            timing.accuracy,
            holdDuration
        );

        // Trigger visual feedback with score info
        this.visualEngine.triggerVisual(timing.nearestBeat, timing.accuracy);
        this.visualEngine.showHitFeedback(timing.accuracy, this.streak);

        // Log for debugging
        console.log(`Beat ${timing.nearestBeat} - ${timing.accuracy} | Score: ${this.score} | Streak: ${this.streak}`);
    }

    startRenderLoop() {
        const loop = () => {
            // Check for beat changes (for metronome)
            if (this.isPlaying && !this.isPaused && this.metronomeEnabled) {
                const beatInfo = this.beatTracker.getCurrentBeatInfo();
                const currentBeat = Math.floor(beatInfo.totalBeats);

                if (currentBeat !== this.lastBeat) {
                    this.lastBeat = currentBeat;
                    // Play subtle metronome click
                    const isDownbeat = (currentBeat % 4) === 0;
                    this.audioEngine.playMetronomeClick(isDownbeat);
                }
            }

            // Render visuals
            this.visualEngine.render(this.beatTracker, this.score, this.streak);

            requestAnimationFrame(loop);
        };

        loop();
    }

    togglePause() {
        if (!this.isPlaying) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.beatTracker.pause();
            this.inputHandler.stop();
            this.audioEngine.stopAll();
            this.pauseButton.classList.add('paused');
        } else {
            this.beatTracker.resume();
            this.inputHandler.start();
            this.pauseButton.classList.remove('paused');
        }
    }

    // Toggle metronome on/off
    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;
        return this.metronomeEnabled;
    }

    // Change tempo
    setBPM(bpm) {
        this.beatTracker.setBPM(bpm);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.game = new Game();
        console.log('Game initialized');
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});
