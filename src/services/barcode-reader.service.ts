import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { PreferenceService } from './preference.service';
import { switchMap } from 'rxjs/operators';

export class BarcodeReaderService {
    private _canvas: HTMLCanvasElement | null = null;
    private _context: CanvasRenderingContext2D | null = null;
    private _instance: any;
    private _permissionsService = di(PermissionsService);
    private _preferenceService = di(PreferenceService);

    availabilityState(useLiveValue: boolean) {
        if (!navigator.mediaDevices || !this._barcodeDetector()) {
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
                    const cached = this._preferenceService.barcodeReader.getItem();

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
        return this._makeInstance().then((instance) => {
            let canvas = this._canvas;

            if (!canvas) {
                this._canvas = canvas = document.createElement('canvas');
                this._context = null;
            }

            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                this._context = null;
            }

            let context = this._context;

            if (!context) {
                this._context = context = canvas.getContext('2d')!;
            }

            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            return instance.detect(canvas);
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
        const barcodeDetector = this._barcodeDetector();

        if (!barcodeDetector) {
            return Promise.resolve([]);
        }

        return this._barcodeDetector().getSupportedFormats();
    }

    private _barcodeDetector() {
        return (window as any).BarcodeDetector;
    }

    private _makeInstance() {
        if (this._instance) {
            return Promise.resolve(this._instance);
        }

        return this.supportedFormats().then((formats) => {
            return new (this._barcodeDetector() as any)({
                formats,
            });
        });
    }
}
