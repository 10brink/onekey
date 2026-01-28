/**
 * Instruments.js - Instrument definitions for One-Key Orchestra
 *
 * Defines the four instruments mapped to beats 1-4, including their
 * oscillator types, frequencies, visual properties, and ADSR envelopes.
 */

export const INSTRUMENTS = {
    melody: {
        name: 'Melody',
        beat: 1,
        oscillator: 'triangle',
        baseFreq: 440, // A4
        color: '#64b5f6', // Blue
        shape: 'spiral',
        envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.7,
            release: 0.4
        }
    },
    pad: {
        name: 'Pad',
        beat: 2,
        oscillator: 'sine',
        baseFreq: 330, // E4
        color: '#ba68c8', // Purple
        shape: 'wave',
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.8,
            release: 0.6
        }
    },
    bass: {
        name: 'Bass',
        beat: 3,
        oscillator: 'sine',
        baseFreq: 110, // A2
        color: '#d4a574', // Gold
        shape: 'circle',
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.6,
            release: 0.3
        }
    },
    percussion: {
        name: 'Perc',
        beat: 4,
        oscillator: 'square',
        baseFreq: 880,
        color: '#ef5350', // Red
        shape: 'particles',
        envelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 0.1,
            release: 0.1
        }
    }
};

// Equal temperament semitone ratio
const SEMITONE = Math.pow(2, 1 / 12);

// Helper: semitones from root to frequency multiplier
const st = (n) => Math.pow(SEMITONE, n);

// Chord progressions - I-vi-IV-V in equal temperament
// All values are semitone offsets converted to frequency multipliers
export const CHORD_PROGRESSIONS = [
    // Bar 1-2: I chord (C major - C E G)
    { bass: st(0), melody: st(0), pad: st(0) },   // Root
    { bass: st(0), melody: st(0), pad: st(0) },
    // Bar 3-4: vi chord (A minor - A C E) - 9 semitones down = -9, or +3 for relative
    { bass: st(-3), melody: st(-3), pad: st(-3) },  // Am (down minor 3rd)
    { bass: st(-3), melody: st(-3), pad: st(-3) },
    // Bar 5-6: IV chord (F major - F A C)
    { bass: st(5), melody: st(5), pad: st(5) },   // F (up perfect 4th)
    { bass: st(5), melody: st(5), pad: st(5) },
    // Bar 7-8: V chord (G major - G B D)
    { bass: st(7), melody: st(7), pad: st(7) },   // G (up perfect 5th)
    { bass: st(7), melody: st(7), pad: st(7) }
];

// Get instrument by beat number (1-4)
export function getInstrumentByBeat(beat) {
    const instruments = Object.values(INSTRUMENTS);
    return instruments.find(i => i.beat === beat) || INSTRUMENTS.bass;
}

// Get chord multipliers for current bar
export function getChordForBar(barNumber) {
    const index = barNumber % CHORD_PROGRESSIONS.length;
    return CHORD_PROGRESSIONS[index];
}
