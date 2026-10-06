export type AlarmPattern = 'siren' | 'beep' | 'chime';

// Generates alarm sounds with the Web Audio API, so no audio files are
// needed. Browsers only allow sound after the person has tapped something,
// so call start() (or unlock()) from a click handler.
export class AlarmSoundService {
    private _context: AudioContext | null = null;
    private _gain: GainNode | null = null;
    private _oscillator: OscillatorNode | null = null;
    private _timer: ReturnType<typeof setInterval> | null = null;

    get playing() {
        return !!this._oscillator;
    }

    isSupported() {
        return (
            typeof window !== 'undefined' &&
            !!(window.AudioContext || (window as any).webkitAudioContext)
        );
    }

    // Plays a short tone once, such as when a timer finishes a lap.
    beep(frequency = 880, durationMs = 150) {
        const context = this.unlock();

        if (!context) {
            return;
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + durationMs / 1000
        );
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + durationMs / 1000 + 0.05);
    }

    // Starts a repeating alarm until stop() is called.
    start(pattern: AlarmPattern = 'siren', volume = 1) {
        this.stop();
        const context = this.unlock();

        if (!context) {
            return;
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = pattern === 'siren' ? 'sawtooth' : 'square';
        gain.gain.value = 0;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        this._oscillator = oscillator;
        this._gain = gain;
        let step = 0;
        const tick = () => {
            const now = context.currentTime;
            step += 1;

            if (pattern === 'siren') {
                // Rising and falling wail.
                oscillator.frequency.cancelScheduledValues(now);
                oscillator.frequency.setValueAtTime(600, now);
                oscillator.frequency.linearRampToValueAtTime(1400, now + 0.5);
                oscillator.frequency.linearRampToValueAtTime(600, now + 1);
                gain.gain.setValueAtTime(0.4 * volume, now);
            } else if (pattern === 'beep') {
                // Four quick beeps, then a pause.
                const on = step % 5 !== 0;
                oscillator.frequency.setValueAtTime(2000, now);
                gain.gain.setValueAtTime(on ? 0.35 * volume : 0, now);
                gain.gain.setValueAtTime(0, now + 0.1);
            } else {
                // Gentle two-tone chime.
                oscillator.frequency.setValueAtTime(
                    step % 2 ? 660 : 880,
                    now
                );
                gain.gain.setValueAtTime(0.3 * volume, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
            }
        };
        const interval =
            pattern === 'siren' ? 1000 : pattern === 'beep' ? 200 : 500;
        tick();
        this._timer = setInterval(tick, interval);
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        if (this._oscillator) {
            try {
                this._oscillator.stop();
            } catch (_ignore) {}

            this._oscillator.disconnect();
            this._oscillator = null;
        }

        if (this._gain) {
            this._gain.disconnect();
            this._gain = null;
        }
    }

    // Creates or resumes the audio context. Must happen during a tap at
    // least once.
    unlock(): AudioContext | null {
        if (!this.isSupported()) {
            return null;
        }

        if (!this._context) {
            const Context =
                window.AudioContext || (window as any).webkitAudioContext;
            this._context = new Context();
        }

        if (this._context.state === 'suspended') {
            this._context.resume().catch(() => {});
        }

        return this._context;
    }
}
