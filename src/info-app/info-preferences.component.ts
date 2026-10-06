import {
    BARCODE_ENGINES,
    BarcodeEngine,
    BarcodeEngineDefault,
} from '../services/barcode-reader/engine-selection';
import { BarcodeReaderService } from '../services/barcode-reader.service';
import { component, css, html } from 'fudgel';
import {
    CoordinateService,
    COORDINATE_SYSTEMS,
    CoordinateSystemDefault,
} from '../services/coordinate.service';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { di } from '../di';
import {
    DistanceService,
    DISTANCE_SYSTEMS,
    DistanceSystemDefault,
} from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import { languagePreference } from '../i18n/i18n.service';
import { LANGUAGES } from '../i18n/languages';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
    TimeService,
    TIME_SYSTEMS,
    TimeSystemDefault,
} from '../services/time.service';
import { TimeSystem } from '../datatypes/time-system';
import { TileService } from '../services/tile.service';
import { ToastService } from '../services/toast.service';

export class InfoPreferencesComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _subject = new Subject();
    private _timeService = di(TimeService);
    private _tileService = di(TileService);
    private _toastService = di(ToastService);
    barcodeEngine: BarcodeEngine = BarcodeEngineDefault;
    barcodeEngines = BARCODE_ENGINES;
    coordinateSystem: CoordinateSystem = CoordinateSystemDefault;
    coordinateSystems = COORDINATE_SYSTEMS;
    distanceSystem: DistanceSystem = DistanceSystemDefault;
    distanceSystems = DISTANCE_SYSTEMS;
    language = languagePreference.getItem() || 'auto';
    languages = ['auto', ...Object.keys(LANGUAGES)];
    timeSystem: TimeSystem = TimeSystemDefault;
    timeSystems = TIME_SYSTEMS;

    onInit() {
        this._barcodeReaderService
            .getPreference()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.barcodeEngine = value;
            });
        this._coordinateService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((coordinateSystem) => {
                this.coordinateSystem = coordinateSystem;
            });
        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.distanceSystem = value;
            });
        this._timeService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.timeSystem = value;
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    changeBarcodeEngine(value: BarcodeEngine) {
        this._barcodeReaderService.setPreference(value);
    }

    changeCoordinateSystem(value: CoordinateSystem) {
        this._coordinateService.setCoordinateSystem(value);
    }

    // Every label is read once when shown, so a reload is the simplest way
    // to switch everything at once.
    changeLanguage(value: string) {
        if (value === 'auto') {
            languagePreference.reset();
        } else {
            languagePreference.setItem(value);
        }

        if (value !== this.language) {
            location.reload();
        }
    }

    changeDistanceSystem(value: DistanceSystem) {
        this._distanceService.setDistanceSystem(value);
    }

    changeTimeSystem(value: TimeSystem) {
        this._timeService.setTimeSystem(value);
    }

    reset() {
        this._coordinateService.reset();
        this._distanceService.reset();
        this._timeService.reset();
        this._barcodeReaderService.setPreference(BarcodeEngineDefault);
        this._tileService.resetOrder();
        this._toastService.popI18n('info.preferences.resetComplete');
    }
}

component('info-preferences', {
    style: css``,
    template: html`
        <info-header id="info.preferences"></info-header>
        <ul>
            <li>
                <i18n-label id="info.language"></i18n-label>
                <pretty-select
                    i18n-base="language"
                    value="{{language}}"
                    .options="languages"
                    @change="changeLanguage($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <i18n-label id="info.coordinates"></i18n-label>
                <pretty-select
                    i18n-base="location.coordinates"
                    value="{{coordinateSystem}}"
                    .options="coordinateSystems"
                    @change="changeCoordinateSystem($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <i18n-label id="info.distances"></i18n-label>
                <pretty-select
                    i18n-base="info.distances"
                    value="{{distanceSystem}}"
                    .options="distanceSystems"
                    @change="changeDistanceSystem($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <i18n-label id="info.timeSystem"></i18n-label>
                <pretty-select
                    i18n-base="info.timeSystem"
                    value="{{timeSystem}}"
                    .options="timeSystems"
                    @change="changeTimeSystem($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <i18n-label id="info.barcodeEngine"></i18n-label>
                <pretty-select
                    i18n-base="barcodeReader.engine"
                    value="{{barcodeEngine}}"
                    .options="barcodeEngines"
                    @change="changeBarcodeEngine($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <changeable-setting @click="reset()"
                    ><i18n-label id="info.preferences.reset"></i18n-label
                ></changeable-setting>
            </li>
        </ul>
    `,
}, InfoPreferencesComponent);
