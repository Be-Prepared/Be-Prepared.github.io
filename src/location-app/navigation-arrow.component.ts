import { Component, css, html } from 'fudgel';

@Component('navigation-arrow', {
    attr: ['lat', 'lon'],
    style: css`
        :host {
            display: flex;
            overflow: hidden;
            justify-content: center;
            align-items: center;
            position: relative;
            padding: 10px;
            box-sizing: border-box;
        }

        .container {
            position: absolute;
            aspect-ratio: 1/1;
            margin: auto;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            max-width: 100%;
            max-height: 100%;
        }

        .compassRose {
            width: 100%;
            height: 100%;
        }
    `,
    template: html`
        <div class="container">
        <load-svg class="compassRose" href="/compass-rose.svg" #ref="compassRose"></load-svg>
        </container>
    `,
})
export class NavigationArrowComponent {}
