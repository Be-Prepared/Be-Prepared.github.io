# Averaging a Stationary GPS Position

The Location tool's "Average" screen collects browser geolocation fixes (about one per second, often for an hour or more) and reports an averaged position and a radius that should hold the true spot 95% of the time. This experiment asks two questions:

1. **Point estimate:** which way of combining fixes lands closest to the truth?
2. **Honesty of the radius:** does the "95%" radius hold the truth about 95% of the time (its *coverage*)? 60% means the app is overconfident. 100% with a huge radius means it's useless.

A web app only gets the W3C Geolocation API: latitude, longitude, accuracy, timestamp. No raw GNSS measurements, satellite counts, or carrier phase, so precise point positioning and the like are out of reach. Everything here works only with those fixes.

## Running

```bash
node --import tsx experiments/averaging/run.mjs --runs=500 --seed=1     # the tables below (~7 min)
node experiments/averaging/tune.mjs --runs=200 --seed=2 --unbias=1       # how the constants were picked
```

`run.mjs` takes `--cases=open60,urban10` and `--estimators=current,app`. `app` loads the TypeScript in `src/location-app/location-average-math.ts` through `tsx`, so the tables test the shipped code and not a copy. `results.txt` is the full output of the first command. Everything is seeded and reproducible.

## The simulated fixes (`sim.mjs`)

Each run draws a fresh "device and place" and produces one fix per second in a local east/north frame, with the truth at (0, 0). Per axis, the error is the sum of:

| Part | Open sky | Urban canyon / trees | Why |
|---|---|---|---|
| Slow error (Gauss-Markov) | σ 0.3–1.2 m, τ 20–180 min | σ 1–3 m, τ 20–180 min | Ionosphere (broadcast Klobuchar model removes only about half), troposphere, orbit and clock residuals: hours |
| Medium error (Gauss-Markov) | σ 1–2.5 m, τ 2–15 min | σ 2–5 m, τ 2–15 min | Multipath and geometry. For a still antenna, multipath oscillates with period λ / (2 h cos(e) de/dt): about 10 min for a reflector 1 m away, longer for higher satellites or closer reflectors |
| Fast error (Gauss-Markov) | σ 0.3–1 m, τ 3–20 s | σ 0.5–2 m, τ 3–20 s | The receiver's navigation filter |
| White noise | 0.2 m | 0.4 m | |
| Convergence | 3–20 m, decaying over 5–30 s | 10–50 m, over 10–60 s | Worse first minute |
| Multipath / NLOS jumps | 1 per hour, 8–25 m, 3–30 s | 1 per 4 min, 10–60 m, 5–90 s | Ramped in and out over 3 s |
| Dropouts | 1 per 15 min, 5–60 s | 1 per 5 min, 5–120 s | |

Reported accuracy (a 68% radius, as Android defines it) is only loosely tied to the truth: the honest value times a per-device calibration factor (log-normal, σ = 0.4 open / 0.5 urban, so commonly 0.6–1.6×), a slow ±20% wobble, a bump during convergence, rounded to whole meters. During a jump the accuracy rises only half the time.

Two sensitivity variants deliberately leave this family: **fast-changing errors** (multipath τ 0.5–3 min, almost no slow error) and **slow multipath** (τ 10–45 min).

## Estimators

