import { default as QrCodeSvg } from '@tofandel/qrcode-svg';

export class QrService {
    svg(content: string): string {
        const qr = new QrCodeSvg({
            container: 'svg-viewbox',
            content: content,
            join: true,
        });
        return qr.svg();
    }
}
