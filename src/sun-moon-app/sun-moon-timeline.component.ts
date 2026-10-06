import { component, css, html } from 'fudgel';
import { visibleLabels } from './sky-math';

export interface TimelineView {
    // Colored runs of night, twilight, golden hour and day.
    segments: { className: string; style: string }[];
    // Times over the bar: sunrise, solar noon, sunset.
    // position is 0 to 1 along the bar; higher priority labels win when
    // they would overlap.
    labels: {
        icon: string;
        position: number;
        priority: number;
        style: string;
        text: string;
    }[];
    // Thin lines on the bar under each label.
    marks: { style: string }[];
    nowStyle: string;
    showNow: boolean;
    ticks: { style: string; text: string }[];
    legend: { className: string; label: string }[];
}

export const EMPTY_TIMELINE: TimelineView = {
    segments: [],
    labels: [],
    marks: [],
    nowStyle: '',
    showNow: false,
    ticks: [],
    legend: [],
};

// A 24 hour bar for the chosen day. All positions are computed by the
// screen; this only draws them.
export class SunMoonTimelineComponent {
    private _observer: ResizeObserver | null = null;
    private _timeout: ReturnType<typeof setTimeout> | null = null;
    labelsEl?: HTMLElement;
    view: TimelineView = EMPTY_TIMELINE;

    onViewInit() {
        if (this.labelsEl && typeof ResizeObserver !== 'undefined') {
            this._observer = new ResizeObserver(() => this._fitLabels());
            this._observer.observe(this.labelsEl);
        }

        this._scheduleFit();
    }

    onChange() {
        this._scheduleFit();
    }

    onDestroy() {
        this._observer?.disconnect();
        this._observer = null;

        if (this._timeout) {
            clearTimeout(this._timeout);
        }
    }

    // The labels are drawn a tick after the view changes.
    private _scheduleFit() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        this._timeout = setTimeout(() => this._fitLabels());
    }

    // Hides labels that would overlap at the current width. Each label is
    // shifted left by its own position, so two labels a gap g apart clear
    // each other when g * (barWidth - labelWidth) >= labelWidth.
    private _fitLabels() {
        const container = this.labelsEl;

        if (!container) {
            return;
        }

        const elements = [...container.querySelectorAll<HTMLElement>('.label')];
        const width = container.clientWidth;
        const widest = Math.max(0, ...elements.map((e) => e.offsetWidth)) + 8;

        if (!width || elements.length !== this.view.labels.length) {
            return;
        }

        const shown = visibleLabels(
            this.view.labels,
            widest / Math.max(1, width - widest)
        );
        elements.forEach((element, index) => {
            element.style.visibility = shown[index] ? '' : 'hidden';
        });
    }
}

component(
    'sun-moon-timeline',
    {
        prop: ['view'],
        style: css`
            :host {
                display: block;
            }

            .labels {
                position: relative;
                height: 1.5rem;
                margin-bottom: var(--space-1);
            }

            .label {
                position: absolute;
                top: 0;
                display: flex;
                align-items: center;
                gap: 0.15rem;
                white-space: nowrap;
                font-size: 0.85rem;
                font-weight: 600;
                font-variant-numeric: tabular-nums;
            }

            .label load-svg {
                width: 1.1rem;
                height: 1.1rem;
                color: var(--fg-muted);
            }

            .bar {
                position: relative;
                height: 2.25rem;
                border-radius: var(--radius-s);
                overflow: hidden;
                border: 1px solid var(--border);
                background: var(--sky-night);
            }

            .segment {
                position: absolute;
                top: 0;
                bottom: 0;
            }

            .mark {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 0;
                border-left: 1px dashed var(--sky-mark);
            }

            .now-wrap {
                position: relative;
                height: 0;
            }

            .now {
                position: absolute;
                top: -2.75rem;
                height: 2.75rem;
                width: 3px;
                margin-left: -1.5px;
                border-radius: 2px;
                background: var(--accent);
                box-shadow: 0 0 0 1.5px var(--surface);
            }

            .now::before {
                content: '';
                position: absolute;
                top: -4px;
                left: -3.5px;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--accent);
                box-shadow: 0 0 0 1.5px var(--surface);
            }

            .ticks {
                position: relative;
                height: 1.25rem;
                margin-top: var(--space-1);
                font-size: 0.75rem;
                color: var(--fg-muted);
                font-variant-numeric: tabular-nums;
            }

            .tick {
                position: absolute;
                top: 0;
                white-space: nowrap;
            }

            .legend {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-1) var(--space-3);
                margin-top: var(--space-3);
                font-size: 0.8rem;
                color: var(--fg-muted);
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 0.35rem;
            }

            .swatch {
                width: 0.8rem;
                height: 0.8rem;
                border-radius: 3px;
                border: 1px solid var(--border);
            }

            .band-night {
                background: var(--sky-night);
            }

            .band-astronomical {
                background: var(--sky-astronomical);
            }

            .band-nautical {
                background: var(--sky-nautical);
            }

            .band-civil {
                background: var(--sky-civil);
            }

            .band-golden {
                background: var(--sky-golden);
            }

            .band-day {
                background: var(--sky-day);
            }
        `,
        template: html`
            <div class="labels" #ref="labelsEl">
                <div
                    *for="label of view.labels"
                    class="label"
                    .style="label.style"
                >
                    <load-svg href="{{label.icon}}"></load-svg>
                    <span>{{label.text}}</span>
                </div>
            </div>
            <div class="bar">
                <div
                    *for="segment of view.segments"
                    class="segment {{segment.className}}"
                    .style="segment.style"
                ></div>
                <div
                    *for="mark of view.marks"
                    class="mark"
                    .style="mark.style"
                ></div>
            </div>
            <div class="now-wrap">
                <div
                    *if="view.showNow"
                    class="now"
                    .style="view.nowStyle"
                ></div>
            </div>
            <div class="ticks">
                <span *for="tick of view.ticks" class="tick" .style="tick.style"
                    >{{tick.text}}</span
                >
            </div>
            <div class="legend">
                <div *for="item of view.legend" class="legend-item">
                    <span class="swatch {{item.className}}"></span>
                    <span>{{item.label}}</span>
                </div>
            </div>
        `,
    },
    SunMoonTimelineComponent
);
