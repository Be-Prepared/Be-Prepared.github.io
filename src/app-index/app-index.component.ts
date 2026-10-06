import { component, css, html } from 'fudgel';
import { di } from '../di';
import { Subscription } from 'rxjs';
import { TileDefResolved, TileService } from '../services/tile.service';

export class AppIndex {
    private _subscription?: Subscription;
    private _tileService = di(TileService);
    tiles?: TileDefResolved[];

    constructor() {
        this._subscription = this._tileService
            .getAvailableTiles()
            .subscribe((tiles) => (this.tiles = tiles));
    }

    onDestroy() {
        if (this._subscription) {
            this._subscription.unsubscribe();
        }
    }
}

component(
    'app-index',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                overflow: auto;
                box-sizing: border-box;
                padding: env(safe-area-inset-top) env(safe-area-inset-right)
                    env(safe-area-inset-bottom) env(safe-area-inset-left);
            }

            .page {
                max-width: 60rem;
                margin: 0 auto;
                padding: var(--space-4);
            }

            header {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-2) var(--space-1) var(--space-4);
            }

            .logo {
                width: 2.25rem;
                height: 2.25rem;
                color: var(--accent);
            }

            h1 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 800;
                letter-spacing: -0.01em;
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(
                    auto-fill,
                    minmax(min(6.75rem, 30%), 1fr)
                );
                gap: var(--space-3);
            }
        `,
        template: html`
            <div class="page">
                <header>
                    <load-svg class="logo" href="/toolbox.svg"></load-svg>
                    <h1><i18n-label id="app.title" ws=""></i18n-label></h1>
                </header>
                <div class="grid">
                    <app-index-tile
                        *for="tile of tiles"
                        id="{{tile.id}}"
                        icon="{{tile.icon}}"
                        label="{{tile.label}}"
                    ></app-index-tile>
                </div>
            </div>
        `,
    },
    AppIndex
);
