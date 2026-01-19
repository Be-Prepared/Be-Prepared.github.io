The generative approach will simply start with random values and iteratively change them to see if the number of iterations can be reduced. If so, that becomes the next base and random changes are made again. This continues until we run out of time.

The best approach I was able to find manually was to use the following values:

    1 32 0 0 0 0 0 8 0 0 0 0 0 0 0 8

These are the results with 5000 blocks and 500 iterations:

```
Block count: 5000

Arbitrary Probabilities:
Size |  Prob  | Visualization
   1 | 0.020408 | ##
   2 | 0.653061 | ##################################################
   3 | 0.000000 |
   4 | 0.000000 |
   5 | 0.000000 |
   6 | 0.000000 |
   7 | 0.000000 |
   8 | 0.163265 | ############
   9 | 0.000000 |
  10 | 0.000000 |
  11 | 0.000000 |
  12 | 0.000000 |
  13 | 0.000000 |
  14 | 0.000000 |
  15 | 0.000000 |
  16 | 0.163265 | ############

Running 500 iterations...
  Average loops: 8759.92
  Standard deviation: 1262.46
```

Running the single-threaded generative program for 3 days, using 500 blocks and 500 iterations in 5 different terminals produced better results with the best being these values:

    41 127 89 62 0 3 0 0 0 3 0 0 0 7 89 14

These are the results with 5000 blocks (10x the training blocks) and 500 iterations:

```
Block count: 5000

Arbitrary Probabilities:
Size |  Prob  | Visualization
   1 | 0.094470 | ################
   2 | 0.292627 | ##################################################
   3 | 0.205069 | ###################################
   4 | 0.142857 | ########################
   5 | 0.000000 |
   6 | 0.006912 | #
   7 | 0.000000 |
   8 | 0.000000 |
   9 | 0.000000 |
  10 | 0.004608 | #
  11 | 0.000000 |
  12 | 0.000000 |
  13 | 0.000000 |
  14 | 0.016129 | ###
  15 | 0.205069 | ###################################
  16 | 0.032258 | ######

Running 500 iterations...
  Average loops: 7898.01
  Standard deviation: 1105.93
```
