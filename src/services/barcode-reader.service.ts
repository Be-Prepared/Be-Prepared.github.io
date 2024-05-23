import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { PreferenceService } from './preference.service';
import { scanImageData } from '@undecaf/zbar-wasm';
import { switchMap } from 'rxjs/operators';

export interface DetectedBarcodeData {
    boundingBox?: DOMRectReadOnly; // Native only
    cornerPoints?: DOMPointReadOnly[]; // Native only
    format: string;
    points?: { x: number; y: number }[];
    rawValue: string;
}

interface BarcodeReader {
    detect(
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D
    ): Promise<DetectedBarcodeData[]>;
    supportedFormats(): Promise<string[]>;
}

class BarcodeReaderNative implements BarcodeReader {
    private _instance: any;

    constructor(formats: string[]) {
        this._instance = new (BarcodeReaderNative._getDetector() as any)({
            formats,
        });
    }

    static create() {
        return BarcodeReaderNative._supportedFormats().then((formats) => {
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
}

class BarcodeReaderZBar implements BarcodeReader {
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
}

export class BarcodeReaderService {
    private _canvas: HTMLCanvasElement | null = null;
    private _context: CanvasRenderingContext2D | null = null;
    private _instancePromise: Promise<BarcodeReader>;
    private _permissionsService = di(PermissionsService);
    private _preferenceService = di(PreferenceService);

    constructor() {
        let instance: any = BarcodeReaderZBar;

        if (BarcodeReaderNative.isSupported()) {
            instance = BarcodeReaderNative;
        }

        this._instancePromise = instance.create();
    }

    availabilityState(useLiveValue: boolean) {
        if (!navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        const whenGranted = () => {
            return from(
                this.getStream().then((stream) => {
                    const tracks = stream.getVideoTracks();

                    if (tracks.length) {
                        this._preferenceService.barcodeReader.setItem(true);

                        return AvailabilityState.ALLOWED;
                    }

                    this._preferenceService.barcodeReader.setItem(false);

                    return AvailabilityState.UNAVAILABLE;
                })
            );
        };

        return this._permissionsService.camera().pipe(
            switchMap((state) => {
                if (!useLiveValue) {
                    const cached =
                        this._preferenceService.barcodeReader.getItem();

                    if (cached === true) {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === false) {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return this._permissionsService.toAvailability(
                    state,
                    whenGranted
                );
            })
        );
    }

    detect(video: HTMLVideoElement) {
        return this._instancePromise.then((instance) => {
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
                    willReadFrequently: true
                })! as CanvasRenderingContext2D;
            }

            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            return instance.detect(canvas, context);
        });
    }

    getStream() {
        return navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
            },
        });
    }

    prompt() {
        return this._permissionsService.camera(true);
    }

    supportedFormats(): Promise<string[]> {
        return this._instancePromise.then((instance) =>
            instance.supportedFormats()
        );
    }
}
