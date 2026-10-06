import { component, css, emit, html } from 'fudgel';

export class PrettyInputComponent {
    helpHtml?: string;
    showingHelp = false;
    type = 'text';

    change(value: string) {
        emit(this, 'change', value);
    }

    hideHelp() {
        this.showingHelp = false;
    }

    showHelp() {
        this.showingHelp = true;
    }
}

component('pretty-input', {
    attr: ['helpHtml', 'type', 'value'],
    prop: ['value'],
    style: css`
        :host {
            display: inline-block;
        }

        .wrapper {
            display: flex;
            align-items: center;
            border: 1px solid var(--border);
            border-radius: var(--radius-s);
            background-color: var(--surface);
            padding: 0 var(--space-1);
            overflow: hidden;
        }

        .wrapper:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-soft);
        }

        input {
            font: inherit;
            width: 100%;
            text-align: center;
            color: var(--fg);
            background-color: transparent;
            border: 0;
            padding: var(--space-2) var(--space-1);
        }

        input:focus {
            outline: none;
        }

        .help-icon {
            cursor: pointer;
            margin: 0 0.3em;
            height: 1.1em;
            color: var(--fg-muted);
            aspect-ratio: 1;
        }

        .help-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            overflow: hidden;
            gap: 0.5em;
        }

        .help {
            flex-grow: 1;
            overflow: auto;
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-m);
            padding: 0 var(--space-4);
        }
    `,
    template: html`
        <div class="wrapper">
            <input
                type="{{type}}"
                value="{{value}}"
                @change.stop.prevent="change($event.target.value)"
            />
            <load-svg
                *if="helpHtml"
                class="help-icon"
                @click.stop.prevent="showHelp()"
                href="/question.svg"
            ></load-svg>
        </div>
        <show-modal *if="showingHelp" @clickoutside="hideHelp()">
            <div class="help-wrapper">
                <div class="help">
                    <i18n-html id="{{helpHtml}}"></i18n-html>
                </div>
                <pretty-labeled-button
                    id="shared.prettyInput.close"
                    @click="hideHelp()"
                ></pretty-labeled-button>
            </div>
        </show-modal>
    `,
}, PrettyInputComponent);