| Name | Center | 95% radius |
|---|---|---|
| `current` | Inverse-variance weighted mean (weights from reported accuracy) | Model with an assumed 10 min correlation time, floored by the observed scatter (the code before this change) |
| `mean`, `median`, `weighted` | Plain mean, coordinate-wise median, inverse-variance mean | Textbook standard error assuming independent fixes |
| `meanBatch` | Plain mean | Batch means over 10 equal time slices, F quantile for the few degrees of freedom |
| `meanSokal` | Plain mean | Integrated autocorrelation time from the data (Sokal's automatic window, c = 5) |
| `huberBatch`, `tukeyBatch`, `huberAccBatch` | First minute dropped, accuracy gate, then Huber / Tukey biweight IRLS (`huberAcc` also weights by reported accuracy) | Batch means |
| **`app`** (new) | Accuracy gate (drop fixes reporting > 3× the median accuracy), then 2D Huber M-estimate (k = 2σ, scale from the median distance) | Model: per-fix variance s² times the share g = 0.05 + 0.95 / n_eff the session has in common, n_eff = 1 + span / 20 min; s² is the larger of the median reported accuracy and the robust scatter ÷ (1 − g) |

The "÷ (1 − g)" corrects a bias the old code had: scatter measured around the session's own average can't see the part of the error that all fixes share, so in a short session it badly understates the per-fix error.

The constants (20 min, 0.05) were picked by `tune.mjs` on seed 2 by making the worst coverage across the six main cases closest to 95%. The tuning still dropped the first minute; the app doesn't (see the ablation below, which moves coverage by at most 0.6 points). The tables below use seed 1.

## Results (500 runs per case, seed 1)

Error is the true horizontal distance from the estimate to the truth. Coverage is the fraction of runs where that distance was within the reported 95% radius. With 500 runs, coverage is good to about ±1 percentage point.

### Main cases

| Case | Estimator | Median error | 95th pct error | Coverage | Median radius |
|---|---|---:|---:|---:|---:|
| Open sky, 10 min | current | 1.94 m | 4.46 m | 85.0% | 3.52 m |
| | weighted (independent) | 1.94 m | 4.46 m | 1.4% | 0.20 m |
| | meanBatch | 1.93 m | 4.42 m | 22.6% | 1.05 m |
| | meanSokal | 1.93 m | 4.42 m | 21.4% | 1.00 m |
| | huberBatch | 1.93 m | 4.37 m | 12.0% | 0.75 m |
| | **app** | **1.90 m** | **4.29 m** | **96.4%** | **5.36 m** |
| Open sky, 60 min | current | 1.32 m | 3.10 m | 75.2% | 2.00 m |
| | weighted (independent) | 1.32 m | 3.10 m | 0.4% | 0.08 m |
| | meanBatch | 1.33 m | 3.05 m | 39.8% | 1.13 m |
| | meanSokal | 1.33 m | 3.05 m | 38.0% | 1.10 m |
| | huberBatch | 1.36 m | 3.06 m | 35.4% | 1.05 m |
| | **app** | **1.35 m** | **3.06 m** | **94.4%** | **3.18 m** |
| Open sky, 2 h | current | 1.02 m | 2.35 m | 75.4% | 1.49 m |
| | meanBatch | 1.00 m | 2.37 m | 54.6% | 1.13 m |
| | meanSokal | 1.00 m | 2.37 m | 52.0% | 1.05 m |
| | **app** | **1.01 m** | **2.37 m** | **95.8%** | **2.46 m** |
| Urban, 10 min | current | 5.15 m | 11.82 m | 94.0% | 12.67 m |
| | mean (unweighted) | 6.01 m | 12.80 m | 2.0% | 1.06 m |
| | median | 4.20 m | 9.37 m | 8.4% | 1.38 m |
| | meanBatch | 6.01 m | 12.80 m | 57.0% | 7.00 m |
| | huberBatch | 4.18 m | 9.58 m | 17.4% | 2.17 m |
| | **app** | **4.21 m** | **9.45 m** | **97.8%** | **12.34 m** |
| Urban, 60 min | current | 3.18 m | 7.32 m | 96.6% | 8.23 m |
| | meanBatch | 3.25 m | 7.36 m | 66.6% | 4.37 m |
| | huberBatch | 2.85 m | 6.53 m | 39.4% | 2.33 m |
| | **app** | **2.84 m** | **6.49 m** | **95.0%** | **6.99 m** |
| Urban, 2 h | current | 2.57 m | 5.66 m | 95.2% | 6.07 m |
| | meanBatch | 2.54 m | 5.87 m | 68.0% | 3.47 m |
| | huberBatch | 2.32 m | 5.35 m | 49.0% | 2.25 m |
| | **app** | **2.33 m** | **5.37 m** | **95.4%** | **5.59 m** |

### Sensitivity: error models outside the tuning family (60 min)

| Case | Estimator | Median error | Coverage | Median radius |
|---|---|---:|---:|---:|
| Fast-changing errors | current | 0.52 m | 99.6% | 1.97 m |
| | meanBatch | 0.54 m | 85.6% | 0.91 m |
| | **app** | **0.53 m** | **100.0%** | **3.20 m** |
| Slow multipath (τ 10–45 min) | current | 1.66 m | 58.8% | 1.81 m |
| | meanBatch | 1.62 m | 22.8% | 0.95 m |
| | **app** | **1.61 m** | **81.2%** | **2.61 m** |

### What each part of the new method contributes

Coverage (and median error where it changes):

| Variant | Open 10 min | Open 60 min | Open 2 h | Urban 10 min | Urban 60 min | Urban 2 h |
|---|---:|---:|---:|---:|---:|---:|
| **app** | 96.4% | 94.4% | 95.8% | 97.8% (4.21 m) | 95.0% (2.84 m) | 95.4% |
| no accuracy gate | 96.4% | 94.4% | 96.0% | 98.8% (4.44 m) | 95.2% (2.84 m) | 95.4% |
| Tukey biweight instead of Huber | 96.4% | 94.0% | 95.6% | 96.8% (4.04 m) | 94.8% (2.80 m) | 95.4% |
| no scatter ÷ (1 − g) correction | 90.4% | 91.6% | 94.4% | 91.0% | 91.8% | 92.8% |
| no bias share (0 instead of 0.05) | 96.0% | 91.6% | 91.8% | 97.4% | 93.2% | 89.6% |
| 10 min correlation (as before) | 90.4% | 85.6% | 88.8% | 93.0% | 86.2% | 86.4% |
| 30 min correlation | 98.6% | 97.0% | 97.6% | 99.0% | 97.8% | 97.8% |
| also drop the first minute | 96.0% | 94.2% | 95.8% | 97.6% (4.18 m) | 95.2% (2.85 m) | 94.8% |
| also floor with batch means | identical in every case | | | | | |

## Conclusions

* **The old point estimate was fine in open sky but not "best in class" with multipath.** In open sky every estimator lands within a few centimeters of the others: the error is dominated by slow, shared errors that no way of combining fixes can remove. With multipath jumps, the Huber M-estimate is 9–18% closer than the weighted mean (urban 10 min 5.15 → 4.21 m, 60 min 3.18 → 2.84 m, 2 h 2.57 → 2.33 m; 95th percentile 11.8 → 9.5 m at 10 min). The coordinate-wise median does about as well on error but has no good error estimate; Tukey's biweight is 1–4% better again in urban areas and equal or slightly worse in open sky, so the convex, always-unique Huber estimate was kept.
* **Weighting by reported accuracy doesn't help.** `huberAccBatch` vs. `huberBatch` differs by noise. Reported accuracy is a loose guide and most of the error is shared over minutes, so weighting can't remove it. Using accuracy to *drop* fixes that are far worse than usual does help (urban 10 min: 4.44 → 4.21 m).
* **The old 95% radius was overconfident in open sky:** it held the truth only 75% of the time at 60 min and 2 h, 85% at 10 min, and 59% with slow multipath. The 10 min correlation time was too short. The new radius covers 94–98% across all six main cases, so it is bigger in open sky (60 min: 2.0 → 3.2 m) and slightly smaller in urban areas (60 min: 8.2 → 7.0 m), where the old one was conservative.
* **Estimating the effective sample size from the data alone (batch means, autocorrelation time) is not usable here.** In the six main cases it covered only 21–68%. Reliable autocorrelation estimates need a series of at least about 50 correlation times (emcee's guideline), which is many hours when multipath has a time constant of minutes. The slowest errors are invisible within a session anyway. As a floor on the model it never once raised the radius, so the app doesn't use it.
* **Dropping the first minute made no difference** once the Huber estimate and accuracy gate are in place, so the app doesn't do it.
* **Averaging levels off.** With 5% of the variance assumed fixed for the session, the radius approaches about 0.22 times the single-fix 95% radius (roughly 0.35× the reported accuracy) and stops there, matching the plateau seen in long static smartphone sessions.

## Limitations

* **The numbers are only as good as the error model.** No real phone logs were used. The model is built from the literature (time scales and sizes of each error source), but the constants were tuned on it, so the 94–98% coverage is guaranteed only for errors like these. Under the "slow multipath" variant the new radius covers 81% (the old one 59%). A field test is the next step: put a phone on a surveyed benchmark (for example a NGS control mark), average for 10 min, 1 h, and 2 h on several days and with several phones, and count how often the mark is inside the radius.
* **The calibration of reported accuracy varies by phone and browser.** Apple doesn't state a confidence level for iOS; Android documents 68%. The method takes the larger of the accuracy and the scatter-based estimate, so an understated accuracy is caught, but an overstated one makes the radius too big.
* **Horizontal only.** Altitude isn't averaged.
* **A phone moved during the session breaks everything.** The robust estimate limits the damage from a brief bump, but a phone that moves halfway through will report a point between the two spots.

## Sources

* Android `Location.getAccuracy()`: the horizontal accuracy is a 68% radius. [Android developer reference](https://developer.android.com/reference/android/location/Location#getAccuracy()), mirrored at [Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/android.locations.location.accuracy?view=net-android-35.0).
* Time-correlated GNSS position errors modeled as Gauss-Markov plus white noise: [PX4 issue on scaling GNSS noise by correlation time](https://github.com/PX4/PX4-Autopilot/issues/28837); [GNSS Multipath Error Modeling for Automotive Applications (IIT NavLab)](http://www.navlab.iit.edu/uploads/5/9/7/3/59735535/gnss_2018_multipath_paper_v32.pdf).
* Multipath frequency 2h/λ for a static antenna: [Larson, GPS interferometric reflectometry overview, WIREs Water 2016](https://www.unavco.org/data/gps-gnss/derived-products/pbo-h2o/publications/overview/Larson_2016-WIRES_Water.pdf); sidereal repeat: [Navipedia: Multipath](https://gssc.esa.int/navipedia/index.php/Multipath).
* Broadcast ionosphere model removes only about 50% of the delay: [Improvement of Klobuchar model for GNSS single-frequency ionospheric delay corrections](https://www.researchgate.net/publication/291391284_Improvement_of_Klobuchar_model_for_GNSS_single-frequency_ionospheric_delay_corrections).
* Robust M-estimation (Huber, Tukey) with IRLS and a MAD scale for GNSS: [Medina et al., On Robust Statistics for GNSS Single Point Positioning (DLR)](https://elib.dlr.de/128082/1/ITSC19_Medina.pdf); [Chang, Huber's M-estimation in relative GPS positioning](https://www.cs.mcgill.ca/~chang/pub/gpsrobust.pdf).
* Batch means for the variance of a mean of correlated data: [Flegal & Jones, Annals of Statistics 2010](https://projecteuclid.org/journals/annals-of-statistics/volume-38/issue-2/Batch-means-and-spectral-variance-estimators-in-Markov-chain-Monte/10.1214/09-AOS735.full). Integrated autocorrelation time with Sokal's window, and needing about 50 τ of data: [emcee autocorrelation tutorial](https://emcee.readthedocs.io/en/stable/tutorials/autocorr/).
* Smartphone static positioning: [forest canopy study, Sensors 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8838512/) (several-meter DRMS for 10 min, longer averaging helps); [Samsung Galaxy stationary 24 h sessions, PLOS ONE 2019](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0215562) (meter-level DRMS that changes by up to 142% between sessions, which is the slow error at work).
