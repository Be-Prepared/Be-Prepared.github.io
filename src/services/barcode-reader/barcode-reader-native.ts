import { BarcodeReaderInterface } from './barcode-reader-interface';

export class BarcodeReaderNative implements BarcodeReaderInterface {
    private _instance: any;

    constructor(formats: string[]) {
        this._instance = new (BarcodeReaderNative._getDetector() as any)({
            formats,
        });
    }

    // Rejects when the browser has the API but can't read anything, which
    // happens on Android devices without the needed system libraries. The
    // caller falls back to the WASM reader.
    static create() {
        return BarcodeReaderNative._supportedFormats().then((formats) => {
            if (!formats || !formats.length) {
                throw new Error('No supported barcode formats');
            }

            return new BarcodeReaderNative(formats);
        });
    }

    static isSupported() {
        return !!BarcodeReaderNative._getDetector();
    }

    static _getDetector() {
        return (window as any).BarcodeDetector;
    }

    static _supportedFormats(): Promise<string[]> {
        return BarcodeReaderNative._getDetector().getSupportedFormats();
    }

    detect(canvas: HTMLCanvasElement) {
        return this._instance.detect(canvas);
    }

    supportedFormats(): Promise<string[]> {
        return BarcodeReaderNative._supportedFormats();
    }

    type() {
        return 'NATIVE';
    }
}
