import {
    AccessController,
    AccessState,
} from './access/access-controller';
import { watchPermission } from './access/permission-status';

export interface NfcScanResult {
    readError?: true;
    ready?: true;
    records?: ReadonlyArray<NDEFRecord>;
    serialNumber?: string;
    timestamp: Date;
}

function classifyNfcError(error: any) {
    switch (error && error.name) {
        case 'NotAllowedError':
            return AccessState.DENIED;

        case 'NotSupportedError':
            return AccessState.UNAVAILABLE;

        default:
            // NotReadableError is what Chrome reports when NFC is switched
            // off in the phone's settings.
            return AccessState.ERROR;
    }
}

export class NfcService {
    // Creates a controller that scans for tags while the screen is open.
    // Results are sent to the callback.
    controller(onResult: (result: NfcScanResult) => void) {
        return new AccessController<AbortController>({
            permission: watchPermission('nfc'),
            acquire: () => {
                const abortController = new AbortController();
                const reader = new NDEFReader();
                reader.onreading = (event) =>
                    onResult({
                        records: event.message.records,
                        serialNumber: event.serialNumber,
                        timestamp: new Date(),
                    });
                reader.onreadingerror = () =>
                    onResult({ readError: true, timestamp: new Date() });

                return reader
                    .scan({ signal: abortController.signal })
                    .then(() => {
                        onResult({ ready: true, timestamp: new Date() });

                        return abortController;
                    });
            },
            release: (abortController) => abortController.abort(),
            classifyError: classifyNfcError,
        });
    }

    isSupported() {
        return typeof window !== 'undefined' && 'NDEFReader' in window;
    }
}
