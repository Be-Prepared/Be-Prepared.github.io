import { Component, css, html } from 'fudgel';
import { LatLon } from '../services/coordinate.service';
import { default as SunCalc } from 'suncalc';

@Component('moon-illumination', {
    prop: ['coordinates'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <i18n-label id="sunMoon.moonIllumination.label"></i18n-label>
            <i18n-label id="{{moonIllumination}}"></i18n-label>
            <span>({{fraction}}%)</span>
        </div>
    `,
})
export class MoonIlluminationComponent {
    coordinates: LatLon | null = null;
    fraction: number | null = null;
    moonIllumination: string | null = null;

    onChange(prop: string) {
        if (prop === 'coordinates' && this.coordinates) {
            const moonIllumination = SunCalc.getMoonIllumination(new Date());
            this.fraction = Math.round(moonIllumination.fraction);
            const phase = moonIllumination.phase;

            if (phase < 0.0625) {
                this.moonIllumination = 'sunMoon.moonIllumination.newMoon';
            } else if (phase < 0.1875) {
                this.moonIllumination = 'sunMoon.moonIllumination.waxingCrescent';
            } else if (phase < 0.3125) {
                this.moonIllumination = 'sunMoon.moonIllumination.firstQuarter';
            } else if (phase < 0.4375) {
                this.moonIllumination = 'sunMoon.moonIllumination.waxingGibbous';
            } else if (phase < 0.5625) {
                this.moonIllumination = 'sunMoon.moonIllumination.fullMoon';
            } else if (phase < 0.6875) {
                this.moonIllumination = 'sunMoon.moonIllumination.waningGibbous';
            } else if (phase < 0.8125) {
                this.moonIllumination = 'sunMoon.moonIllumination.lastQuarter';
            } else if (phase < 0.9375) {
                this.moonIllumination = 'sunMoon.moonIllumination.waningCrescent';
            } else {
                this.moonIllumination = 'sunMoon.moonIllumination.newMoon';
            }
        }
    }
}