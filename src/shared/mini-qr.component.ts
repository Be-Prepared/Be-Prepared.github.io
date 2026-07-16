import { component, css, html } from 'fudgel';

export class MiniQrComponent {
    content = '';
}

component('mini-qr', {
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
}, MiniQrComponent);
