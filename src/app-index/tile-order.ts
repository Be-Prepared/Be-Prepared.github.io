// Ordering for home screen tiles. Pure functions so they can be tested.

// Puts items in the saved order. Items the saved order doesn't mention
// (new tools, or tools whose hardware just appeared) keep their default
// order after the saved ones; saved ids that no longer exist are ignored.
export function applyOrder<T extends { id: string }>(
    items: T[],
    savedIds: string[] | null
): T[] {
    if (!savedIds || !savedIds.length) {
        return items;
    }

    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: T[] = [];

    for (const id of savedIds) {
        const item = byId.get(id);

        if (item) {
            ordered.push(item);
            byId.delete(id);
        }
    }

    return [...ordered, ...items.filter((item) => byId.has(item.id))];
}

// Moves the item at `from` so it ends up at index `to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= items.length ||
        to >= items.length
    ) {
        return items;
    }

    const result = [...items];
    const [moved] = result.splice(from, 1);
    result.splice(to, 0, moved);

    return result;
}

// After moving within the visible tiles, merge back into the full saved
// order so hidden tools keep their place for when their hardware returns.
export function mergeOrder(
    visibleIds: string[],
    previousIds: string[] | null,
    allIds: string[]
) {
    const visible = new Set(visibleIds);
    const base = applyOrder(
        allIds.map((id) => ({ id })),
        previousIds
    ).map((item) => item.id);
    const queue = [...visibleIds];

    // Visible tiles take the slots visible tiles had before; hidden ones stay.
    return base.map((id) => (visible.has(id) ? (queue.shift() as string) : id));
}

export function isOrderList(value: any): value is string[] {
    return Array.isArray(value) && value.every((id) => typeof id === 'string');
}
