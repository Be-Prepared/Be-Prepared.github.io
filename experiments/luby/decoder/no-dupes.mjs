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
        this.blocks = new Set(); // Isolated indices
        this.queue = new Map(); // The queued indices that can be added after isolation
    }

    isDecoded() {
        return this.blocks.size === this.k;
    }

    queueSize() {
        return this.queue.size;
    }

    addIndices(indices) {
        const reduced = new Set([...indices].filter(index => !this.blocks.has(index)));

        if (reduced.size === 1) {
            const index = [...reduced][0];
            this.reprocess(index);
        } else if (reduced.size > 1) {
            this.queue.set(this.indexKey(reduced), reduced);
        }
    }

    reprocess(index) {
        const solved = [index];
        const values = [...this.queue.values()];

        while (solved.length > 0) {
            const current = solved.pop();
            this.blocks.add(current);

            for (const indices of values) {
                if (indices.has(current)) {
                    indices.delete(current);

                    if (indices.size === 1) {
                        solved.push([...indices][0]);
                    }
                }
            }
        }

        this.queue = new Map();

        for (const item of values) {
            if (item.size > 1) {
                this.queue.set(this.indexKey(item), item);
            }
        }
    }

    indexKey(indices) {
        return [...indices].sort((a, b) => a - b).join(',');
    }
}
