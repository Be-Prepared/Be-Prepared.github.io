import { Component, css, html } from 'fudgel';

@Component('front-light-app', {
    style: css`
        .full {
            width: 100%;
            height: 100%;
            background-color: white;
            color: black;
        }

        .back {
            position: fixed;
            bottom: 0;
            left: 0;
        }
    `,
    template: html`
    <div class="full">
        <div class="back">
            <back-button></back-button>
        </div>
    </div>
    `
})
export class FrontLightAppComponent {
    back() {
        window.history.go(-1);
    }
}
