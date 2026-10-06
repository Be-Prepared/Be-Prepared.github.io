import { BarcodeReaderInterface } from './barcode-reader/barcode-reader-interface';
import { BarcodeReaderNative } from './barcode-reader/barcode-reader-native';
import { BarcodeReaderZBar } from './barcode-reader/barcode-reader-z-bar';
import {
    BarcodeEngine,
    BarcodeEngineType,
    chooseEngine,
    EngineChoice,
    NativeProbe,
    normalizeEngine,
} from './barcode-reader/engine-selection';
import { BehaviorSubject } from 'rxjs';
import { di } from '../di';
import { PreferenceService } from './preference.service';

export interface BarcodeEngineReport {
    choice: EngineChoice;
    native: NativeProbe;
    preference: BarcodeEngine;
    zbarFormats: string[];
}

// Both the barcode reader and File Transfer's receiver use this, so the
// engine preference applies to both.
export class BarcodeReaderService {
    private _canvas: HTMLCanvasElement | null = null;
    private _context: CanvasRenderingContext2D | null = null;
    private _instances = new Map<
        BarcodeEngineType,
        Promise<BarcodeReaderInterface>
    >();
    private _nativeProbe: Promise<NativeProbe> | null = null;
    private _preference: BehaviorSubject<BarcodeEngine>;
    private _preferenceService = di(PreferenceService);

    constructor() {
        this._preference = new BehaviorSubject(
            normalizeEngine(this._preferenceService.barcodeEngine.getItem())
        );
    }

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

    // The saved choice: automatic, native, or ZBar.
    getPreference() {
        return this._preference.asObservable();
    }

    setPreference(value: BarcodeEngine) {
        const normalized = normalizeEngine(value);
        this._preferenceService.barcodeEngine.setItem(normalized);
        this._preference.next(normalized);
    }

    // What would be used right now and why, plus what each engine reads.
    report(): Promise<BarcodeEngineReport> {
        const preference = this._preference.value;

        return Promise.all([
            this._probeNative(),
            BarcodeReaderZBar.create().then((zbar) => zbar.supportedFormats()),
        ]).then(([native, zbarFormats]) => ({
            choice: chooseEngine(preference, native),
            native,
            preference,
            zbarFormats,
        }));
    }

    supportedFormats(): Promise<string[]> {
        return this._instance().then((instance) =>
            instance.supportedFormats()
        );
    }

    type() {
        return this._instance().then((instance) => instance.type());
    }

    // Decided on every call so a changed preference takes effect on the next
    // frame. Instances are created lazily so the WASM module isn't loaded
    // until it's needed.
    private _instance(): Promise<BarcodeReaderInterface> {
        const preference = this._preference.value;

        return this._probeNative().then((probe) => {
            const { engine } = chooseEngine(preference, probe);
            let instance = this._instances.get(engine);

            if (!instance) {
                instance =
                    engine === BarcodeEngine.NATIVE
                        ? BarcodeReaderNative.create().catch(() =>
                              BarcodeReaderZBar.create()
                          )
                        : BarcodeReaderZBar.create();
                this._instances.set(engine, instance);
                // Don't remember a failure; try again next time.
                instance.catch(() => this._instances.delete(engine));
            }

            return instance;
        });
    }

    // Probed once per page load (kept in memory only, never stored);
    // detect() runs many times per second.
    private _probeNative(): Promise<NativeProbe> {
        if (!this._nativeProbe) {
            if (!BarcodeReaderNative.isSupported()) {
                this._nativeProbe = Promise.resolve({
                    available: false,
                    formats: null,
                });
            } else {
                this._nativeProbe = BarcodeReaderNative._supportedFormats()
                    .then((formats) => ({
                        available: true,
                        formats: Array.isArray(formats) ? formats : null,
                    }))
                    .catch(() => ({ available: true, formats: null }));
            }
        }

        return this._nativeProbe;
    }
}
