import { CameraService } from '../services/camera.service';
import { component, Controller, css, html, metadata } from 'fudgel';
import { AccessController } from '../services/access/access-controller';
import { di } from '../di';
import { Facing } from '../services/camera/camera-choice';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';
import { ToastService } from '../services/toast.service';

// A toolbar button that switches to the phone's next camera on the same
// side (wide, main, telephoto...). It only shows when there is more than
// one, which most phones don't offer to web apps.
//
//   <camera-switch slot="more-buttons" .camera="cameraController"></camera-switch>
//   <camera-switch slot="more-buttons" .camera="cameraController" facing="user">
//
// Goes right after the light button. See AGENTS.md for the button order.
export class CameraSwitchComponent {
    private _cameraService = di(CameraService);
    private _i18nService = di(I18nService);
    private _stream: MediaStream | null = null;
    private _subscription?: Subscription;
    private _switching = false;
    private _toastService = di(ToastService);
    camera?: AccessController<MediaStream>;
    facing: Facing = 'environment';
    show = false;

    private _setShow(show: boolean) {
        this.show = show;
        (this as Controller)[metadata]?.host.classList.toggle('shown', show);
    }

    onInit() {
        this._watch();
    }

    onChange(name: string) {
        if (name === 'camera') {
            this._watch();
        }
    }

    onDestroy() {
        this._subscription?.unsubscribe();
    }

    next() {
        const camera = this.camera;

        if (!camera || !this._stream) {
            return;
        }

        this._cameraService.chooseNext(this._side(), this._stream).then((choices) => {
            if (choices.count < 2) {
                return;
            }

            // Names from the browser are rarely helpful ("camera2 0,
            // facing back"), so say which one by number.
            this._toastService.pop(
                this._i18nService.format('shared.cameraNumber', {
                    count: choices.count,
                    n: choices.index + 1,
                })
            );
            // Close the old camera first; many phones can't open two.
            this._switching = true;
            camera.release();
            camera.request().then(
                () => (this._switching = false),
                () => (this._switching = false)
            );
        });
    }

    private _watch() {
        this._subscription?.unsubscribe();
        this._subscription = this.camera?.resourceChanges.subscribe((stream) => {
            this._stream = stream;

            if (!stream) {
                // Stay put while the camera reopens after a switch, so the
                // button doesn't flicker. Otherwise the camera is off.
                this._setShow(this._switching);

                return;
            }

            this._cameraService
                .choices(this._side(), stream)
                .then((choices) => this._setShow(choices.count > 1));
        });
    }

    private _side(): Facing {
        return this.facing === 'user' ? 'user' : 'environment';
    }
}

component(
    'camera-switch',
    {
        attr: ['facing'],
        prop: ['camera'],
        style: css`
            /* Takes no room in the toolbar while there's nothing to show.
               (It has to be a real box when shown, so the toolbar can
               place it.) */
            :host {
                display: none;
            }

            :host.shown {
                display: block;
            }
        `,
        template: html`
            <icon-button
                *if="show"
                href="/switch-camera.svg"
                label-id="shared.switchCamera"
                @click.stop.prevent="next()"
            ></icon-button>
        `,
    },
    CameraSwitchComponent
);
