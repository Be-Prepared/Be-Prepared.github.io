import { Component, css, html } from 'fudgel';

@Component('app-front-light', {
    style: css`
        .full {
            width: 100%;
            height: 100%;
            background-color: white;
            color: black;
        }
    `,
    template: html`
    <div class="full"></div>
    `
})
export class AppFrontLightComponent {
}
