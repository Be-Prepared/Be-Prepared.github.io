import { BarcodeReaderInterface, DetectedBarcodeData } from './barcode-reader-interface';
import { scanImageData } from '@undecaf/zbar-wasm';

export class BarcodeReaderZBar implements BarcodeReaderInterface {
    static create() {
        return Promise.resolve(new BarcodeReaderZBar);
    }

    static isSupported() {
        return true;
    }

    detect(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return scanImageData(imageData).then((symbols) => {
            return symbols.map((symbol) => {
                const detectedBarcode: DetectedBarcodeData = {
                    points: symbol.points,
                    format: symbol.typeName,
                    rawValue: symbol.decode(),
                };

                return detectedBarcode;
            });
        });
    }

    supportedFormats() {
        return Promise.resolve([
            'code_39',
            'code_93',
            'code_128',
            'codabar',
            'databar/expanded',
            'ean_5',
            'ean_8',
            'ean_13',
            'isbn_10',
            'isbn_13',
            'isbn_13+2',
            'isbn_13+5',
            'itf',
            'qr_code',
            'upc_a',
            'upc_e',
        ]);
    }

    type() {
        return 'Z_BAR';
    }
}
