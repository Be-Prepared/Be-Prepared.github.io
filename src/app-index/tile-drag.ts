// Long-press and drag to rearrange home screen tiles.
//
// * A press has to stay still for LONG_PRESS_MS before dragging starts, so
//   normal taps open tools and swipes still scroll the page.
// * While dragging, a floating copy follows the finger and the tile itself
//   stays in the grid as an empty placeholder, so the tiles after it don't
//   all slide forward a slot when it's picked up.
// * The placeholder moves to whichever tile the finger is over, and the
//   tiles in between slide over to make room. Dropping puts the tile where
//   the placeholder is.
// * Tiles are shifted with the CSS "order" property, not by moving them in
//   the page, so the list the framework renders is untouched until the drop.

const LONG_PRESS_MS = 450;
// Moving more than this before the long press completes means scrolling.
const MOVE_TOLERANCE_PX = 10;
// Distance from the top or bottom edge that scrolls the page while dragging.
const EDGE_SCROLL_PX = 48;
const EDGE_SCROLL_STEP = 10;
// How long tiles take to slide out of the way.
const SLIDE_MS = 160;

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
    // Every tile, in the order the page has them.
    items: HTMLElement[];
    offsetX: number;
    offsetY: number;
    pointerId: number;
    // Where the placeholder is now.
    slot: number;
    // Each grid position, in the scroller's own coordinates.
    slots: { bottom: number; left: number; right: number; top: number }[];
    // Where the finger was last.
    x: number;
    y: number;
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
        drag.x = event.clientX;
        drag.y = event.clientY;
        this._follow(drag);
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

        // Tiles go back to their real places first; the new order then
        // arrives from onDrop before the screen is drawn again.
        this._endDrag();
        this._suppressClickUntil = Date.now() + 400;

        if (drag.slot !== drag.from) {
            this._options.onDrop(drag.from, drag.slot);
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
        } else {
            return;
        }

        // A different slot is under the finger now.
        if (this._drag) {
            this._follow(this._drag);
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

        for (const item of drag.items) {
            item.style.order = '';
            item.style.transition = '';
            item.style.transform = '';
        }
    }

    private _endPress() {
        if (this._press) {
            clearTimeout(this._press.timer);
            this._press = null;
        }
    }

    // Puts the placeholder in the slot under the finger. Slots are the grid
    // positions measured when the drag began; they don't change as tiles
    // trade places, so tiles that are still sliding can't confuse this.
    private _follow(drag: Drag) {
        const y = drag.y + this._options.scroller.scrollTop;
        const slot = drag.slots.findIndex(
            (r) => drag.x >= r.left && drag.x < r.right && y >= r.top && y < r.bottom
        );

        if (slot >= 0) {
            this._moveSlot(drag, slot);
        }
    }

    // Moves the placeholder to a slot. The tiles between its old and new
    // slots each shift one place, sliding from where they were.
    private _moveSlot(drag: Drag, slot: number) {
        if (slot === drag.slot) {
            return;
        }

        const others = drag.items.filter((item) => item !== drag.item);
        const before = others.map((item) => item.getBoundingClientRect());
        drag.slot = slot;
        this._applyOrder(drag);

        others.forEach((item, i) => {
            const after = item.getBoundingClientRect();
            const dx = before[i].left - after.left;
            const dy = before[i].top - after.top;

            if (!dx && !dy) {
                return;
            }

            // Start where it was, then let go.
            item.style.transition = 'none';
            item.style.transform = `translate(${dx}px, ${dy}px)`;
            item.getBoundingClientRect();
            item.style.transition = `transform ${SLIDE_MS}ms ease`;
            item.style.transform = '';
        });
    }

    private _applyOrder(drag: Drag) {
        const order = drag.items.filter((item) => item !== drag.item);
        order.splice(drag.slot, 0, drag.item);
        order.forEach((item, i) => (item.style.order = `${i}`));
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
        const items = this._items();
        const from = items.indexOf(item);
        this._drag = {
            from,
            ghost,
            item,
            items,
            offsetX: press.x - rect.left,
            offsetY: press.y - rect.top,
            pointerId: press.pointerId,
            slot: from,
            slots: items.map((other) => {
                const r = other.getBoundingClientRect();
                const scrolled = this._options.scroller.scrollTop;

                return {
                    bottom: r.bottom + scrolled,
                    left: r.left,
                    right: r.right,
                    top: r.top + scrolled,
                };
            }),
            x: press.x,
            y: press.y,
        };
        this._applyOrder(this._drag);

        try {
            navigator.vibrate?.(15);
        } catch (_ignore) {}
    }
}
