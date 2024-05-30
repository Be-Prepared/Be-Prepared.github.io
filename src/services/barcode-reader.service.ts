import { AvailabilityState } from '../datatypes/availability-state';
import { BarcodeReaderInterface } from './barcode-reader/barcode-reader-interface';
import { BarcodeReaderNative } from './barcode-reader/barcode-reader-native';
import { BarcodeReaderZBar } from './barcode-reader/barcode-reader-z-bar';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { PreferenceService } from './preference.service';
import { switchMap } from 'rxjs/operators';

export class BarcodeReaderService {
    private _canvas: HTMLCanvasElement | null = null;
    private _context: CanvasRenderingContext2D | null = null;
    private _instancePromise: Promise<BarcodeReaderInterface>;
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
                    willReadFrequently: true,
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

    type() {
        return this._instancePromise.then((instance) => instance.type());
    }
}
