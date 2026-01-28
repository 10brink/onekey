/**
 * AudioEngine.js - Web Audio API sound synthesis
 *
 * Creates musical sounds using oscillators with proper sound design.
 * Each instrument loops for a full measure (4 beats) when triggered,
 * layering together to build a complete beat.
 */

import { getInstrumentByBeat, getChordForBar } from './Instruments.js';
import { getGenre, GENRES } from './Genres.js';

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.isInitialized = false;
        this.activeLoops = new Map();
        this.bpm = 100;
        this.beatDuration = 60 / this.bpm;

        // precise scheduler
        this.drumLoopInterval = null; // Legacy, kept just in case but unused
        this.schedulerTimerId = null;
        this.nextLoopTime = 0;
        this.scheduleAheadTime = 0.1; // 100ms
        this.lookahead = 25; // 25ms

        this.isDrumsPlaying = false;
        this.currentGenreId = 'pop';
        this.genre = getGenre(this.currentGenreId);
    }

    async initialize() {
        if (this.isInitialized) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor for glue and punch
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        this.compressor.connect(this.ctx.destination);

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.compressor);

        // Create reverb
        this.reverb = await this.createReverb();
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.3;
        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.isInitialized = true;
    }

    async createReverb() {
        const length = this.ctx.sampleRate * 1.5;
        const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-3 * i / length);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }

        const convolver = this.ctx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.beatDuration = 60 / bpm;
    }

    setGenre(genreId) {
        const genre = getGenre(genreId);
        this.currentGenreId = genreId;
        this.genre = genre;
        this.setBPM(genre.bpm);

        // Update drum loop if playing
        if (this.isDrumsPlaying) {
            this.stopContinuousDrums();
            this.startContinuousDrums();
        }
    }

    playNote(beat, barNumber, accuracy, holdDuration = 200) {
        if (!this.isInitialized) return null;

        const instrument = getInstrumentByBeat(beat);

        // Get chord for current bar from genre
        const chords = this.genre ? this.genre.chords : GENRES.pop.chords;
        const chordIndex = barNumber % chords.length;
        const chord = chords[chordIndex]; // { root: multiplier }

        const isDissonant = accuracy === 'off';

        // Base frequency modified by chord root
        let baseFreq = instrument.baseFreq * chord.root;

        console.log(`🎵 Play Note | Genre: ${this.genre.name} | Bar: ${barNumber + 1} | Beat: ${beat} (${instrument.name}) | Freq: ${Math.round(baseFreq)}Hz ${isDissonant ? '(Dissonant)' : ''}`);

        this.stopLoop(beat);

        switch (beat) {
            case 1: // Melody
                this.playMelodyLoop(baseFreq, isDissonant);
                break;
            case 2: // Pad
                this.playPadLoop(baseFreq, isDissonant);
                break;
            case 3: // Bass
                this.playBassLoop(baseFreq, isDissonant);
                break;
            case 4: // Percussion - Wood block
                this.playPercussionLoop(isDissonant);
                break;
        }

        return { beat, barNumber };
    }

    stopLoop(beat) {
        const loop = this.activeLoops.get(beat);
        if (loop) {
            loop.stop();
            this.activeLoops.delete(beat);
        }
    }

    // Bass: Genre-specific styles
    playBassLoop(freq, isDissonant) {
        const now = this.ctx.currentTime;
        const style = this.genre ? this.genre.bassStyle : 'punchy';
        const sources = [];

        // Play on beats 1 and 3, each note lasts 2 beats
        const beatTimes = [0, this.beatDuration * 2];

        for (const t of beatTimes) {
            const hitTime = now + t;
            const noteFreq = isDissonant ? freq * 1.06 : freq;
            const noteDuration = this.beatDuration * 1.9;

            if (style === 'reese') {
                // Reese Bass: Detuned sawtooths + Lowpass + Distortion
                const oscs = [];
                // 3 detuned saws for width
                [-15, 0, 15].forEach(detune => {
                    const osc = this.ctx.createOscillator();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(noteFreq, hitTime);
                    osc.detune.value = detune;
                    oscs.push(osc);
                });

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, hitTime);
                gain.gain.linearRampToValueAtTime(0.4, hitTime + 0.1); // Slower attack
                gain.gain.setValueAtTime(0.35, hitTime + noteDuration - 0.2);
                gain.gain.linearRampToValueAtTime(0, hitTime + noteDuration);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(150, hitTime);
                filter.frequency.linearRampToValueAtTime(300, hitTime + noteDuration * 0.5); // Filter movement
                filter.Q.value = 2;

                // Simple distortion (clipping)
                const shaper = this.ctx.createWaveShaper();
                shaper.curve = new Float32Array([-0.5, -0.5, 0, 0.5, 0.5]); // Hard clip

                oscs.forEach(osc => {
                    osc.connect(filter);
                    osc.start(hitTime);
                    osc.stop(hitTime + noteDuration + 0.1);
                    sources.push(osc);
                });

                filter.connect(shaper);
                shaper.connect(gain);
                gain.connect(this.masterGain);

            } else {
                // Default 808 Style
                // Main bass oscillator
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(noteFreq, hitTime);

                // Sub bass (one octave down)
                const sub = this.ctx.createOscillator();
                sub.type = 'sine';
                sub.frequency.setValueAtTime(noteFreq / 2, hitTime);

                // Slight pitch drop for punch
                osc.frequency.exponentialRampToValueAtTime(noteFreq * 0.98, hitTime + 0.1);

                // Gain envelope - punchy attack
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, hitTime);
                gain.gain.linearRampToValueAtTime(0.7, hitTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.5, hitTime + 0.1);
                gain.gain.setValueAtTime(0.5, hitTime + noteDuration - 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, hitTime + noteDuration);

                const subGain = this.ctx.createGain();
                subGain.gain.setValueAtTime(0, hitTime);
                subGain.gain.linearRampToValueAtTime(0.5, hitTime + 0.02);
                subGain.gain.setValueAtTime(0.4, hitTime + noteDuration - 0.1);
                subGain.gain.exponentialRampToValueAtTime(0.01, hitTime + noteDuration);

                // Lowpass filter for warmth
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 200;
                filter.Q.value = 1;

                osc.connect(gain);
                sub.connect(subGain);
                gain.connect(this.masterGain);
                subGain.connect(filter);
                filter.connect(this.masterGain);

                osc.start(hitTime);
                sub.start(hitTime);
                osc.stop(hitTime + noteDuration + 0.1);
                sub.stop(hitTime + noteDuration + 0.1);

                sources.push(osc, sub);
            }
        }

        this.activeLoops.set(3, { // Beat 3 = Bass
            stop: () => sources.forEach(s => { try { s.stop(); } catch (e) { } })
        });
    }

    // Melody: Warm pop synth lead or vocal chop style
    playMelodyLoop(freq, isDissonant) {
        const now = this.ctx.currentTime;
        const measureDuration = this.beatDuration * 4;
        const style = this.genre ? this.genre.melodyStyle : 'pop';
        const sources = [];

        // Equal temperament semitone ratio
        const st = (n) => Math.pow(Math.pow(2, 1 / 12), n);

        // Catchy 8-note pop hook pattern (eighth notes)
        const pattern = isDissonant
            ? [st(0), st(6), st(8), st(6), st(3), st(6), st(11), st(6)]
            : [st(0), st(7), st(9), st(7), st(4), st(7), st(12), st(7)];

        // Velocity pattern for groove
        const velocities = [1.0, 0.6, 0.85, 0.5, 0.9, 0.6, 1.0, 0.55];

        for (let i = 0; i < 8; i++) {
            const hitTime = now + (this.beatDuration * 0.5 * i);
            const noteFreq = freq * pattern[i];
            const noteDuration = this.beatDuration * 0.45;
            const velocity = velocities[i];

            if (style === 'vocal') {
                // "Vocal Chop" simulation using formant-like filtering + glide
                // Triangle/Saw mix with rapid pitch envelope for "sample start" feel
                const osc = this.ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(noteFreq * 0.95, hitTime); // Start slightly flat
                osc.frequency.linearRampToValueAtTime(noteFreq, hitTime + 0.05); // Scoop up

                // Formant filter (Bandpass)
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                // Vocal formants usually 800-2000Hz region
                filter.frequency.setValueAtTime(800 + Math.random() * 500, hitTime);
                filter.frequency.exponentialRampToValueAtTime(1500, hitTime + 0.1);
                filter.Q.value = 1.5;

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, hitTime);
                gain.gain.linearRampToValueAtTime(0.4 * velocity, hitTime + 0.02);
                // Sharp cutoff for chop feel
                gain.gain.setValueAtTime(0.3 * velocity, hitTime + noteDuration * 0.8);
                gain.gain.exponentialRampToValueAtTime(0.01, hitTime + noteDuration);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);
                gain.connect(this.reverb); // Heavy reverb for vibe

                osc.start(hitTime);
                osc.stop(hitTime + noteDuration + 0.1);
                sources.push(osc);

            } else {
                // Pop Style (Default)
                // Two detuned oscillators
                const oscs = [];
                const detuneAmounts = [-6, 6];

                for (const detune of detuneAmounts) {
                    const osc = this.ctx.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.value = noteFreq;
                    osc.detune.value = detune;
                    oscs.push(osc);
                }

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, hitTime);
                gain.gain.linearRampToValueAtTime(0.12 * velocity, hitTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.08 * velocity, hitTime + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, hitTime + noteDuration);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, hitTime);
                filter.frequency.exponentialRampToValueAtTime(1200, hitTime + noteDuration * 0.5);
                filter.Q.value = 1.5;

                for (const osc of oscs) {
                    osc.connect(filter);
                    osc.start(hitTime);
                    osc.stop(hitTime + noteDuration + 0.05);
                    sources.push(osc);
                }

                filter.connect(gain);
                gain.connect(this.masterGain);
                gain.connect(this.reverb);
            }
        }

        this.activeLoops.set(1, { // Beat 1 = Melody
            stop: () => sources.forEach(s => { try { s.stop(); } catch (e) { } })
        });
    }

    // Pad: Lush, warm sustained chord - spans full measure
    playPadLoop(freq, isDissonant) {
        const now = this.ctx.currentTime;
        const measureDuration = this.beatDuration * 4;
        const style = this.genre ? this.genre.padStyle : 'warm';
        const sources = [];

        // Equal temperament semitone ratio
        const st = (n) => Math.pow(Math.pow(2, 1 / 12), n);

        // Proper chord voicing: root, major 3rd (4 semitones), 5th (7), octave (12)
        const chord = isDissonant
            ? [st(0), st(3), st(6), st(12)]   // Minor/diminished
            : [st(0), st(4), st(7), st(12)];  // Major triad + octave

        const masterGain = this.ctx.createGain();

        if (style === 'emotional') {
            // Emotional Pad: Slow swell, then sustain
            masterGain.gain.setValueAtTime(0, now);
            masterGain.gain.linearRampToValueAtTime(0.18, now + 1.5); // Very slow attack like a breath
            masterGain.gain.setValueAtTime(0.18, now + measureDuration - 0.2);
            masterGain.gain.linearRampToValueAtTime(0, now + measureDuration + 0.5); // Long tail
        } else {
            // Default warm pad
            masterGain.gain.setValueAtTime(0, now);
            masterGain.gain.linearRampToValueAtTime(0.15, now + 0.3);
            masterGain.gain.setValueAtTime(0.15, now + measureDuration - 0.5);
            masterGain.gain.linearRampToValueAtTime(0, now + measureDuration);
        }

        // Filter setup
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // Emotional style has brighter, opening filter
        filter.frequency.value = style === 'emotional' ? 800 : 2000;
        if (style === 'emotional') {
            filter.frequency.linearRampToValueAtTime(2500, now + measureDuration); // Filter opens up
        }
        filter.Q.value = 0.5;

        for (const mult of chord) {
            // Multiple detuned oscillators per note for lushness
            for (let d = -1; d <= 1; d++) {
                const osc = this.ctx.createOscillator();
                osc.type = 'sine'; // Sines are cleaner for emotional layering
                // For emotional style, add some saw layer for texture?
                if (style === 'emotional' && d === 0) osc.type = 'triangle';

                osc.frequency.value = freq * mult;
                const drift = style === 'emotional' ? 6 : 4;
                osc.detune.value = d * 8 + (Math.random() - 0.5) * drift;

                osc.connect(filter);
                osc.start(now);
                osc.stop(now + measureDuration + 0.5);
                sources.push(osc);
            }
        }

        filter.connect(masterGain);
        masterGain.connect(this.masterGain);
        masterGain.connect(this.reverb);

        this.activeLoops.set(2, { // Beat 2 = Pad
            stop: () => sources.forEach(s => { try { s.stop(); } catch (e) { } })
        });
    }

    // Drums: Genre-specific patterns
    playDrumLoop(isDissonant, time = null) {
        // Use scheduled time if provided, otherwise immediate
        const now = (time !== null) ? time : this.ctx.currentTime;

        const sources = [];
        const style = this.genre ? this.genre.drumStyle : 'pop';

        if (style === 'pop') {
            const swing = 0.02;
            // Kick: 1, 2.5, 3
            [0, this.beatDuration * 1.5, this.beatDuration * 2].forEach(t => {
                sources.push(...this.createKick(now + t, isDissonant));
            });
            // Snare: 2, 4 with ghost on 3.5
            [this.beatDuration, this.beatDuration * 3].forEach(t => {
                sources.push(...this.createSnare(now + t, isDissonant));
            });
            sources.push(...this.createSnare(now + this.beatDuration * 2.5, isDissonant, 0.3));

            // Hi-hats: 16ths with accents
            for (let i = 0; i < 16; i++) {
                const t = this.beatDuration * 0.25 * i;
                const swingOffset = (i % 2 === 1) ? swing : 0;
                const velocity = (i % 4 === 0) ? 1.0 : (i % 2 === 0 ? 0.6 : 0.4);
                const isOpen = (i === 7 || i === 15);
                sources.push(...this.createHiHat(now + t + swingOffset, isOpen, isDissonant, velocity));
            }

        } else if (style === 'lofi') {
            const swing = 0.06; // Heavy swing
            // Kick: lazy, offset
            const kickTimes = [0, this.beatDuration * 1.75, this.beatDuration * 2.5];
            kickTimes.forEach(t => sources.push(...this.createKick(now + t, isDissonant, 0.8)));

            // Snare: 2, 4 slightly late
            [this.beatDuration + 0.02, this.beatDuration * 3 + 0.03].forEach(t => {
                sources.push(...this.createSnare(now + t, isDissonant, 0.7));
            });

            // Hats: lazy 8ths
            for (let i = 0; i < 8; i++) {
                const t = this.beatDuration * 0.5 * i;
                const swingOffset = (i % 2 === 1) ? swing : 0;
                // Randomize timing slightly for human feel
                const humanize = (Math.random() - 0.5) * 0.02;
                sources.push(...this.createHiHat(now + t + swingOffset + humanize, false, isDissonant, 0.5 + Math.random() * 0.3));
            }

        } else if (style === 'fred') {
            // UK Garage / Emotional House vibe
            // Kick pattern: 1, (2)&, (3)&, 4 - syncopated
            const kickTimes = [0, this.beatDuration * 1.75, this.beatDuration * 2.5, this.beatDuration * 3.5];
            // Add a 4-on-floor ghost feel for drive
            const ghostKicks = [this.beatDuration, this.beatDuration * 3];

            kickTimes.forEach(t => sources.push(...this.createKick(now + t, isDissonant, 1.0)));
            ghostKicks.forEach(t => sources.push(...this.createKick(now + t, isDissonant, 0.4)));

            // Crisp Rimshot/Snare on 2 and 4
            [this.beatDuration, this.beatDuration * 3].forEach(t => {
                sources.push(...this.createSnare(now + t, isDissonant, 0.9));
            });

            // Fast, stuttery hats
            for (let i = 0; i < 16; i++) {
                const t = this.beatDuration * 0.25 * i;
                // Add some 32nd note rolls irregularly
                if (Math.random() > 0.8) {
                    sources.push(...this.createHiHat(now + t + 0.05, false, isDissonant, 0.4));
                }

                // Shuffle feel
                const swing = 0.04;
                const swingOffset = (i % 2 === 1) ? swing : 0;

                const velocity = (i % 4 === 2) ? 0.8 : 0.4;
                sources.push(...this.createHiHat(now + t + swingOffset, false, isDissonant, velocity));
            }
        }

        this.activeLoops.set('drums', {
            stop: () => sources.forEach(s => { try { s.stop(); } catch (e) { } })
        });
    }

    createKick(time, isDissonant, velocity = 1.0) {
        // Sine wave with pitch envelope for punch
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isDissonant ? 180 : 150, time);
        osc.frequency.exponentialRampToValueAtTime(isDissonant ? 50 : 40, time + 0.08);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        // Click transient
        const click = this.ctx.createOscillator();
        click.type = 'square';
        click.frequency.value = 1000;

        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.3 * velocity, time);
        clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.01);

        const clickFilter = this.ctx.createBiquadFilter();
        clickFilter.type = 'highpass';
        clickFilter.frequency.value = 500;

        osc.connect(gain);
        gain.connect(this.masterGain);
        click.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(this.masterGain);

        osc.start(time);
        click.start(time);
        osc.stop(time + 0.35);
        click.stop(time + 0.02);

        return [osc, click];
    }

    createSnare(time, isDissonant, velocity = 1.0) {
        // Body (pitched oscillator)
        const body = this.ctx.createOscillator();
        body.type = 'triangle';
        body.frequency.value = isDissonant ? 220 : 180;

        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(0.5 * velocity, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

        // Noise for snare rattle
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = isDissonant ? 2000 : 3000;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * velocity, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

        body.connect(bodyGain);
        bodyGain.connect(this.masterGain);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        body.start(time);
        noise.start(time);
        body.stop(time + 0.15);
        noise.stop(time + 0.15);

        return [body, noise];
    }

    createHiHat(time, isOpen, isDissonant, velocity = 1.0) {
        const duration = isOpen ? 0.12 : 0.05;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter for metallic character
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = isDissonant ? 8000 : 10000;
        filter.Q.value = 1;

        // Highpass to remove low end
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 7000;

        const gain = this.ctx.createGain();
        const baseVolume = isOpen ? 0.15 : 0.2;
        gain.gain.setValueAtTime(baseVolume * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        noise.connect(filter);
        filter.connect(hpf);
        hpf.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
        noise.stop(time + duration);

        return [noise];
    }

    // Wood block percussion loop
    playPercussionLoop(isDissonant) {
        const now = this.ctx.currentTime;
        const sources = [];

        // Varied wood block pattern across the measure
        const pattern = [
            { time: 0, pitch: 1.0, velocity: 0.9 },
            { time: this.beatDuration * 0.5, pitch: 1.2, velocity: 0.5 },
            { time: this.beatDuration * 1, pitch: 0.85, velocity: 0.7 },
            { time: this.beatDuration * 1.75, pitch: 1.1, velocity: 0.4 },
            { time: this.beatDuration * 2.25, pitch: 1.0, velocity: 0.8 },
            { time: this.beatDuration * 2.5, pitch: 1.15, velocity: 0.5 },
            { time: this.beatDuration * 3, pitch: 0.9, velocity: 0.7 },
            { time: this.beatDuration * 3.5, pitch: 1.2, velocity: 0.6 },
        ];

        for (const hit of pattern) {
            const hitTime = now + hit.time;
            sources.push(...this.createWoodBlock(hitTime, hit.pitch, hit.velocity, isDissonant));
        }

        this.activeLoops.set(4, {
            stop: () => sources.forEach(s => { try { s.stop(); } catch (e) { } })
        });
    }

    createWoodBlock(time, pitchMult = 1.0, velocity = 1.0, isDissonant = false) {
        // Wood block: two resonant frequencies with quick decay
        const baseFreq = isDissonant ? 900 : 800;
        const freq1 = baseFreq * pitchMult;
        const freq2 = freq1 * 1.5; // Harmonic

        // Primary tone
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = freq1;

        // Secondary harmonic
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq2;

        // Sharp attack, quick decay like wood
        const gain1 = this.ctx.createGain();
        gain1.gain.setValueAtTime(0.35 * velocity, time);
        gain1.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.15 * velocity, time);
        gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        // Bandpass to shape the woody tone
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq1;
        filter.Q.value = 15; // High Q for resonant "wood" sound

        osc1.connect(filter);
        filter.connect(gain1);
        gain1.connect(this.masterGain);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.1);
        osc2.stop(time + 0.08);

        return [osc1, osc2];
    }

    playMetronomeClick(isDownbeat = false) {
        if (!this.isInitialized) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = isDownbeat ? 1000 : 800;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isDownbeat ? 0.06 : 0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.02);
    }

    // Start continuous drum loop that plays every measure
    // Start continuous drum loop using precise lookahead scheduler
    startContinuousDrums() {
        if (this.isDrumsPlaying) return;
        this.isDrumsPlaying = true;

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Start scheduling from now
        this.nextLoopTime = this.ctx.currentTime;
        this.scheduler();
    }

    // Lookahead scheduler loop
    scheduler() {
        if (!this.isDrumsPlaying) return;

        // Schedule all loops that need to trigger within the schedule window
        while (this.nextLoopTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleLoop(this.nextLoopTime);

            // Advance by exactly 4 beats
            this.nextLoopTime += this.beatDuration * 4;
        }

        // Check again soon
        this.schedulerTimerId = setTimeout(() => this.scheduler(), this.lookahead);
    }

    scheduleLoop(time) {
        // Only schedule if we are running
        if (this.isDrumsPlaying) {
            this.playDrumLoop(false, time);
        }
    }

    // Stop continuous drum loop
    stopContinuousDrums() {
        this.isDrumsPlaying = false;

        // Clear timeout
        if (this.schedulerTimerId) {
            clearTimeout(this.schedulerTimerId);
            this.schedulerTimerId = null;
        }

        // Clear legacy interval if exists
        if (this.drumLoopInterval) {
            clearInterval(this.drumLoopInterval);
            this.drumLoopInterval = null;
        }

        // Stop the currently playing audio source to prevent overlap
        const loop = this.activeLoops.get('drums');
        if (loop) {
            loop.stop();
            this.activeLoops.delete('drums');
        }
    }

    stopAll() {
        this.stopContinuousDrums();
        for (const [beat, loop] of this.activeLoops) {
            loop.stop();
        }
        this.activeLoops.clear();
    }

    // Stop all instruments but keep drums playing (for returning to menu)
    stopInstruments() {
        for (const [beat, loop] of this.activeLoops) {
            // Check if it's the drum loop (we used key 'drums' or 4 depending on context)
            // In playDrumLoop we set key 'drums'. 
            // In playNote we stop loop(beat), passing 1,2,3,4. 
            // Percussion beat 4 uses key 4 for woodblock. Drums use 'drums'.
            if (beat !== 'drums') {
                loop.stop();
                this.activeLoops.delete(beat);
            }
        }
    }
}
