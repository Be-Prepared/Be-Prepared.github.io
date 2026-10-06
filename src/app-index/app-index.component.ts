import { Controller, component, css, html, metadata } from 'fudgel';
import { di } from '../di';
import { moveItem } from './tile-order';
import { Subscription } from 'rxjs';
import { TileDefResolved, TileService } from '../services/tile.service';
import { TileDrag } from './tile-drag';

export class AppIndex {
    private _drag: TileDrag | null = null;
    private _subscription?: Subscription;
    private _tileService = di(TileService);
    grid?: HTMLElement;
    tiles?: TileDefResolved[];

    constructor() {
        this._subscription = this._tileService
            .getAvailableTiles()
            .subscribe((tiles) => (this.tiles = tiles));
    }

    onViewInit() {
        const host = (this as Controller)[metadata]?.host;

        if (this.grid && host) {
            // Long-press a tile and drag it to rearrange the home screen.
            this._drag = new TileDrag({
                container: this.grid,
                itemSelector: 'app-index-tile',
                scroller: host,
                onDrop: (from, to) => this._move(from, to),
            });
        }
    }

    onDestroy() {
        this._drag?.destroy();

        if (this._subscription) {
            this._subscription.unsubscribe();
        }
    }

    private _move(from: number, to: number) {
        if (!this.tiles) {
            return;
        }

        const ids = this.tiles.map((tile) => tile.id);
        this._tileService.setVisibleOrder(moveItem(ids, from, to));
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
                <browser-notice></browser-notice>
                <div class="grid" #ref="grid">
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
