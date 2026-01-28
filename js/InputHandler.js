/**
 * InputHandler.js - Keyboard and touch input handling
 *
 * Captures spacebar and touch events with precise timing using
 * performance.now(). Tracks key down/up for hold duration calculation.
 * Debounces rapid inputs to prevent accidental double-triggers.
 */

export class InputHandler {
    constructor() {
        this.onNoteStart = null; // Callback: (timestamp) => void
        this.onNoteEnd = null;   // Callback: (startTime, endTime) => void
        this.isHolding = false;
        this.holdStartTime = null;
        this.lastTriggerTime = 0;
        this.debounceMs = 100; // Minimum time between triggers

        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        this.boundTouchStart = this.handleTouchStart.bind(this);
        this.boundTouchEnd = this.handleTouchEnd.bind(this);
    }

    start() {
        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
        document.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        document.addEventListener('touchend', this.boundTouchEnd);
    }

    stop() {
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        document.removeEventListener('touchstart', this.boundTouchStart);
        document.removeEventListener('touchend', this.boundTouchEnd);
        this.isHolding = false;
        this.holdStartTime = null;
    }

    handleKeyDown(e) {
        // Only respond to spacebar
        if (e.code !== 'Space') return;

        // Prevent page scroll
        e.preventDefault();

        // Ignore key repeat (holding key down)
        if (e.repeat) return;

        this.triggerNoteStart();
    }

    handleKeyUp(e) {
        if (e.code !== 'Space') return;
        e.preventDefault();
        this.triggerNoteEnd();
    }

    handleTouchStart(e) {
        // Prevent default to avoid double-tap zoom and other mobile behaviors
        e.preventDefault();
        this.triggerNoteStart();
    }

    handleTouchEnd(e) {
        this.triggerNoteEnd();
    }

    triggerNoteStart() {
        const now = performance.now();

        // Debounce rapid inputs
        if (now - this.lastTriggerTime < this.debounceMs) {
            return;
        }

        // Don't start new note if already holding
        if (this.isHolding) return;

        this.isHolding = true;
        this.holdStartTime = now;
        this.lastTriggerTime = now;

        if (this.onNoteStart) {
            this.onNoteStart(now);
        }
    }

    triggerNoteEnd() {
        if (!this.isHolding) return;

        const endTime = performance.now();
        const startTime = this.holdStartTime;

        this.isHolding = false;
        this.holdStartTime = null;

        if (this.onNoteEnd) {
            this.onNoteEnd(startTime, endTime);
        }
    }

    // Get current hold duration (while holding)
    getHoldDuration() {
        if (!this.isHolding || this.holdStartTime === null) {
            return 0;
        }
        return performance.now() - this.holdStartTime;
    }
}
