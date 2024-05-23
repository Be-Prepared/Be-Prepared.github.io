import { Component, css, emit, html } from 'fudgel';

@Component('pretty-input', {
    attr: ['helpHtml', 'value'],
    prop: ['value'],
    style: css`
        :host {
            display: inline-block;
        }

        .wrapper {
            display: flex;
            align-items: center;
            border: 1px solid var(--fg-color);
            padding: 0em;
        }

        input {
            font: inherit;
            width: 100%;
            text-align: center;
            color: var(--fg-color);
            background-color: var(--bg-color);
            border: 0;
        }

        .help-icon {
            cursor: pointer;
            margin: 0 0.3em;
            height: 1em;
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
            background-color: var(--bg-color);
            border: 1px solid var(--fg-color);
            padding: 0 0.5em;
        }
    `,
    template: html`
        <div class="wrapper">
            <input
                type="text"
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
                <div class="help"><i18n-html id="{{helpHtml}}"></i18n-html></div>
                <pretty-labeled-button
                    id="shared.prettyInput.close"
                    @click="hideHelp()"
                ></pretty-labeled-button>
            </div>
        </show-modal>
    `,
})
export class PrettyInputComponent {
    helpHtml?: string;
    showingHelp = false;

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
