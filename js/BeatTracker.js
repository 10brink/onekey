/**
 * BeatTracker.js - Tempo and beat detection system
 *
 * Tracks the current beat position within a 4-beat bar at a given BPM.
 * Calculates timing accuracy for player input and determines which
 * instrument should play based on proximity to beat centers.
 */

export class BeatTracker {
    constructor(bpm = 100) {
        this.bpm = bpm;
        this.beatDuration = 60000 / bpm; // ms per beat (fallback)
        this.startTime = null;
        this.isRunning = false;
        this.isPaused = false;
        this.pausedAt = null;
        this.totalPausedTime = 0;
        this.barCount = 0;

        // Audio Context for sync
        this.audioCtx = null;

        // Timing windows (in ms)
        this.perfectWindow = 50;
        this.goodWindow = 150;
    }

    setAudioContext(ctx) {
        this.audioCtx = ctx;
    }

    start() {
        if (this.audioCtx) {
            this.startTime = this.audioCtx.currentTime;
        } else {
            this.startTime = performance.now();
        }
        this.isRunning = true;
        this.barCount = 0;
    }

    stop() {
        this.isRunning = false;
        this.startTime = null;
        this.isPaused = false;
        this.pausedAt = null;
        this.totalPausedTime = 0;
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        if (this.audioCtx) {
            this.pausedAt = this.audioCtx.currentTime;
        } else {
            this.pausedAt = performance.now();
        }
    }

    resume() {
        if (!this.isPaused) return;

        if (this.audioCtx) {
            this.totalPausedTime += this.audioCtx.currentTime - this.pausedAt;
        } else {
            this.totalPausedTime += performance.now() - this.pausedAt;
        }

        this.isPaused = false;
        this.pausedAt = null;
    }

    // Get current time position in the beat cycle
    getCurrentBeatInfo() {
        if (!this.isRunning || this.startTime === null) {
            return { beat: 1, progress: 0, barNumber: 0, totalBeats: 0 };
        }

        let elapsed;
        let beatDur;

        // Use AudioContext time if available (seconds), else performance.now (ms)
        if (this.audioCtx) {
            const now = this.isPaused ? this.pausedAt : this.audioCtx.currentTime;
            elapsed = (now - this.startTime - this.totalPausedTime) * 1000; // Convert to ms
            beatDur = 60000 / this.bpm;
        } else {
            const now = this.isPaused ? this.pausedAt : performance.now();
            elapsed = now - this.startTime - this.totalPausedTime;
            beatDur = 60000 / this.bpm;
        }

        const totalBeats = elapsed / beatDur;
        const currentBeat = (Math.floor(totalBeats) % 4) + 1; // 1-4
        const beatProgress = totalBeats % 1; // 0-1 within current beat
        const barNumber = Math.floor(totalBeats / 4);

        return {
            beat: currentBeat,
            progress: beatProgress,
            barNumber: barNumber,
            totalBeats: totalBeats
        };
    }

    // Evaluate timing accuracy for a hit
    // hitTime is always from performance.now() (milliseconds)
    evaluateTiming(hitTime) {
        if (!this.isRunning || this.startTime === null) {
            return { accuracy: 'off', nearestBeat: 1, offset: 0, barNumber: 0 };
        }

        let elapsed;
        // Convert to consistent milliseconds
        if (this.audioCtx) {
            // startTime is in AudioContext seconds, convert hitTime from performance.now to audio time
            // We need to find the elapsed time in the audio timeline
            // performance.now() and audioCtx.currentTime don't have a fixed relationship,
            // so we calculate elapsed based on current audio time minus paused time
            const audioNow = this.audioCtx.currentTime;
            elapsed = (audioNow - this.startTime - this.totalPausedTime) * 1000; // Convert to ms
        } else {
            elapsed = hitTime - this.startTime - this.totalPausedTime;
        }

        const beatPosition = elapsed / this.beatDuration;

        // Find nearest beat center
        const nearestBeatIndex = Math.round(beatPosition);
        const nearestBeat = (nearestBeatIndex % 4) + 1; // 1-4

        // Calculate offset from beat center (in ms)
        const offset = (beatPosition - nearestBeatIndex) * this.beatDuration;
        const absOffset = Math.abs(offset);

        let accuracy;
        if (absOffset <= this.perfectWindow) {
            accuracy = 'perfect';
        } else if (absOffset <= this.goodWindow) {
            accuracy = 'good';
        } else {
            accuracy = 'off';
        }

        const barNumber = Math.floor(nearestBeatIndex / 4);

        return {
            accuracy,
            nearestBeat,
            offset,
            barNumber
        };
    }

    // Get time until next beat (for scheduling)
    getTimeToNextBeat() {
        if (!this.isRunning || this.startTime === null) {
            return this.beatDuration;
        }

        let elapsed;
        if (this.audioCtx) {
            const audioNow = this.audioCtx.currentTime;
            elapsed = (audioNow - this.startTime - this.totalPausedTime) * 1000;
        } else {
            elapsed = performance.now() - this.startTime - this.totalPausedTime;
        }

        const beatPosition = elapsed / this.beatDuration;
        const nextBeatTime = (Math.floor(beatPosition) + 1) * this.beatDuration;

        return nextBeatTime - elapsed;
    }

    // Get pulse intensity (0-1) for visual feedback
    getPulseIntensity() {
        const info = this.getCurrentBeatInfo();
        // Pulse peaks at beat start, fades during beat
        // Use cosine for smooth falloff
        const intensity = Math.cos(info.progress * Math.PI * 2) * 0.5 + 0.5;
        return intensity;
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.beatDuration = 60000 / bpm;
    }
}
