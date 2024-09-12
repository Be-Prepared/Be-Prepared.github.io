import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { NavigationTypeService } from './navigation-type.service';
import { Subscription } from 'rxjs';

@Component('navigation-type', {
    style: css``,
    template: html`
        <changeable-setting @click="toggleSetting()"
            ><i18n-label id="location.navigation.{{value}}"></i18n-label
        ></changeable-setting>
    `,
})
export class NavigationTypeComponent {
    private _navigationTypeService = di(NavigationTypeService);
    private _subscription?: Subscription;
    value = 'unknownValue';

    onInit() {
        this._subscription = this._navigationTypeService
            .getObservable()
            .subscribe((value) => {
                this.value = value;
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleSetting() {
        this._navigationTypeService.toggleSetting();
    }
}
