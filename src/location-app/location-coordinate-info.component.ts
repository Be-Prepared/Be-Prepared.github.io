import { Component, css, html } from 'fudgel';

@Component('location-coordinate-info', {
    style: css``,
    template: html`
        <pretty-labeled-button
            @click="showLocationHelp()"
            id="location.coordinateInfo"
        ></pretty-labeled-button>
    `,
})
export class LocationCoordinateInfoComponent {
    showLocationHelp() {
        history.pushState({}, document.title, '/location-help');
    }
}
