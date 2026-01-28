/**
 * VisualEngine.js - Canvas rendering and animations
 *
 * Handles all visual feedback: background pulse, instrument-specific
 * animations (circles, lines, waves, particles), and glitch effects
 * for off-beat hits. Runs at 60fps via requestAnimationFrame.
 */

import { INSTRUMENTS } from './Instruments.js';

export class VisualEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animations = [];
        this.glitchEffect = null;
        this.pulseIntensity = 0;
        this.hitFeedback = null;
        this.score = 0;
        this.displayScore = 0; // For smooth animation
        this.streak = 0;
        this.activeInstruments = new Map(); // Track which instruments are active

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Main render loop - called each frame
    render(beatTracker, score = 0, streak = 0) {
        const ctx = this.ctx;

        // Update score for display (smooth animation)
        this.score = score;
        this.streak = streak;
        this.displayScore += (score - this.displayScore) * 0.15;

        // Get pulse intensity from beat tracker
        if (beatTracker && beatTracker.isRunning) {
            this.pulseIntensity = beatTracker.getPulseIntensity();
        }

        // Clear - mostly solid to keep ring crisp, slight trail for effects
        ctx.fillStyle = 'rgba(18, 18, 24, 0.85)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background pulse
        this.drawBackgroundPulse();

        // Update and draw animations
        this.animations = this.animations.filter(anim => {
            anim.update();
            anim.draw(ctx);
            return !anim.isDead;
        });

        // Draw glitch effect if active
        if (this.glitchEffect) {
            this.drawGlitch();
        }

        // Draw beat indicator dots
        if (beatTracker && beatTracker.isRunning) {
            this.drawBeatRing(beatTracker);
            this.drawBeatIndicator(beatTracker);
            this.drawActiveInstruments();
            this.drawScore();
            this.drawHitFeedback();
        }
    }

    // Contracting ring that shows when to hit
    drawBeatRing(beatTracker) {
        const ctx = this.ctx;
        const info = beatTracker.getCurrentBeatInfo();
        const instrument = Object.values(INSTRUMENTS).find(inst => inst.beat === info.beat);

        // Ring contracts from large to small during each beat
        // progress goes 0->1 during the beat
        const maxRadius = 120;
        const minRadius = 40;
        const radius = maxRadius - (info.progress * (maxRadius - minRadius));

        // Target ring (where you want to hit)
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, minRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Perfect zone ring
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, minRadius, 0, Math.PI * 2);
        ctx.strokeStyle = instrument.color;
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.2;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Contracting ring - gets brighter as it approaches target
        const proximity = 1 - (radius - minRadius) / (maxRadius - minRadius);
        const alpha = 0.3 + proximity * 0.7;

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = instrument.color;
        ctx.lineWidth = 3 + proximity * 3;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Show next beat color faintly
        const nextBeat = (info.beat % 4) + 1;
        const nextInstrument = Object.values(INSTRUMENTS).find(inst => inst.beat === nextBeat);
        if (info.progress > 0.7) {
            const nextRadius = maxRadius + (info.progress - 0.7) * 100;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, nextRadius, 0, Math.PI * 2);
            ctx.strokeStyle = nextInstrument.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = (info.progress - 0.7) * 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    drawBackgroundPulse() {
        const ctx = this.ctx;
        const intensity = this.pulseIntensity;

        // Subtle radial gradient pulse
        const gradient = ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.canvas.width * 0.5
        );

        const alpha = 0.03 + intensity * 0.05;
        gradient.addColorStop(0, `rgba(212, 165, 116, ${alpha})`);
        gradient.addColorStop(1, 'rgba(212, 165, 116, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBeatIndicator(beatTracker) {
        const ctx = this.ctx;
        const info = beatTracker.getCurrentBeatInfo();
        const dotRadius = 12;
        const spacing = 50;
        const startX = this.centerX - (spacing * 1.5);
        const y = this.canvas.height - 60;

        for (let i = 1; i <= 4; i++) {
            const x = startX + (i - 1) * spacing;
            const instrument = Object.values(INSTRUMENTS).find(inst => inst.beat === i);

            if (i === info.beat) {
                // Current beat - filled and pulsing with glow
                const scale = 1 + this.pulseIntensity * 0.5;
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                ctx.translate(-x, -y);

                // Glow
                ctx.beginPath();
                ctx.arc(x, y, dotRadius + 8, 0, Math.PI * 2);
                ctx.fillStyle = instrument.color;
                ctx.globalAlpha = 0.3 * this.pulseIntensity;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Main dot
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = instrument.color;
                ctx.fill();
                ctx.restore();
            } else {
                // Other beats - outlined
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.strokeStyle = instrument.color;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // Beat number label
        ctx.fillStyle = '#fff';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5;
        ctx.fillText('HIT WHEN RING REACHES CENTER', this.centerX, y + 35);
        ctx.globalAlpha = 1;
    }

    // Trigger visual for a note hit
    triggerVisual(beat, accuracy) {
        const instrument = Object.values(INSTRUMENTS).find(inst => inst.beat === beat);
        if (!instrument) return;

        const isDissonant = accuracy === 'off';

        // Track this instrument as active for 4 beats (one measure)
        this.activeInstruments.set(beat, {
            name: instrument.name,
            color: instrument.color,
            startTime: performance.now(),
            duration: 2400 // About 4 beats at 100 BPM
        });

        switch (instrument.shape) {
            case 'circle':
                this.addCircleAnimation(instrument.color, isDissonant);
                break;
            case 'line':
                this.addLineAnimation(instrument.color, isDissonant);
                break;
            case 'wave':
                this.addWaveAnimation(instrument.color, isDissonant);
                break;
            case 'particles':
                this.addParticleAnimation(instrument.color, isDissonant);
                break;
            case 'spiral':
                this.addSpiralAnimation(instrument.color, isDissonant);
                break;
        }

        if (isDissonant) {
            this.triggerGlitch();
        }
    }

    // Draw active instruments panel on left side
    drawActiveInstruments() {
        const ctx = this.ctx;
        const now = performance.now();
        const x = 30;
        let y = 120;
        const lineHeight = 35;

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('ACTIVE', x, y - 15);

        // Go through each possible beat
        const instrumentOrder = [
            { beat: 1, name: 'MELODY' },
            { beat: 2, name: 'PAD' },
            { beat: 3, name: 'BASS' },
            { beat: 4, name: 'PERC' }
        ];

        for (const inst of instrumentOrder) {
            const active = this.activeInstruments.get(inst.beat);
            const isActive = active && (now - active.startTime < active.duration);

            // Clean up expired
            if (active && !isActive) {
                this.activeInstruments.delete(inst.beat);
            }

            const instrument = Object.values(INSTRUMENTS).find(i => i.beat === inst.beat);
            const color = instrument ? instrument.color : '#888';

            if (isActive) {
                const progress = (now - active.startTime) / active.duration;
                const alpha = 1 - progress * 0.3;

                // Glowing active indicator
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha * 0.3;
                ctx.beginPath();
                ctx.arc(x + 8, y, 12, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(x + 8, y, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Inter, sans-serif';
                ctx.fillText(inst.name, x + 24, y + 5);
                ctx.globalAlpha = 1;
            } else {
                // Inactive - dimmed
                ctx.globalAlpha = 0.25;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x + 8, y, 6, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#888';
                ctx.font = '14px Inter, sans-serif';
                ctx.fillText(inst.name, x + 24, y + 5);
                ctx.globalAlpha = 1;
            }

            y += lineHeight;
        }
    }


    addCircleAnimation(color, isDissonant) {
        this.animations.push(new CircleAnimation(
            this.centerX,
            this.centerY,
            color,
            isDissonant
        ));
    }

    addLineAnimation(color, isDissonant) {
        this.animations.push(new LineAnimation(
            this.canvas.width,
            this.canvas.height,
            color,
            isDissonant
        ));
    }

    addWaveAnimation(color, isDissonant) {
        this.animations.push(new WaveAnimation(
            this.canvas.width,
            this.canvas.height,
            color,
            isDissonant
        ));
    }

    addParticleAnimation(color, isDissonant) {
        this.animations.push(new ParticleAnimation(
            this.centerX,
            this.centerY,
            color,
            isDissonant
        ));
    }

    addSpiralAnimation(color, isDissonant) {
        this.animations.push(new SpiralAnimation(
            this.centerX,
            this.centerY,
            color,
            isDissonant
        ));
    }

    drawScore() {
        const ctx = this.ctx;

        // Score display in top left
        ctx.fillStyle = '#d4a574';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(this.displayScore).toLocaleString(), 30, 50);

        // Streak display
        if (this.streak > 0) {
            ctx.fillStyle = this.streak >= 10 ? '#4ade80' : '#fff';
            ctx.font = '18px Inter, sans-serif';
            ctx.fillText(`${this.streak}x streak`, 30, 75);
        }
    }

    showHitFeedback(accuracy, streak) {
        const colors = {
            perfect: '#4ade80', // Green
            good: '#60a5fa',    // Blue
            off: '#ef4444'      // Red
        };

        const texts = {
            perfect: 'PERFECT',
            good: 'GOOD',
            off: 'OFF'
        };

        this.hitFeedback = {
            text: texts[accuracy],
            color: colors[accuracy],
            streak: streak,
            startTime: performance.now(),
            duration: 500
        };
    }

    drawHitFeedback() {
        if (!this.hitFeedback) return;

        const elapsed = performance.now() - this.hitFeedback.startTime;
        if (elapsed > this.hitFeedback.duration) {
            this.hitFeedback = null;
            return;
        }

        const ctx = this.ctx;
        const progress = elapsed / this.hitFeedback.duration;
        const alpha = 1 - progress;
        const scale = 1 + progress * 0.3;
        const yOffset = -progress * 30;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.hitFeedback.color;
        ctx.font = `bold ${24 * scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
            this.hitFeedback.text,
            this.centerX,
            this.centerY - 80 + yOffset
        );
        ctx.restore();
    }

    triggerGlitch() {
        this.glitchEffect = {
            startTime: performance.now(),
            duration: 150
        };
    }

    drawGlitch() {
        const elapsed = performance.now() - this.glitchEffect.startTime;
        if (elapsed > this.glitchEffect.duration) {
            this.glitchEffect = null;
            return;
        }

        const ctx = this.ctx;
        const intensity = 1 - (elapsed / this.glitchEffect.duration);

        // Screen shake
        const shakeX = (Math.random() - 0.5) * 10 * intensity;
        const shakeY = (Math.random() - 0.5) * 10 * intensity;
        ctx.translate(shakeX, shakeY);

        // Glitch lines
        for (let i = 0; i < 3; i++) {
            const y = Math.random() * this.canvas.height;
            const height = Math.random() * 5 + 2;
            ctx.fillStyle = `rgba(255, 0, 0, ${0.3 * intensity})`;
            ctx.fillRect(0, y, this.canvas.width, height);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}

// Circle expansion animation (bass)
class CircleAnimation {
    constructor(x, y, color, isDissonant) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = 20;
        this.maxRadius = 200;
        this.alpha = 1;
        this.isDead = false;
        this.isDissonant = isDissonant;
        this.speed = isDissonant ? 8 : 5;
    }

    update() {
        this.radius += this.speed;
        this.alpha = 1 - (this.radius / this.maxRadius);
        if (this.alpha <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.lineWidth = this.isDissonant ? 4 : 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// Line drawing animation (melody)
class LineAnimation {
    constructor(width, height, color, isDissonant) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.progress = 0;
        this.isDead = false;
        this.isDissonant = isDissonant;

        // Random line direction
        this.startX = Math.random() * width;
        this.startY = height * 0.3 + Math.random() * height * 0.4;
        this.endX = Math.random() * width;
        this.endY = height * 0.3 + Math.random() * height * 0.4;

        if (isDissonant) {
            // Jagged line for dissonance
            this.points = [];
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const x = this.startX + (this.endX - this.startX) * t;
                const y = this.startY + (this.endY - this.startY) * t + (Math.random() - 0.5) * 50;
                this.points.push({ x, y });
            }
        }
    }

    update() {
        this.progress += 0.05;
        if (this.progress >= 1.5) this.isDead = true;
    }

    draw(ctx) {
        const alpha = this.progress < 1 ? 1 : 1 - (this.progress - 1) * 2;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        ctx.beginPath();

        if (this.isDissonant && this.points) {
            ctx.moveTo(this.points[0].x, this.points[0].y);
            const drawTo = Math.min(
                Math.floor(Math.min(this.progress, 1) * this.points.length),
                this.points.length - 1
            );
            for (let i = 1; i <= drawTo; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
        } else {
            const drawProgress = Math.min(this.progress, 1);
            const currentX = this.startX + (this.endX - this.startX) * drawProgress;
            const currentY = this.startY + (this.endY - this.startY) * drawProgress;
            ctx.moveTo(this.startX, this.startY);
            ctx.lineTo(currentX, currentY);
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// Wave ripple animation (pad)
class WaveAnimation {
    constructor(width, height, color, isDissonant) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.phase = 0;
        this.alpha = 1;
        this.isDead = false;
        this.isDissonant = isDissonant;
        this.y = height / 2;
    }

    update() {
        this.phase += 0.1;
        this.alpha -= 0.02;
        if (this.alpha <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        const amplitude = this.isDissonant ? 40 : 25;
        const frequency = this.isDissonant ? 0.03 : 0.02;

        for (let x = 0; x < this.width; x += 5) {
            const y = this.y + Math.sin(x * frequency + this.phase) * amplitude;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// Particle burst animation (percussion)
class ParticleAnimation {
    constructor(x, y, color, isDissonant) {
        this.particles = [];
        const count = isDissonant ? 30 : 20;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = 3 + Math.random() * 5;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4,
                alpha: 1
            });
        }

        this.color = color;
        this.isDead = false;
        this.isDissonant = isDissonant;
    }

    update() {
        let allDead = true;

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
            p.alpha -= 0.02;
            p.size *= 0.98;

            if (p.alpha > 0) allDead = false;
        }

        this.isDead = allDead;
    }

    draw(ctx) {
        for (const p of this.particles) {
            if (p.alpha <= 0) continue;

            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = this.color;

            if (this.isDissonant) {
                // Square particles for dissonance
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }
}

// Spiral/trail animation (melody) - Multiple orbiting points with trails
class SpiralAnimation {
    constructor(x, y, color, isDissonant) {
        this.centerX = x;
        this.centerY = y;
        this.color = color;
        this.isDissonant = isDissonant;
        this.isDead = false;
        this.age = 0;
        this.maxAge = 80;

        // Create multiple spiral arms
        const numArms = isDissonant ? 5 : 3;
        this.arms = [];
        for (let i = 0; i < numArms; i++) {
            this.arms.push({
                angle: (Math.PI * 2 * i) / numArms,
                radius: 20,
                trail: [],
                speed: isDissonant ? 0.15 + Math.random() * 0.1 : 0.08,
                growthRate: isDissonant ? 4 : 3
            });
        }
    }

    update() {
        this.age++;
        if (this.age >= this.maxAge) {
            this.isDead = true;
            return;
        }

        for (const arm of this.arms) {
            // Update position
            arm.angle += arm.speed;
            arm.radius += arm.growthRate;

            // Calculate current position
            const x = this.centerX + Math.cos(arm.angle) * arm.radius;
            const y = this.centerY + Math.sin(arm.angle) * arm.radius;

            // Add to trail
            arm.trail.push({ x, y, age: 0 });

            // Age and remove old trail points
            arm.trail = arm.trail.filter(p => {
                p.age++;
                return p.age < 30;
            });
        }
    }

    draw(ctx) {
        const fadeProgress = this.age / this.maxAge;
        const basealpha = 1 - fadeProgress * 0.5;

        for (const arm of this.arms) {
            // Draw trail
            if (arm.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(arm.trail[0].x, arm.trail[0].y);

                for (let i = 1; i < arm.trail.length; i++) {
                    const p = arm.trail[i];
                    ctx.lineTo(p.x, p.y);
                }

                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.isDissonant ? 4 : 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = basealpha * 0.6;
                ctx.stroke();
            }

            // Draw head point with glow
            if (arm.trail.length > 0) {
                const head = arm.trail[arm.trail.length - 1];

                // Glow
                ctx.beginPath();
                ctx.arc(head.x, head.y, this.isDissonant ? 12 : 8, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = basealpha * 0.3;
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(head.x, head.y, this.isDissonant ? 5 : 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = basealpha;
                ctx.fill();
            }
        }

        // Draw connecting lines between arms for dissonant
        if (this.isDissonant && this.arms.length > 1) {
            ctx.beginPath();
            ctx.globalAlpha = basealpha * 0.2;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;

            for (let i = 0; i < this.arms.length; i++) {
                const arm1 = this.arms[i];
                const arm2 = this.arms[(i + 1) % this.arms.length];
                if (arm1.trail.length > 0 && arm2.trail.length > 0) {
                    const h1 = arm1.trail[arm1.trail.length - 1];
                    const h2 = arm2.trail[arm2.trail.length - 1];
                    ctx.moveTo(h1.x, h1.y);
                    ctx.lineTo(h2.x, h2.y);
                }
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }
}
