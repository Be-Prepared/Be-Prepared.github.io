export interface DetectedBarcodeData {
    boundingBox?: DOMRectReadOnly; // Native only
    cornerPoints?: DOMPointReadOnly[]; // Native only
    format: string;
    points?: { x: number; y: number }[];
    rawValue: string;
}

export interface BarcodeReaderInterface {
    detect(
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D
    ): Promise<DetectedBarcodeData[]>;
    supportedFormats(): Promise<string[]>;
    type(): string;
}
