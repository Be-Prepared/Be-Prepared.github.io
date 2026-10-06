import {
    AccessController,
    AccessState,
} from '../services/access/access-controller';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    isTorchOn,
    setTorch,
} from '../services/camera.service';
import {
    BpmEstimate,
    estimateBpm,
    frameStats,
    GOOD_QUALITY,
    isFingerPresent,
    lastSeconds,
    Sample,
    summarize,
    waveform,
} from './ppg';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

// Seconds of steady signal needed for a result.
const MEASURE_SECONDS = 30;

// Seconds of signal before the first estimate is attempted.
const WARM_UP_SECONDS = 5;

// How often the heart rate is estimated.
const ESTIMATE_MS = 250;

// A finger lifted for this long starts the signal over.
const FINGER_GRACE_MS = 600;

// The camera picture is shrunk to this before averaging. The whole frame is
// one color when covered, so detail doesn't matter, and small is fast.
const SAMPLE_WIDTH = 40;
const SAMPLE_HEIGHT = 30;

type Phase = 'intro' | 'measuring' | 'done';

export class HeartRateAppComponent {
    private _camera: AccessController<MediaStream> | null = null;
    private _canvas: HTMLCanvasElement | null = null;
    private _channel: 'red' | 'green' = 'red';
    private _estimates: BpmEstimate[] = [];
    private _frameHandle: number | null = null;
    private _lastEstimate = 0;
    private _lastFinger = 0;
    private _lastSample = 0;
    private _measured = 0;
    private _samples: Sample[] = [];
    private _stopMeasuring = new Subject();
    private _stream: MediaStream | null = null;
    private _torchTimer: ReturnType<typeof setTimeout> | null = null;
    private _usingVideoFrames = false;
    private _wakeLockService = di(WakeLockService);
    bar?: HTMLElement;
    bpm = '--';
    fingerPresent = false;
    hasResult = false;
    phase: Phase = 'intro';
    result = '';
    screenState = AccessState.CHECKING;
    secondsLeft = '';
    statusId = 'heartRate.status.place';
    torchAvailable = true;
    video?: HTMLVideoElement;
    wave?: HTMLCanvasElement;

    onDestroy() {
        this._stop();
        this._stopMeasuring.complete();
    }

    grant() {
        this._camera?.request();
    }

    restart() {
        this.phase = 'intro';
    }

    start() {
        this._stop();
        this._resetSignal();
        this._estimates = [];
        this._measured = 0;
        this.bpm = '--';
        this.hasResult = false;
        this.result = '';
        this.screenState = AccessState.CHECKING;
        this.torchAvailable = true;
        this._updateProgress();
        this.phase = 'measuring';

        // A camera only while measuring, so the light is not on while
        // reading the instructions.
        const camera = di(CameraService).controller();
        this._camera = camera;
        camera.state
            .pipe(takeUntil(this._stopMeasuring))
            .subscribe((state) => (this.screenState = state));
        camera.resourceChanges
            .pipe(takeUntil(this._stopMeasuring))
            .subscribe((stream) => this._attach(stream));
        camera.init();
        this._wakeLockService.request();
    }

    stop() {
        this._stop();
        this.phase = 'intro';
    }

