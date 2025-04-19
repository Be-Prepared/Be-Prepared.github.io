/**
 * Queued items are stored in maps for faster lookup by index.
 *
 * This works much better when there's a lot of solo blocks, but worse in the
 * normal case.
 */
export class StandardKeyed {
    static name = 'Standard decoder'
    static options = {
        k: 'Number of blocks in file'
    };

    constructor(k) {
        this.k = +k;
        this.blocks = new Set();
        this.queue = new Set();
        this.byIndex = new Map();
    }

    isDecoded() {
        return this.blocks.size === this.k;
    }

    queueSize() {
        return this.queue.size;
    }

    addIndices(indices) {
        const indicesAdded = this.addInternal(this.reduce(indices));

        if (indicesAdded.length) {
            this.reprocess(indicesAdded);
        }
    }

    addInternal(indices) {
        if (indices.size === 1) {
            const index = [...indices][0];

            if (!this.blocks.has(index)) {
                this.blocks.add(index);

                return [index];
            }
        } else if (indices.size > 1) {
            this.addToQueue(indices);
        }

        return [];
    }

    addToQueue(indices) {
        this.queue.add(indices);

        for (const index of indices) {
            const blockSet = this.byIndex.get(index) || this.byIndex.set(index, new Set()).get(index);
            blockSet.add(indices);
        }
    }

    removeFromQueue(indices) {
        this.queue.delete(indices);

        for (const index of indices) {
            const blockSet = this.byIndex.get(index);
            blockSet.remove(indices);
        }
    }

    reprocess(index) {
        const foundIndices = [index];

        while (foundIndices.length) {
            const targetIndex = foundIndices.shift();
            let changed = false;

            do {
                changed = false;

                for (const item of this.byIndex.get(targetIndex) || []) {
                    const reduced = this.reduce(item);

                    if (reduced.size < item.size) {
                        changed += 1;
                        foundIndices.push(...this.addInternal(reduced));
                    }
                }
            } while (changed);
        }
    }

    reduce(indices) {
        let result = false;
        const copy = new Set(indices);

        for (const index of [...indices]) {
            if (this.blocks.has(index)) {
                result = true;
                copy.delete(index);
            }
        }

        return copy;
    }
}
