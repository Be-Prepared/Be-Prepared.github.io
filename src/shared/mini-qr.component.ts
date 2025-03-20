import { Component, css, html } from 'fudgel';

@Component('mini-qr', {
    attr: ['content'],
    style: css`
        :host {
            position: relative;
            display: block;
            width: 4em;
            height: 4em;
        }
    `,
    template: html`
        <qr-code content="{{content}}"></qr-code>
    `,
})
export class MiniQrComponent {
    content = '';
}
