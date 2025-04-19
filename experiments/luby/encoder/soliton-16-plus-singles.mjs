/**
 * Random block indices with a somewhat soliton distribution, limited to 16
 * indices per block. There will be at least a 1% chance of getting a
* single-index block instead of 1/k.
 */
export class Soliton16PlusSingles {
    static name = 'Soliton, limited to 16 plus more single index blocks';
    static options = {
        k: 'Number of blocks in file'
    };
    p = [1];

    constructor(k) {
        this.k = +k;
        const p = [Math.max(1/k, 0.01)];
        let remainder = 1 - p[0];

        while (p.length < 15) {
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
