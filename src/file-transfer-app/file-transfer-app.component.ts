import { Component, css, html } from 'fudgel';

@Component('file-transfer-app', {
    style: css`
        .wrapper {
            height: 100%;
            width: 100%;
            display: flex;
            justify-content: space-evenly;
            align-items: center;
            flex-direction: column;
            font-size: 2em;
        }
    `,
    template: html`
        <default-layout>
            <div class="wrapper">
                <div></div>
                <pretty-labeled-button
                    @click.stop.prevent="send()"
                    id="fileTransfer.send"
                ></pretty-labeled-button>
                <pretty-labeled-button
                    @click.stop.prevent="receive()"
                    id="fileTransfer.receive"
                ></pretty-labeled-button>
                <div></div>
            </div>
        </default-layout>
    `,
})
export class FileTransferAppComponent {
    receive() {
        // Short URL for shorter QR codes
        history.pushState({}, document.title, '/r');
    }

    send() {
        history.pushState({}, document.title, '/file-transfer-send');
    }
}
