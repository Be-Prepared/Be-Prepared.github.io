/**
 * No more than 16 indices in a block. The first index added to each block is
 * one greater than the first of the block before.
 */
export class Sequential16 {
    static name = 'Sequential first index, limited to 16';
    static options = {
        k: 'Number of blocks in file'
    };

    constructor(k) {
        this.k = +k;
        const p = [1/k];
        let remainder = 1 - 1/k;

        while (p.length < 15) {
            remainder /= 2;
            p.push(p[p.length - 1] + remainder);
        }

        p.push(1);
        this.p = p;
        this.index = -1;
    }

    indices() {
        let d = 1;
        let r = Math.random();
        let i = 0;

        while (r > this.p[i]) {
            i += 1;
        }

        d = i + 1;
        const indices = new Set();
        this.index = (this.index + 1) % this.k;
        indices.add(this.index);

        while (indices.size < d) {
            indices.add(Math.floor(Math.random() * this.k));
        }

        return indices;
    }
}
