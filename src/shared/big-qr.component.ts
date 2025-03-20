import { Component, css, html } from 'fudgel';

@Component('big-qr', {
    attr: ['content'],
    style: css`
        :host {
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .svg {
            width: 90vmin;
            height: 90vmin;
        }
    `,
    template: html`
        <div class="svg"><qr-code content="{{content}}"></qr-code></div>
    `,
})
export class BigQrComponent {
    content = '';
}