    private _attach(stream: MediaStream | null) {
        this._cancelFrames();
        this._stream = stream;
        // The signal from before a pause can't be joined to the new one.
        this._resetSignal();

        if (!stream) {
            return;
        }

        const track = getVideoTrack(stream);
        this.torchAvailable = hasTorch(track);
        this._torchOn(track, 2);

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (!this.video || this._stream !== stream) {
                return;
            }

            this.video.srcObject = stream;
            this.video.play().catch(() => {});
            this._scheduleFrame();
        });
    }

    private _cancelFrames() {
        if (this._frameHandle !== null) {
            if (this._usingVideoFrames && this.video) {
                (this.video as any).cancelVideoFrameCallback(this._frameHandle);
            } else {
                cancelAnimationFrame(this._frameHandle);
            }

            this._frameHandle = null;
        }
    }

    private _drawWave() {
        const canvas = this.wave;

        if (!canvas) {
            return;
        }

        const ratio = window.devicePixelRatio || 1;
        const width = Math.round(canvas.clientWidth * ratio);
        const height = Math.round(canvas.clientHeight * ratio);

        if (!width || !height) {
            return;
        }

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(0, 0, width, height);
        const points = this.fingerPresent ? waveform(this._samples, 5) : [];

        if (points.length < 2) {
            return;
        }

        // The canvas color comes from CSS so it follows the theme.
        context.strokeStyle = getComputedStyle(canvas).color;
        context.lineWidth = 2.5 * ratio;
        context.lineJoin = 'round';
        context.beginPath();
        const step = width / (5 * 30 - 1);
        const offset = width - (points.length - 1) * step;

        points.forEach((value, index) => {
            const x = offset + index * step;
            // Canvas y grows down; beats point up.
            const y = height / 2 - value * height * 0.42;

            if (index) {
                context.lineTo(x, y);
            } else {
                context.moveTo(x, y);
            }
        });

        context.stroke();
    }

    private _estimate() {
        const estimate = estimateBpm(this._samples);
        this._estimates.push(estimate);
        const good = estimate.quality >= GOOD_QUALITY;
        this.bpm = good ? `${Math.round(estimate.bpm)}` : '--';
        this.statusId = good
            ? 'heartRate.status.good'
            : 'heartRate.status.weak';
    }

    private _finish() {
        const result = summarize(this._estimates);
        this._stop();
        this.hasResult = result !== null;
        this.result = result === null ? '' : `${result}`;
        this.phase = 'done';
    }

    private _onFrame(now: number) {
        this._frameHandle = null;
        const video = this.video;

        if (!video || !this._stream || this.phase !== 'measuring') {
            return;
        }

        this._scheduleFrame();

        if (video.readyState < 2 || !video.videoWidth) {
            return;
        }

        const stats = this._readFrame(video);

        if (!stats) {
            return;
        }

        if (!isFingerPresent(stats)) {
            if (now - this._lastFinger > FINGER_GRACE_MS) {
                if (this.fingerPresent) {
                    this._resetSignal();
                }

                this.statusId = 'heartRate.status.place';
                this.bpm = '--';
            }

            return;
        }

        if (!this.fingerPresent) {
            // A bright torch can max out the red channel, which flattens the
            // pulse. Green carries the pulse too, just more weakly.
            this._channel = stats.red > 245 ? 'green' : 'red';
            this.fingerPresent = true;
            this.statusId = 'heartRate.status.hold';
            this._lastSample = now;
            this._lastEstimate = now;
        }

        this._lastFinger = now;
        // A darker picture means more blood, so flip it to make beats peaks.
        const value = this._channel === 'red' ? stats.red : stats.green;
        this._samples.push({ t: now, v: -value });
        this._samples = lastSeconds(this._samples, 12);

        // Only time with a finger in place counts. Long gaps (the page was
        // busy) count as one frame.
        this._measured += Math.min(100, now - this._lastSample) / 1000;
        this._lastSample = now;

        const span = (now - this._samples[0].t) / 1000;

        if (
            span >= WARM_UP_SECONDS &&
            now - this._lastEstimate >= ESTIMATE_MS
        ) {
            this._lastEstimate = now;
            this._estimate();
        }

        this._updateProgress();
        this._drawWave();

        if (this._measured >= MEASURE_SECONDS) {
            this._finish();
        }
    }

    private _readFrame(video: HTMLVideoElement) {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
            this._canvas.width = SAMPLE_WIDTH;
            this._canvas.height = SAMPLE_HEIGHT;
        }

        const context = this._canvas.getContext('2d', {
            willReadFrequently: true,
        });

        if (!context) {
            return null;
        }

        // The middle of the picture. Edges are often darker or show light
        // leaking around the finger.
        const sw = video.videoWidth / 2;
        const sh = video.videoHeight / 2;
        context.drawImage(
            video,
            sw / 2,
            sh / 2,
            sw,
            sh,
            0,
            0,
            SAMPLE_WIDTH,
            SAMPLE_HEIGHT
        );

        return frameStats(
            context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data
        );
    }

    private _resetSignal() {
        this._samples = [];
        this.fingerPresent = false;
        this._lastFinger = 0;
        this._drawWave();
    }

    // Exact frame times when the browser offers them; otherwise sample on
    // every screen refresh.
    private _scheduleFrame() {
        const video = this.video as any;

        if (!video || this._frameHandle !== null) {
            return;
        }

        this._usingVideoFrames = !!video.requestVideoFrameCallback;

        if (this._usingVideoFrames) {
            this._frameHandle = video.requestVideoFrameCallback((now: number) =>
                this._onFrame(now)
            );
        } else {
            this._frameHandle = requestAnimationFrame((now) =>
                this._onFrame(now)
            );
        }
    }

    private _stop() {
        this._cancelFrames();
        this._stopMeasuring.next(null);

        if (this._torchTimer) {
            clearTimeout(this._torchTimer);
            this._torchTimer = null;
        }

        if (this._camera) {
            // Closing the stream turns the light off.
            this._camera.destroy();
            this._camera = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }

        this._stream = null;
        this._wakeLockService.release();
    }

    // Some phones ignore the torch until the video is running, so check and
    // ask again.
    private _torchOn(track: MediaStreamTrack | null, attempts: number) {
        if (!track || !hasTorch(track)) {
            return;
        }

        setTorch(track, true)
            .catch(() => {})
            .then(() => {
                if (attempts > 1 && getVideoTrack(this._stream) === track) {
                    this._torchTimer = setTimeout(() => {
                        this._torchTimer = null;

                        if (
                            getVideoTrack(this._stream) === track &&
                            !isTorchOn(track)
                        ) {
                            this._torchOn(track, attempts - 1);
                        }
                    }, 1000);
                }
            });
    }

    private _updateProgress() {
        const fraction = Math.min(1, this._measured / MEASURE_SECONDS);

        if (this.bar) {
            this.bar.style.width = `${(fraction * 100).toFixed(1)}%`;
        }

        this.secondsLeft = `${Math.ceil(MEASURE_SECONDS - fraction * MEASURE_SECONDS)}`;
    }
}

