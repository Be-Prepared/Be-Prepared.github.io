import qrcode from 'qrcode-generator';

type QrCodeEcl = 'L' | 'M' | 'Q' | 'H';

// A piece of QR content in one encoding. Alphanumeric segments pack
// 0-9, A-Z, and " $%*+-./:" at 5.5 bits per character instead of 8.
export interface QrSegment {
    data: string;
    mode: 'Alphanumeric' | 'Byte';
}

// Quiet zone around the code, in modules. The standard asks for 4.
const MARGIN = 4;
// A trailing run of alphanumeric characters this long gets its own,
// denser segment. Shorter runs aren't worth the risk with odd readers.
const ALPHANUMERIC_TAIL = 100;
const ALPHANUMERIC = /[0-9A-Z $%*+\-./:]*$/;

// Splits text into a byte segment and a trailing alphanumeric segment, so
// file transfer frames (a URL, then a long alphanumeric payload) fit more
// data. Readers join the segments back into the same text.
export function segmentsFor(text: string): QrSegment[] {
    const tail = ALPHANUMERIC.exec(text)![0];

    if (tail.length < ALPHANUMERIC_TAIL) {
        return [{ data: text, mode: 'Byte' }];
    }

    const head = text.slice(0, text.length - tail.length);
    const segments: QrSegment[] = [{ data: tail, mode: 'Alphanumeric' }];

    return head ? [{ data: head, mode: 'Byte' }, ...segments] : segments;
}

// Byte segments are UTF-8. The library's default keeps only the low byte of
// each character. Readers treat byte segments as Latin-1 unless told
// otherwise, so non-ASCII text starts with a UTF-8 byte order mark, which
// they recognize.
qrcode.stringToBytes = (text: string) => {
    const bytes = Array.from(new TextEncoder().encode(text));

    return bytes.length === text.length ? bytes : [0xef, 0xbb, 0xbf, ...bytes];
};

export class QrService {
    svg(content: string | QrSegment[], ecl: QrCodeEcl = 'L'): string {
        const qr = qrcode(0, ecl);
        const segments = typeof content === 'string' ? segmentsFor(content) : content;

        for (const segment of segments) {
            qr.addData(segment.data, segment.mode);
        }

        qr.make();
        const count = qr.getModuleCount();
        const size = count + MARGIN * 2;
        let path = '';

        // One run of dark modules per path piece keeps the SVG small.
        for (let row = 0; row < count; row += 1) {
            for (let col = 0; col < count; col += 1) {
                if (qr.isDark(row, col)) {
                    const start = col;

                    while (col + 1 < count && qr.isDark(row, col + 1)) {
                        col += 1;
                    }

                    path += `M${start + MARGIN},${row + MARGIN}h${col - start + 1}v1h${start - col - 1}z`;
                }
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;
    }
}
