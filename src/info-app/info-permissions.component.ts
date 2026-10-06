import { CameraService } from '../services/camera.service';
import { combineLatest, from, Observable, of, Subscription } from 'rxjs';
import { component, css, html } from 'fudgel';
import { detectCompassHardware } from '../tile-defs';
import { CompassService } from '../services/compass.service';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { map } from 'rxjs/operators';
import { NfcService } from '../services/nfc.service';
import {
    PermissionStatus,
    watchPermission,
} from '../services/access/permission-status';
import { WakeLockService } from '../services/wake-lock.service';

interface FeatureRow {
    hardware: string;
    label: string;
    permission: string;
    permissionClass: string;
}

function row(
    label: string,
    hardware: Promise<boolean> | boolean,
    permissionName: string | null
): Observable<FeatureRow> {
    const permission = permissionName
        ? watchPermission(permissionName)
        : of(null);

    return combineLatest([from(Promise.resolve(hardware)), permission]).pipe(
        map(([hasHardware, status]) => ({
            hardware: hasHardware ? 'info.hardware.yes' : 'info.hardware.no',
            label,
            permission:
                hasHardware && status ? `info.permission.${status}` : '',
            permissionClass:
                status === PermissionStatus.GRANTED
                    ? 'good'
                    : status === PermissionStatus.DENIED
                      ? 'bad'
                      : '',
        }))
    );
}

// Shows what this device has and the current permission states. Nothing
// here asks for a permission or turns on any hardware.
export class InfoPermissionsComponent {
    private _subscription: Subscription | null = null;
    rows: FeatureRow[] = [];

    onInit() {
        const camera = di(CameraService);
        const geolocation = di(GeolocationService);
        const nfc = di(NfcService);
        const wakeLock = di(WakeLockService);
        this._subscription = combineLatest([
            row('info.camera', camera.hasCamera(), 'camera'),
            row(
                'info.compass',
                detectCompassHardware(di(CompassService)),
                null
            ),
            row('info.geolocation', geolocation.isSupported(), 'geolocation'),
            row('info.nfc', nfc.isSupported(), 'nfc'),
            row('info.wakeLock', wakeLock.isSupported(), null),
        ]).subscribe((rows) => (this.rows = rows));
    }

    onDestroy() {
        this._subscription?.unsubscribe();
    }
}

component(
    'info-permissions',
    {
        style: css`
            .rows {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: var(--space-2) var(--space-3);
                align-items: baseline;
            }

            .row {
                display: contents;
            }

            .muted {
                color: var(--fg-muted);
            }

            .good {
                color: var(--success);
            }

            .bad {
                color: var(--danger);
            }
        `,
        template: html`
            <info-header id="info.permissionsAndFeaturesHeader"></info-header>
            <div class="rows">
                <div class="row" *for="item of rows">
                    <div><i18n-label id="{{item.label}}" ws=""></i18n-label></div>
                    <div class="muted">
                        <i18n-label id="{{item.hardware}}" ws=""></i18n-label>
                    </div>
                    <div class="{{item.permissionClass}}">
                        <i18n-label
                            *if="item.permission"
                            id="{{item.permission}}"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
            </div>
        `,
    },
    InfoPermissionsComponent
);
