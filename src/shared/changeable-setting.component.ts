import { component, css } from 'fudgel';

export class ChangeableSettingComponent {}

component('changeable-setting', {
    style: css`
        :host {
            text-decoration: underline;
            text-decoration-style: dotted;
            text-decoration-thickness: 2px;
            text-underline-offset: 0.2em;
            text-decoration-color: var(--changeable-setting-underline-color);
            cursor: pointer;
        }
    `,
    template: '<slot></slot>',
    useShadow: true,
}, ChangeableSettingComponent);
