import { Component, css, di, html } from 'fudgel';
import { NavigationTypeService } from './navigation-type.service';
import { Subscription } from 'rxjs';

@Component('navigation-type', {
    style: css`
    `,
    template: html`
    <changeable-setting @click="toggleSetting()"><i18n-label id="location.navigation.{{value}}"></i18n-label></changeable-setting>
    `,
})
export class NavigationTypeComponent {
    #navigationTypeService = di(NavigationTypeService);
    #subscription?: Subscription;
    value = 'unknownValue';

    onInit() {
        this.#subscription = this.#navigationTypeService.getObservable().subscribe((value) => {
            this.value = value;
        });
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }

    toggleSetting() {
        this.#navigationTypeService.toggleSetting();
    }
}
