import { BarcodeReaderInterface } from './barcode-reader/barcode-reader-interface';
import { BarcodeReaderNative } from './barcode-reader/barcode-reader-native';
import { BarcodeReaderZBar } from './barcode-reader/barcode-reader-z-bar';

export class BarcodeReaderService {
    private _canvas: HTMLCanvasElement | null = null;
    private _context: CanvasRenderingContext2D | null = null;
    private _instancePromise: Promise<BarcodeReaderInterface> | null = null;

    detect(video: HTMLVideoElement) {
        // Nothing to look at until the video has a frame.
        if (!video || !video.videoWidth || !video.videoHeight) {
            return Promise.resolve([]);
        }

        return this._instance().then((instance) => {
            let canvas = this._canvas;

            if (!canvas) {
                this._canvas = canvas = document.createElement('canvas');
                this._context = null;
            }

            if (
                canvas.width !== video.videoWidth ||
                canvas.height !== video.videoHeight
            ) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                this._context = null;
            }

            let context = this._context;

            if (!context) {
                this._context = context = canvas.getContext('2d', {
                    willReadFrequently: true,
                })! as CanvasRenderingContext2D;
            }

            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            return instance.detect(canvas, context);
        });
    }

    supportedFormats(): Promise<string[]> {
        return this._instance().then((instance) =>
            instance.supportedFormats()
        );
    }

    type() {
        return this._instance().then((instance) => instance.type());
    }

    // Created lazily so the WASM module isn't loaded until it's needed.
    private _instance() {
        if (!this._instancePromise) {
            const zbar = () => BarcodeReaderZBar.create();
            this._instancePromise = BarcodeReaderNative.isSupported()
                ? BarcodeReaderNative.create().catch(zbar)
                : zbar();
        }

        return this._instancePromise;
    }
}
