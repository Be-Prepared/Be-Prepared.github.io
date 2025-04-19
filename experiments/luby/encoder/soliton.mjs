/**
 * No optimizations. Random block indices with soliton distribution.
 */
export class Soliton {
    static name = 'Soliton, actual';
    static options = {
        k: 'Number of blocks in file'
    };
    p = [1];

    constructor(k) {
        this.k = +k;
        const p = [1/k];
        let remainder = 1 - p[0];

        while (p.length < k - 1) {
            remainder /= 2;
            p.push(p[p.length - 1] + remainder);
        }

        p.push(1);
        this.p = p;
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

        while (indices.size < d) {
            indices.add(Math.floor(Math.random() * this.k));
        }

        return indices;
    }
}
