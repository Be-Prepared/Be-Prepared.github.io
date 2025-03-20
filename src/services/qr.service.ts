import { default as QrCodeSvg } from '@tofandel/qrcode-svg';

type QrCodeEcl = 'L' | 'M' | 'Q' | 'H';

export class QrService {
    svg(content: string, ecl: QrCodeEcl = 'L'): string {
        const qr = new QrCodeSvg({
            container: 'svg-viewbox',
            content: content,
            ecl: ecl,
            join: true,
        });
        return qr.svg();
    }
}
