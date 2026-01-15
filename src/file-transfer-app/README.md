# File Transfer App

The first file transfer code used an ideal Soliton distribution to determine the chunk sizes for the encoded blocks. Its distribution looks like the following.

| Size |   Prob   | Visualization                                      |
|-----:|:--------:|----------------------------------------------------|
|    1 | 0.003115 |                                                    |
|    2 | 0.533541 | ################################################## |
|    3 | 0.177778 | #################                                  |
|    4 | 0.088889 | ########                                           |
|    5 | 0.053333 | #####                                              |
|    6 | 0.035556 | ###                                                |
|    7 | 0.025397 | ##                                                 |
|    8 | 0.019048 | ##                                                 |
|    9 | 0.014815 | #                                                  |
|   10 | 0.011852 | #                                                  |
|   11 | 0.009697 | #                                                  |
|   12 | 0.008081 | #                                                  |
|   13 | 0.006838 | #                                                  |
|   14 | 0.005861 | #                                                  |
|   15 | 0.005079 |                                                    |
|   16 | 0.004444 |                                                    |

Running this algorithm 10,000 times with random numbers produced the following results. Keep in mind that the random numbers do slightly influence the resulting numbers, so these results are ballpark figures.

    Average loops: 654.95
    Standard deviation: 200.68

The transfer rates were improved using a robust Soliton distribution, using c=0.04 and d=0.01.

| Size |   Prob   | Visualization                                      |
|-----:|:--------:|----------------------------------------------------|
|    1 | 0.003312 |                                                    |
|    2 | 0.531567 | ################################################## |
|    3 | 0.177189 | #################                                  |
|    4 | 0.088594 | ########                                           |
|    5 | 0.053157 | #####                                              |
|    6 | 0.035438 | ###                                                |
|    7 | 0.025313 | ##                                                 |
|    8 | 0.018985 | ##                                                 |
|    9 | 0.014766 | #                                                  |
|   10 | 0.011813 | #                                                  |
|   11 | 0.009665 | #                                                  |
|   12 | 0.008054 | #                                                  |
|   13 | 0.006815 | #                                                  |
|   14 | 0.005841 | #                                                  |
|   15 | 0.005063 |                                                    |
|   16 | 0.004430 |                                                    |

    Average loops: 638.95
    Standard deviation: 190.94

That provided a small bit of a boost, but not significantly. Further testing showed that a truncated ideal Soliton distribution (where all probabilities for blocks over 16 are added to the 16-sized block) has significant promise.

| Size |   Prob   | Visualization                                      |
|-----:|:--------:|----------------------------------------------------|
|    1 | 0.003115 |                                                    |
|    2 | 0.500000 | ################################################## |
|    3 | 0.166667 | #################                                  |
|    4 | 0.083333 | ########                                           |
|    5 | 0.050000 | #####                                              |
|    6 | 0.033333 | ###                                                |
|    7 | 0.023810 | ##                                                 |
|    8 | 0.017857 | ##                                                 |
|    9 | 0.013889 | #                                                  |
|   10 | 0.011111 | #                                                  |
|   11 | 0.009091 | #                                                  |
|   12 | 0.007576 | #                                                  |
|   13 | 0.006410 | #                                                  |
|   14 | 0.005495 | #                                                  |
|   15 | 0.004762 |                                                    |
|   16 | 0.063551 | ######                                             |

    Average loops: 590.11
    Standard deviation: 225.32

After that, a generative algorithm was used while some wild guessing and experimentation took place and this produced the best results yet. It's also remarkably simple.

| Size |   Prob   | Visualization                                      |
|-----:|:--------:|----------------------------------------------------|
|    1 | 0.020408 | ##                                                 |
|    2 | 0.653061 | ################################################## |
|    3 | 0.000000 |                                                    |
|    4 | 0.000000 |                                                    |
|    5 | 0.000000 |                                                    |
|    6 | 0.000000 |                                                    |
|    7 | 0.000000 |                                                    |
|    8 | 0.163265 | ############                                       |
|    9 | 0.000000 |                                                    |
|   10 | 0.000000 |                                                    |
|   11 | 0.000000 |                                                    |
|   12 | 0.000000 |                                                    |
|   13 | 0.000000 |                                                    |
|   14 | 0.000000 |                                                    |
|   15 | 0.000000 |                                                    |
|   16 | 0.163266 | ############                                       |

    Average loops: 416.40
    Standard deviation: 54.11

All of these tests were done with 10,000 iterations and 321 blocks. When the number of blocks was increased to 4321, the results were similar but took almost an hour to test each distribution.
