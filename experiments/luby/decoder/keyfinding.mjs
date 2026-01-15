/**
 * Whenever receiving a new block with multiple indices, see if all indices
 * except one could be XORed out and provide another key block.
 *
 * The processing also eliminates duplicates from the queue.
 */
export class Keyfinding {
    static name = 'Keyfinding'
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
            this.divideAndConquer(reduced);
        }
    }

    reprocess(index) {
        const solved = [index];
        const values = [...this.queue.values()].sort((a, b) => a.size - b.size);

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

    divideAndConquer(reduced) {
        const incoming = [reduced];
        const incomingKeys = new Set([this.indexKey(reduced)]);

        while (incoming.length > 0) {
            const current = incoming.pop();
            let madeSubset = false;

            for (const existing of this.queue.values()) {
                if (existing.size < current.size && existing.isSubsetOf(current)) {
                    const subset = new Set(current);

                    for (const index of existing) {
                        current.delete(index);
                    }

                    const key = this.indexKey(subset);

                    if (!incomingKeys.has(key)) {
                        incomingKeys.add(key);
                        incoming.push(subset);
                        madeSubset = true;
                    }
                }

                if (existing.size > current.size && current.isSubsetOf(existing)) {
                    const subset = new Set(existing);

                    for (const index of current) {
                        existing.delete(index);
                    }

                    const key = this.indexKey(subset);

                    if (!incomingKeys.has(key)) {
                        incomingKeys.add(key);
                        incoming.push(subset);
                        madeSubset = true;
                    }
                }
            }

            if (!madeSubset) {
                this.queue.set(this.indexKey(current), current);
            }
        }
    }

    indexKey(indices) {
        return [...indices].sort((a, b) => a - b).join(',');
    }
}
