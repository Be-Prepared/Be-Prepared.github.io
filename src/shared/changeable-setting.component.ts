import { Component, css } from 'fudgel';

@Component('changeable-setting', {
    style: css`
        :host {
            text-decoration: underline;
            text-decoration-style: dotted;
            text-decoration-color: var(--changeable-setting-underline-color);
            cursor: pointer;
        }
    `,
    template: '<slot></slot>',
    useShadow: true,
})
export class ChangeableSettingComponent {}
