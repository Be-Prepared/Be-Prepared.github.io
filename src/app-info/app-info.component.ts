import { Component, css, html } from 'fudgel';

@Component('app-info', {
    style: css`
        :host {
            display: block;
            font-size: 1.2em;
            height: 100%;
            box-sizing: border-box;
            padding: 1em;
        }

        .modal {
            border-width: 1px;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            height: 100%;
            overflow-x: auto;
        }
    `,
    template: html`
    <div class="modal">
        <p>Many thanks to the following:</p>
        <p>Tooling:</p>
        <ul>
            <li><a href="https://fudgel.js.org">Fudgel</a> is the framework driving this app</li>
            <li><a href="https://vecta.io/nano">Vecta.io</a> for SVG compression</li>
        </ul>
        <p>Icons from Flaticon:</p>
        <ul>
        <li><a href="https://www.flaticon.com/free-icons/toolbox" title="toolbox icons">Toolbox icons created by Muhammad Atif</li>
        <li><a href="https://www.flaticon.com/free-icons/compass" title="compass icons">Compass icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/map-place-holder" title="map place holder icons">Map place holder icons created by Nadiinko</a></li>
        <li><a href="https://www.flaticon.com/free-icons/flashlight" title="flashlight icons" data-uw-rm-brl="false" style="transition: all 0s ease 0s;">Flashlight icons created by Aranagraphics</a></li>
        <li><a href="https://www.flaticon.com/free-icons/idea" title="idea icons" data-uw-rm-brl="false">Idea icons created by Good Ware</a></li>
        <li><a href="https://www.flaticon.com/free-icons/magnifying-glass" title="magnifying glass icons">Magnifying glass icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/mirror" title="mirror icons">Mirror icons created by catkuro</a></li>
        <li><a href="https://www.flaticon.com/free-icons/stopwatch" title="stopwatch icons">Stopwatch icons created by Good Ware</a></li>
        <li><a href="https://www.flaticon.com/free-icons/timer" title="timer icons">Timer icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/ruler" title="ruler icons">Ruler icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/spirit-level" title="spirit level icons">Spirit level icons created by pmicon</a></li>
        <li><a href="https://www.flaticon.com/free-icons/car" title="car icons">Car icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/sensor" title="sensor icons">Sensor icons created by LAFS</a></li>
        <li><a href="https://www.flaticon.com/free-icons/metal-detector" title="metal detector icons">Metal detector icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/pause" title="pause icons">Pause icons created by Freepik</a></li>
        <li><a href="https://www.flaticon.com/free-icons/video" title="video icons">Video icons created by Bingge Liu</a></li>
        <li><a href="https://www.flaticon.com/free-icons/refresh" title="refresh icons">Refresh icons created by Freepik</a></li>
    </ul>
    <p>Other icons:</p>
    <ul>
        <li><a href="https://www.stockio.com/free-icon/info" data-uw-rm-brl="false">Info icon by Stockio.com</a></li>
    </ul>
    </div>
    `,
})
export class AppInfoComponent {}
