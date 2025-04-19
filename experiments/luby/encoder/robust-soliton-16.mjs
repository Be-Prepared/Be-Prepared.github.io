/**
 * No optimizations. Random block indices with robust soliton distribution, but
 * no more than 16 indices in a block.
 */
export class RobustSoliton16 {
    static name = 'Robust soliton, limited to 16';
    static options = {
        k: 'Number of blocks in file',
        c: 'Constant for distribution shape',
        d: 'Failure probability (between 0 and 1)',
    };
    p = [];

    constructor(k, c, d) {
        c = +c;
        d = +d;
        this.k = +k;

        // Force k/r to be up to 16
        const r = Math.min(this.k / 16, Math.floor((c) * Math.sqrt(this.k) * Math.log(this.k / d)));
        const threshold = Math.floor(this.k / r);
        let total = 0;

        for (let i = 1; i <= 16; i += 1) {
            let tao = r / (this.k * i);

            if (i === threshold) {
                tao = r * Math.log(r / d) / (this.k);
            }

            let rho = 1 / (i * (i - 1));

            if (i === 1) {
                rho = 1 / (this.k);
            }

            const sum = tao + rho;
            this.p.push(sum);
            total += sum;
        }

        // Fix scaling
        let accumulated = 0;
        for (let i = 0; i < this.p.length; i += 1) {
            accumulated += (this.p[i] / total);
            this.p[i] = accumulated;
        }

        // Guarantee no more than 16 and that there's no slim chance due to
        // imprecise math that we'd miss a probability.
        this.p[15] = 1

        if (this.k < 16) {
            this.p[this.k - 1] = 1;
        }
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
