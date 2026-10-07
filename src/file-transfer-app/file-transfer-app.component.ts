import { component, css, html } from 'fudgel';

export class FileTransferAppComponent {
    receive() {
        // Short URL for shorter QR codes
        history.pushState({}, document.title, '/r');
    }

    send() {
        history.pushState({}, document.title, '/file-transfer-send');
    }
}

component('file-transfer-app', {
    style: css`
        .wrapper {
            height: 100%;
            width: 100%;
            max-width: 32rem;
            margin: 0 auto;
            box-sizing: border-box;
            padding: var(--space-4);
            display: flex;
            justify-content: center;
            align-items: stretch;
            flex-direction: column;
            gap: var(--space-4);
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
                align-items: center;
                max-width: 44rem;
            }
        }

        .choice {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            min-height: 9rem;
            max-height: 14rem;
            padding: var(--space-4);
            font: inherit;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--fg);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
            box-shadow: var(--shadow);
            cursor: pointer;
        }

        .choice:active {
            background: var(--surface-2);
        }

        .choice load-svg {
            width: 3rem;
            height: 3rem;
            color: var(--accent);
        }
    `,
    template: html`
        <default-layout>
            <div class="wrapper">
                <button class="choice" @click.stop.prevent="send()">
                    <load-svg href="/share-1.svg"></load-svg>
                    <i18n-label id="fileTransfer.send" ws=""></i18n-label>
                </button>
                <button class="choice" @click.stop.prevent="receive()">
                    <load-svg href="/camera.svg"></load-svg>
                    <i18n-label id="fileTransfer.receive" ws=""></i18n-label>
                </button>
            </div>
        </default-layout>
    `,
}, FileTransferAppComponent);
