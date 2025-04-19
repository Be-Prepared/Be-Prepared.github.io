/**
 * No optimizations.
 */
export class Standard {
    static name = 'Standard decoder'
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
            const index = [...indices][0];

            if (!this.blocks.has(index)) {
                this.blocks.add(index);
                this.reprocess();
            }
        } else if (indices.size > 1) {
            this.queue.add(indices);
        }
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
