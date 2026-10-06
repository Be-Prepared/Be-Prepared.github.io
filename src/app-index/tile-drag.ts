// Long-press and drag to rearrange home screen tiles.
//
// * A press has to stay still for LONG_PRESS_MS before dragging starts, so
//   normal taps open tools and swipes still scroll the page.
// * While dragging, the tile's original spot stays in the grid as a
//   placeholder and a floating copy follows the finger. Nothing else moves
//   until the tile is dropped, so the grid doesn't jiggle mid-drag.
// * The tile under the finger is marked as the drop target. Dropping moves
//   the dragged tile to that spot.

const LONG_PRESS_MS = 450;
// Moving more than this before the long press completes means scrolling.
const MOVE_TOLERANCE_PX = 10;
// Distance from the top or bottom edge that scrolls the page while dragging.
const EDGE_SCROLL_PX = 48;
const EDGE_SCROLL_STEP = 10;

export interface TileDragOptions {
    // Element containing the tiles.
    container: HTMLElement;
    // Matches one tile.
    itemSelector: string;
    // Element that scrolls, for scrolling while dragging near an edge.
    scroller: HTMLElement;
    // Called with indices into the tile list when a tile is dropped.
    onDrop: (from: number, to: number) => void;
}

interface Press {
    item: HTMLElement;
    pointerId: number;
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
}

interface Drag {
    from: number;
    ghost: HTMLElement;
    item: HTMLElement;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    target: HTMLElement | null;
}

export class TileDrag {
    private _drag: Drag | null = null;
    private _options: TileDragOptions;
    private _press: Press | null = null;
    private _suppressClickUntil = 0;
    private _listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][];

    constructor(options: TileDragOptions) {
        this._options = options;
        const { container } = options;
        this._listeners = [
            [container, 'pointerdown', (e) => this._pointerDown(e as PointerEvent)],
            [window, 'pointermove', (e) => this._pointerMove(e as PointerEvent)],
            [window, 'pointerup', (e) => this._pointerUp(e as PointerEvent)],
            [window, 'pointercancel', (e) => this._cancel(e as PointerEvent)],
            // Stops the page from scrolling under the finger mid-drag. Must
            // not be passive, or preventDefault is ignored.
            [container, 'touchmove', (e) => this._touchMove(e), { passive: false }],
            [container, 'contextmenu', (e) => this._contextMenu(e)],
            // A drop ends with a click on whatever is under the finger; it
            // must not open that tool.
            [container, 'click', (e) => this._click(e), { capture: true }],
        ];

        for (const [target, type, listener, opts] of this._listeners) {
            target.addEventListener(type, listener, opts);
        }
    }

    get dragging() {
        return !!this._drag;
    }

    destroy() {
        this._endPress();
        this._endDrag();

        for (const [target, type, listener, opts] of this._listeners) {
            target.removeEventListener(type, listener, opts);
        }
    }

    private _click(event: Event) {
        if (Date.now() < this._suppressClickUntil) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    private _contextMenu(event: Event) {
        // Long presses would otherwise open the browser's menu.
        if (this._press || this._drag) {
            event.preventDefault();
        }
    }

    private _items() {
        return Array.from(
            this._options.container.querySelectorAll<HTMLElement>(
                this._options.itemSelector
            )
        );
    }

    private _itemAt(x: number, y: number) {
        const element = document.elementFromPoint(x, y);
        const item = element?.closest<HTMLElement>(this._options.itemSelector);

        return item && this._options.container.contains(item) ? item : null;
    }

    private _pointerDown(event: PointerEvent) {
        if (this._press || this._drag || event.button > 0) {
            return;
        }

        const item = (event.target as HTMLElement).closest<HTMLElement>(
            this._options.itemSelector
        );

        if (!item) {
            return;
        }

        this._press = {
            item,
            pointerId: event.pointerId,
            timer: setTimeout(() => this._startDrag(), LONG_PRESS_MS),
            x: event.clientX,
            y: event.clientY,
        };
    }

    private _pointerMove(event: PointerEvent) {
        const press = this._press;

        if (press && press.pointerId === event.pointerId) {
            const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);

            if (moved > MOVE_TOLERANCE_PX) {
                // The person is scrolling, not pressing.
                this._endPress();
            } else {
                press.x = event.clientX;
                press.y = event.clientY;
            }

            return;
        }

        const drag = this._drag;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        drag.ghost.style.transform = `translate(${event.clientX - drag.offsetX}px, ${
            event.clientY - drag.offsetY
        }px) scale(1.06)`;
        this._setTarget(this._itemAt(event.clientX, event.clientY));
        this._edgeScroll(event.clientY);
    }

    private _pointerUp(event: PointerEvent) {
        if (this._press && this._press.pointerId === event.pointerId) {
            // A tap or a short press: let the click open the tool.
            this._endPress();

            return;
        }

        const drag = this._drag;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        const items = this._items();
        const target = drag.target;
        this._endDrag();
        this._suppressClickUntil = Date.now() + 400;

        if (target && target !== drag.item) {
            this._options.onDrop(drag.from, items.indexOf(target));
        }
    }

    private _cancel(event: PointerEvent) {
        if (this._press && this._press.pointerId === event.pointerId) {
            this._endPress();
        }

        if (this._drag && this._drag.pointerId === event.pointerId) {
            this._endDrag();
        }
    }

    private _touchMove(event: Event) {
        if (this._drag) {
            event.preventDefault();
        }
    }

    private _edgeScroll(y: number) {
        const rect = this._options.scroller.getBoundingClientRect();

        if (y < rect.top + EDGE_SCROLL_PX) {
            this._options.scroller.scrollBy(0, -EDGE_SCROLL_STEP);
        } else if (y > rect.bottom - EDGE_SCROLL_PX) {
            this._options.scroller.scrollBy(0, EDGE_SCROLL_STEP);
        }
    }

    private _endDrag() {
        const drag = this._drag;
        this._drag = null;

        if (!drag) {
            return;
        }

        drag.ghost.remove();
        drag.item.classList.remove('placeholder');
        this._setTarget(null, drag);
    }

    private _endPress() {
        if (this._press) {
            clearTimeout(this._press.timer);
            this._press = null;
        }
    }

    private _setTarget(target: HTMLElement | null, drag = this._drag) {
        if (!drag) {
            return;
        }

        const next = target === drag.item ? null : target;

        if (next === drag.target) {
            return;
        }

        drag.target?.classList.remove('drop-target');
        next?.classList.add('drop-target');
        drag.target = next;
    }

    private _startDrag() {
        const press = this._press;
        this._press = null;

        if (!press || !press.item.isConnected) {
            return;
        }

        const { item } = press;
        const rect = item.getBoundingClientRect();
        // Copy the tile before marking it, so the copy looks normal.
        const ghost = item.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('id');
        ghost.classList.add('drag-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        Object.assign(ghost.style, {
            height: `${rect.height}px`,
            left: '0',
            pointerEvents: 'none',
            position: 'fixed',
            top: '0',
            transform: `translate(${rect.left}px, ${rect.top}px) scale(1.06)`,
            width: `${rect.width}px`,
            zIndex: '100',
        });
        document.body.appendChild(ghost);
        // The tile stays where it was, as a placeholder holding its spot.
        item.classList.add('placeholder');
        this._drag = {
            from: this._items().indexOf(item),
            ghost,
            item,
            offsetX: press.x - rect.left,
            offsetY: press.y - rect.top,
            pointerId: press.pointerId,
            target: null,
        };

        try {
            navigator.vibrate?.(15);
        } catch (_ignore) {}
    }
}
