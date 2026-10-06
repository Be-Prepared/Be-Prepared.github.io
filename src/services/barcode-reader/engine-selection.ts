// Which barcode library to use. Kept free of DOM and WASM imports so it can
// be tested.

export enum BarcodeEngine {
    AUTOMATIC = 'AUTOMATIC',
    NATIVE = 'NATIVE',
    Z_BAR = 'Z_BAR',
}

export type BarcodeEngineType = BarcodeEngine.NATIVE | BarcodeEngine.Z_BAR;

export const BARCODE_ENGINES = [
    BarcodeEngine.AUTOMATIC,
    BarcodeEngine.NATIVE,
    BarcodeEngine.Z_BAR,
];

export const BarcodeEngineDefault = BarcodeEngine.AUTOMATIC;

export interface NativeProbe {
    // The browser has a BarcodeDetector.
    available: boolean;

    // What BarcodeDetector.getSupportedFormats() returned. Android devices
    // without the needed system libraries report an empty list, and the
    // call may fail entirely (null).
    formats: string[] | null;
}

export interface EngineChoice {
    engine: BarcodeEngineType;

    // The person asked for the native reader but it can't read anything
    // here, so ZBar is used instead. The UI says so.
    fellBack: boolean;
}

export function nativeUsable(probe: NativeProbe) {
    return !!(probe.available && probe.formats && probe.formats.length);
}

export function chooseEngine(
    preference: BarcodeEngine | null | undefined,
    probe: NativeProbe
): EngineChoice {
    const usable = nativeUsable(probe);

    switch (preference) {
        case BarcodeEngine.Z_BAR:
            return { engine: BarcodeEngine.Z_BAR, fellBack: false };

        case BarcodeEngine.NATIVE:
            return usable
                ? { engine: BarcodeEngine.NATIVE, fellBack: false }
                : { engine: BarcodeEngine.Z_BAR, fellBack: true };

        default:
            return {
                engine: usable ? BarcodeEngine.NATIVE : BarcodeEngine.Z_BAR,
                fellBack: false,
            };
    }
}

// Accepts anything stored and turns it into a known preference.
export function normalizeEngine(value: unknown): BarcodeEngine {
    return BARCODE_ENGINES.includes(value as BarcodeEngine)
        ? (value as BarcodeEngine)
        : BarcodeEngineDefault;
}
