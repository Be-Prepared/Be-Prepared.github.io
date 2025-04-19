/**
 * Avoids duplicate entries in the queue. The extra overhead from iterating
 * over the queue doesn't appear to make this faster, but it can cut down on
 * the number of blocks in memory slightly.
 */
export class NoDupes {
    static name = 'No dupes'
    static options = {
        k: 'Number of blocks in file'
    };

    constructor(k) {
        this.k = +k;
        this.blocks = new Set();
        this.queue = new Set();
    }

    isDecoded() {
        return this.blocks.size === this.k;
    }

    queueSize() {
        return this.queue.size;
    }

    addIndices(indices) {
        this.reduce(indices);

        if (indices.size === 1) {
            this.blocks.add([...indices][0]);
            this.reprocess();
        } else if (indices.size > 1) {
            if (this.isUnique(indices)) {
                this.queue.add(indices);
            }
        }
    }

    isUnique(indices) {
        for (const block in this.queue) {
            if (block.size === indices.size && block.isSubsetOf(indices)) {
                return false;
            }
        }

        return true;
    }

    reprocess() {
        let changed = false;

        do {
            changed = false;

            for (const item of this.queue) {
                if (this.reduce(item)) {
                    changed += 1;

                    if (item.size === 1) {
                        this.blocks.add([...item][0]);
                    }

                    if (item.size < 2) {
                        this.queue.delete(item);
                    }
                }
            }
        } while (changed);
    }

    reduce(indices) {
        let result = false;

        for (const index of [...indices]) {
            if (this.blocks.has(index)) {
                result = true;
                indices.delete(index);
            }
        }

        return result;
    }
}