component(
    'heart-rate-app',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }

            .page {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-4);
                min-height: 100%;
                max-width: 32rem;
                margin: 0 auto;
                box-sizing: border-box;
            }

            .steps {
                margin: 0;
                padding-left: 1.4em;
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                align-self: stretch;
            }

            .start {
                width: min(40vmin, 10rem);
                height: min(40vmin, 10rem);
                flex: 0 0 auto;
                border-radius: 50%;
                border: 2px solid var(--accent);
                background: var(--accent);
                color: var(--accent-fg);
                box-shadow: 0 0 3rem var(--accent-glow);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: var(--space-1);
                cursor: pointer;
                font-family: inherit;
                font-size: 1.1rem;
                font-weight: 700;
                -webkit-tap-highlight-color: transparent;
                transition: transform 0.1s;
            }

            .start:active {
                transform: scale(0.96);
            }

            .start load-svg {
                width: 45%;
                height: 45%;
            }

            .disclaimer {
                align-self: stretch;
                padding: var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                font-size: 0.9rem;
            }

            .disclaimer strong {
                display: block;
            }

            .notice {
                align-self: stretch;
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-m);
                background: var(--surface-2);
                border: 1px solid var(--border);
                color: var(--fg-muted);
                font-size: 0.9rem;
            }

            /* Measuring */
            .measure {
                display: grid;
                grid-template-columns: 1fr;
                gap: var(--space-3);
                align-content: start;
                max-width: 40rem;
                margin: 0 auto;
            }

            .status {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                font-weight: 600;
            }

            /* The camera picture: red when the finger is right. */
            video {
                width: 3.5rem;
                height: 3.5rem;
                flex: 0 0 auto;
                border-radius: 50%;
                object-fit: cover;
                background: #000;
                border: 2px solid var(--border);
            }

            .reading {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: var(--space-2);
            }

            .bpm {
                font-size: clamp(3.5rem, 18vmin, 6rem);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                line-height: 1;
            }

            .unit {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--fg-muted);
            }

            .wave {
                display: block;
                width: 100%;
                height: clamp(4rem, 18vh, 9rem);
                color: var(--accent);
                background: var(--surface-2);
                border-radius: var(--radius-m);
            }

            .progress {
                height: 0.6rem;
                border-radius: 999px;
                background: var(--surface-2);
                border: 1px solid var(--border);
                overflow: hidden;
            }

            .bar {
                width: 0;
                height: 100%;
                background: var(--accent);
                transition: width 0.2s linear;
            }

            .left {
                display: flex;
                justify-content: center;
                gap: 0.3em;
                font-size: 0.9rem;
                color: var(--fg-muted);
                text-align: center;
                font-variant-numeric: tabular-nums;
            }

            .small {
                font-size: 0.8rem;
                color: var(--fg-muted);
                text-align: center;
            }

            /* Phones on their side: reading on the left, trace on the
               right. */
            @media (orientation: landscape) and (max-height: 540px) {
                .measure {
                    grid-template-columns: 1fr 1.3fr;
                    align-items: center;
                }

                .status,
                .reading {
                    grid-column: 1;
                }

                .wave,
                .progress,
                .left {
                    grid-column: 2;
                }

                .wave {
                    grid-row: 1 / span 2;
                }

                .notice,
                .small {
                    grid-column: 1 / span 2;
                }
            }

            /* Phones on their side: the big button or result beside the
               text instead of below it. */
            @media (orientation: landscape) and (max-height: 540px) {
                .page {
                    display: grid;
                    grid-template-columns: 1fr minmax(12rem, 0.8fr);
                    align-items: center;
                    align-content: center;
                    column-gap: var(--space-5);
                    row-gap: var(--space-3);
                    max-width: 52rem;
                }

                .intro > * {
                    grid-column: 1;
                }

                .intro .start {
                    grid-column: 2;
                    grid-row: 1 / span 3;
                    justify-self: center;
                }

                .done > * {
                    grid-column: 2;
                }

                .done .disclaimer {
                    grid-column: 1;
                    grid-row: 1 / span 4;
                    align-self: center;
                }

                .done .result {
                    justify-self: center;
                }
            }

            /* Done */
            .result {
                display: flex;
                align-items: baseline;
                gap: var(--space-2);
            }

            .result .bpm {
                color: var(--accent);
            }

            h2 {
                margin: 0;
                font-size: 1.25rem;
                text-align: center;
            }

            .again {
                align-self: stretch;
            }
        `,
        template: html`
            <default-layout *if="phase === 'intro'" frame>
                <div class="page intro">
                    <h2>
                        <i18n-label id="heartRate.howTo" ws=""></i18n-label>
                    </h2>
                    <ol class="steps">
                        <li>
                            <i18n-label
                                id="heartRate.step.cover"
                                ws=""
                            ></i18n-label>
                        </li>
                        <li>
                            <i18n-label
                                id="heartRate.step.gentle"
                                ws=""
                            ></i18n-label>
                        </li>
                        <li>
                            <i18n-label
                                id="heartRate.step.still"
                                ws=""
                            ></i18n-label>
                        </li>
                    </ol>
                    <button class="start" @click.stop.prevent="start()">
                        <load-svg href="/heart-rate.svg"></load-svg>
                        <i18n-label id="heartRate.start" ws=""></i18n-label>
                    </button>
                    <div class="disclaimer">
                        <strong
                            ><i18n-label
                                id="heartRate.disclaimer.title"
                                ws=""
                            ></i18n-label
                        ></strong>
                        <i18n-label
                            id="heartRate.disclaimer.body"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
            </default-layout>
            <access-screen
                *if="phase === 'measuring' && screenState !== 'READY'"
                state="{{screenState}}"
                icon="/camera.svg"
                message-id="heartRate.explainAsk"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout
                *if="phase === 'measuring' && screenState === 'READY'"
                frame
            >
                <div class="measure">
                    <div class="status">
                        <video #ref="video" autoplay muted playsinline></video>
                        <i18n-label id="{{statusId}}" ws=""></i18n-label>
                    </div>
                    <div class="reading">
                        <span class="bpm">{{bpm}}</span>
                        <span class="unit"
                            ><i18n-label id="heartRate.bpm" ws=""></i18n-label
                        ></span>
                    </div>
                    <canvas class="wave" #ref="wave"></canvas>
                    <div class="progress">
                        <div class="bar" #ref="bar"></div>
                    </div>
                    <div class="left">
                        <span>{{secondsLeft}}</span>
                        <i18n-label
                            id="heartRate.secondsLeft"
                            ws=""
                        ></i18n-label>
                    </div>
                    <div *if="!torchAvailable" class="notice">
                        <i18n-label id="heartRate.noTorch" ws=""></i18n-label>
                    </div>
                    <div class="small">
                        <i18n-label
                            id="heartRate.disclaimer.title"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    href="/close.svg"
                    label-id="heartRate.stop"
                    @click.stop.prevent="stop()"
                ></icon-button>
            </default-layout>
            <default-layout *if="phase === 'done'" frame>
                <div class="page done">
                    <h2>
                        <i18n-label id="heartRate.result" ws=""></i18n-label>
                    </h2>
                    <div *if="hasResult" class="result">
                        <span class="bpm">{{result}}</span>
                        <span class="unit"
                            ><i18n-label id="heartRate.bpm" ws=""></i18n-label
                        ></span>
                    </div>
                    <p *if="!hasResult" class="notice">
                        <i18n-label id="heartRate.noResult" ws=""></i18n-label>
                    </p>
                    <pretty-button
                        class="again"
                        variant="primary"
                        @click.stop.prevent="start()"
                        ><i18n-label id="heartRate.again" ws=""></i18n-label
                    ></pretty-button>
                    <pretty-button class="again" @click.stop.prevent="restart()"
                        ><i18n-label
                            id="heartRate.instructions"
                            ws=""
                        ></i18n-label
                    ></pretty-button>
                    <div class="disclaimer">
                        <strong
                            ><i18n-label
                                id="heartRate.disclaimer.title"
                                ws=""
                            ></i18n-label
                        ></strong>
                        <i18n-label
                            id="heartRate.disclaimer.body"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
            </default-layout>
        `,
    },
    HeartRateAppComponent
);
