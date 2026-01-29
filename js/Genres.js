/**
 * Genres.js - Genre presets for One-Key Orchestra
 *
 * Each genre defines BPM, chord progressions, drum pattern, and instrument sounds.
 */

import { st } from './Instruments.js';

export const GENRES = {
    pop: {
        name: 'Pop',
        bpm: 100,
        description: 'Upbeat pop with punchy drums',
        chords: [
            // I-vi-IV-V progression
            { root: st(0) },   // I
            { root: st(0) },
            { root: st(-3) },  // vi
            { root: st(-3) },
            { root: st(5) },   // IV
            { root: st(5) },
            { root: st(7) },   // V
            { root: st(7) }
        ],
        drumStyle: 'pop',
        melodyStyle: 'pop',
        padStyle: 'warm',
        bassStyle: 'punchy',
        percStyle: 'woodblock'
    },

    lofi: {
        name: 'Lo-Fi',
        bpm: 75,
        description: 'Chill lo-fi hip hop vibes',
        chords: [
            // ii-V-I-vi jazzy progression
            { root: st(2) },   // ii (D)
            { root: st(2) },
            { root: st(7) },   // V (G)
            { root: st(7) },
            { root: st(0) },   // I (C)
            { root: st(0) },
            { root: st(-3) },  // vi (Am)
            { root: st(-3) }
        ],
        drumStyle: 'lofi',
        melodyStyle: 'lofi',
        padStyle: 'tape',
        bassStyle: 'mellow',
        percStyle: 'shaker'
    },

    house: {
        name: 'Emotional', // Fred Again.. style
        bpm: 128,
        description: 'Emotional, stuttery garage/house',
        chords: [
            // Emotional loop: IV - I - vi - V
            { root: st(5) },   // IV (uplifting start)
            { root: st(5) },
            { root: st(0) },   // I (grounding)
            { root: st(0) },
            { root: st(-3) },  // vi (emotional minor)
            { root: st(-3) },
            { root: st(7) },   // V (tension)
            { root: st(7) }
        ],
        drumStyle: 'fred',
        melodyStyle: 'vocal',
        padStyle: 'emotional',
        bassStyle: 'reese',
        percStyle: 'glitch'
    }
};

export function getGenre(name) {
    return GENRES[name] || GENRES.pop;
}

export function getGenreList() {
    return Object.entries(GENRES).map(([key, genre]) => ({
        id: key,
        name: genre.name,
        description: genre.description,
        bpm: genre.bpm
    }));
}
