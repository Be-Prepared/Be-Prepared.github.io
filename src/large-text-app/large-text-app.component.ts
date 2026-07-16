import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

export class LargeTextAppComponent {
    private _i18nService = di(I18nService);
    editor?: HTMLDivElement;
    placeholder = '';

    onInit() {
        this.placeholder = this._i18nService.get('largeText.placeholder');
    }

    onInput() {
        if (this.editor && !this.editor.textContent?.trim()) {
            this.editor.textContent = '';
        }
    }
}

component('large-text-app', {
    style: css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
        }

        .content {
            height: 100%;
            width: 100%;
            display: flex;
            box-sizing: border-box;
        }

        grow-to-fit-font-size {
            flex-grow: 1;
        }

        .editor {
            outline: none;
            text-align: center;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            max-width: 100%;
            min-width: 0;
            min-height: 1em;
        }

        .editor:empty::before {
            content: attr(data-placeholder);
            opacity: 0.6;
        }
    `,
    template: html`
        <default-layout>
            <div class="content">
                <grow-to-fit-font-size>
                    <div
                        #ref="editor"
                        class="editor"
                        contenteditable="true"
                        spellcheck="false"
                        data-placeholder="{{placeholder}}"
                        @input.stop="onInput()"
                    ></div>
                </grow-to-fit-font-size>
            </div>
        </default-layout>
    `,
    useShadow: true,
}, LargeTextAppComponent);
