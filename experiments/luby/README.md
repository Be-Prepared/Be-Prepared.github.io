Various tests to see what can be done to improve the encoder and decoder for
the file transfer using Luby transform codes.

Assuming a file that's over a megabyte, we want to be able to decode it in an
efficient manner. The current code will use a modified robust Soliton
distribution maxed at 16 inputs per block and the standard decoder. Simulate
this with the following command.

```
node run.mjs --k=5000 robust-soliton-16 --c=0.04 --d=0.01 standard 1000 --seed=1337
```

Using a fixed seed allows for consistent results between runs as long as the only thing that changes is the decoder and the `--loss` argument is not used.

The most recent run of the above command produced these results:

```
$ node run.mjs --k=5000 robust-soliton-16 --c=0.04 --d=0.01 standard 1000 --seed=1337
Using seed: 1337
Process start: 2026-01-06T23:20:10.030Z
Total runs: 1000
Encoder: robust-soliton-16
Decoder: standard
options: {"k":"5000","c":"0.04","d":"0.01","seed":"1337"}
loss: 0
Run 1000/1000
Block count 	Min: 9423 	Avg: 12780.262 	Max: 21504 	StdDev: 94.623633 	AvgOverhead: 1.556052
Max queue size 	Min: 3558 	Avg: 4136.549 	Max: 5010 	StdDev: 5.23202
Time 	Min: 0.081426 	Avg: 0.354016 	Max: 0.842464 	StdDev: 0.004099
```

Using various techniques to eliminate excess memory caused the program to run
much slower. It's supposed to make the maximum queue size smaller, but it did
not help much in the beginning due to the average incoming block containing 2
indices.

```
$ node run.mjs --k=5000 robust-soliton-16 --c=0.04 --d=0.01 no-dupes 1000 --seed=1337
Using seed: 1337
Process start: 2026-01-06T23:20:15.052Z
Total runs: 1000
Encoder: robust-soliton-16
Decoder: no-dupes
options: {"k":"5000","c":"0.04","d":"0.01","seed":"1337"}
loss: 0
Run 1000/1000
Block count 	Min: 9423 	Avg: 12780.262 	Max: 21504 	StdDev: 94.623633 	AvgOverhead: 1.556052
Max queue size 	Min: 3557 	Avg: 4136.336 	Max: 5010 	StdDev: 5.207133
Time 	Min: 0.397082 	Avg: 0.6975 	Max: 1.956132 	StdDev: 0.006245
```

Adding in additional set slicing code to get blocks faster at the beginning,
with the cost of additional processing time, produced the following results.
This only would improve the user experience in the beginning, not with the
overall transfer of the file.

```
$ node run.mjs --k=5000 robust-soliton-16 --c=0.04 --d=0.01 keyfinding 1000 --seed=1337
Using seed: 1337
Process start: 2026-01-06T23:20:18.639Z
Total runs: 1000
Encoder: robust-soliton-16
Decoder: keyfinding
options: {"k":"5000","c":"0.04","d":"0.01","seed":"1337"}
loss: 0
Run 1000/1000
Block count 	Min: 9423 	Avg: 12780.262 	Max: 21504 	StdDev: 94.623633 	AvgOverhead: 1.556052
Max queue size 	Min: 3557 	Avg: 4136.11 	Max: 5010 	StdDev: 5.21428
Time 	Min: 0.717997 	Avg: 1.15731 	Max: 3.336421 	StdDev: 0.009702
```
