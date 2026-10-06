# Optical File Transfer: Where the Time Goes

These experiments look at the whole chain for sending a file with a stream of QR codes, not just the degree distribution:

1. **Coding:** how many frames must be shown before the receiver can rebuild the file (`sim.mjs`, `robust.mjs`, and `app-decoder.mjs` for the app's own decoder).
2. **Framing:** how many file bytes fit in one QR code (`capacity.mjs`).
3. **Optics:** which QR sizes a camera can actually read, and how long decoding takes (`optical.mjs`).

Transfer time ≈ (file size ÷ bytes per frame) × (frames needed ÷ frames decoded) ÷ frames per second. Each experiment attacks one factor.

## Running

```bash
cd experiments/transfer
node sim.mjs --k=1000 --runs=40                # coding strategies vs. loss
node sim.mjs --k=5000 --runs=12                # slower; closer to a 1.5 MB file
node robust.mjs --k=1000 --runs=200            # heavy loss, late starts, bursts
node robust.mjs --k=5000 --runs=40 --strategies=app,seeded,mixed
node robust.mjs --k=10000 --runs=200 --channels=iid:0.95 --densities=0.2,0.35,0.5
node --import tsx app-decoder.mjs --k=1000,5000 --runs=10   # the app's decoder, real data
node capacity.mjs --fps=10 --file=1048576      # bytes per frame and time per MB
node optical.mjs --runs=12                     # QR decode rates under blur
node --test lib/                               # decoder correctness tests
```

All runs are seeded and reproducible. Raw output from the runs quoted below is in the `results-*.txt` files. `sim.mjs` channels can be changed with `--channels=perfect,iid:0.1,burst:0.2:8` (independent loss, or bursty loss averaging 20% with runs of about 8 frames). `optical.mjs` takes `--camera`, `--fill`, `--blur`, `--noise`, `--contrast`, `--ecl`, and `--versions`.

### How the simulator measures

Instead of moving real data, the simulator tracks which source blocks are in each frame. A set of frames can rebuild the file exactly when that 0/1 matrix has full rank over GF(2), which is the same condition a real decoder has. For each run it finds the smallest number of frames that works (doubling, then bisecting; decodability only improves with more frames) and reports frames shown ÷ k. Frames lost on the channel still count as shown, because they still took time. The best any code can do is 1 ÷ (1 − loss).

Decoders:

* **peel**: the standard LT decoder the app uses (resolve degree-1 frames, substitute, repeat).
* **peel+GE**: peel, then solve whatever is left by Gaussian elimination. `lib/decoder.test.mjs` checks it against an independent rank computation.
* **inactivation** (`robust.mjs`): the exact condition, computed the way the app decodes. It gives the same answer as full elimination (also tested) but is fast enough for k = 10,000.

## Findings

### 0. What the app does now (protocol version 2)

The findings below led to a new frame format, now in `src/file-transfer-app/`:

* **Seeded frames.** Each frame carries a random 32-bit seed instead of a list of block numbers. Sender and receiver derive the same blocks from it, so there's no 16-block cap and the header is a fixed 13 bytes.
* **Robust soliton degrees plus 2% dense frames.** 98% of frames combine a few blocks (robust soliton, c = 0.03, δ = 0.5). 2% combine a random half of all blocks. Every frame is still random and independent of the others.
* **Inactivation decoding.** The receiver peels as frames arrive. Once it has k frames, it finishes with elimination over a few dozen to a few hundred "inactivated" blocks. That rebuilds the file whenever the frames determine it at all, the same as full Gaussian elimination, at a fraction of the cost.
* **Alphanumeric QR payload** and native `CompressionStream` instead of pako (section 4).

The old format can't be read any more, which was an accepted trade-off.

### Why random frames survive any loss, and how well

Each frame's seed is drawn fresh by the sender, so frames are independent and identically distributed. A frame is lost because of camera timing, focus, glare, or because nobody was pointing a camera yet, never because of which blocks it holds. So the frames that do arrive are still independent draws from the same distribution. **The chance of rebuilding the file depends only on how many frames arrived, not on which ones were missed, how many, in what pattern, or when the receiver started.** Loss only changes how long it takes to collect them: about (frames needed) ÷ (1 − loss).

The dense frames bound the bad cases. A dense frame is a uniformly random combination of blocks. If the frames so far leave r blocks undetermined, a new dense frame fixes one more with probability 1 − 2⁻ʳ ≥ ½. So each dense frame past the point of need at least halves the chance of still being stuck: the tail falls off exponentially rather than depending on luck.

Systematic designs (send each block once, then repair) don't have this property. A receiver who starts late or misses the first pass gets none of the cheap frames, so it needs a large elimination at the end: 976 of 1000 blocks inactivated for a late start in the table below, which costs about k³ ÷ 32 operations.

### 1. Hard numbers: loss, late starts, and bursts

`robust.mjs` measures the frames received and shown before the file can be rebuilt, using exact decodability checks. Channels: `iid:p` loses each frame independently with probability p; `late:n:p` loses the first n × k frames (nobody is watching yet: n = 10 is 10 full passes of the file), then loses a share p; `burst:p:L` loses p of frames in runs averaging L frames.

k = 1000, 200 runs per cell, frames received ÷ k (mean / worst of 200):

| Channel | Today: cap 16, peel | Seeded, ML decoding | **Seeded + 2% dense (app)** | Systematic + dense |
|---|---:|---:|---:|---:|
| perfect | 1.313 / 2.114 | 1.006 / 1.317 | **1.004 / 1.021** | 1.000 / 1.000 |
| 25% lost | 1.341 / 1.956 | 1.008 / 1.310 | **1.004 / 1.025** | 1.002 / 1.011 |
| 50% lost | 1.339 / 2.079 | 1.009 / 1.310 | **1.004 / 1.020** | 1.002 / 1.007 |
| 75% lost | 1.330 / 2.148 | 1.009 / 1.630 | **1.004 / 1.016** | 1.002 / 1.008 |
| 90% lost | 1.320 / 2.203 | 1.006 / 1.103 | **1.004 / 1.017** | 1.002 / 1.007 |
| 95% lost | 1.312 / 2.104 | 1.007 / 1.118 | **1.004 / 1.017** | 1.002 / 1.009 |
| 3 passes missed, then 25% lost | 1.330 / 2.168 | 1.007 / 1.122 | **1.004 / 1.022** | 1.002 / 1.008 |
| 10 passes missed, then 50% lost | 1.337 / 2.037 | 1.008 / 1.230 | **1.003 / 1.017** | 1.002 / 1.012 |
| 50% lost in bursts of 30 | 1.334 / 2.541 | 1.010 / 1.364 | **1.004 / 1.019** | 1.002 / 1.008 |

The columns stay flat down each row, as the argument above predicts. Today's format needs about a third more frames on average, and up to twice as many, whatever the channel. Seeded frames with exact decoding fix the average but keep a tail: in about 1% of runs some block never landed in any frame, costing 10–60% more. The 2% dense frames remove that tail. In 1,800 runs the worst was 2.5% over k.

Frames shown, the actual time, at 95% loss: the app needs 20.06 × k on average against an ideal 20.00 (worst 22.0, which is the channel's own luck). Today's format needs 26.2 (worst 42.0).

Systematic + dense needs the fewest frames, but the decode work grows with the share lost. It inactivates 478 blocks at 50% loss, 874 at 90%, and 976 for a late start (out of 1000). The app's design stays at about 51 whatever the channel.

Larger files, seeded + 2% dense, frames received ÷ k (mean / worst; blocks inactivated):

| k (file at 450 bytes per frame) | perfect | 50% lost | 90% lost | 10 passes missed, then 50% lost | Inactivated |
|---|---:|---:|---:|---:|---:|
| 5,000 (2.1 MB), 40 runs | 1.001 / 1.002 | 1.001 / 1.002 | 1.001 / 1.002 | 1.001 / 1.002 | about 200 |
| 10,000 (4.3 MB), 20 runs | 1.001 / 1.001 | 1.001 / 1.001 | 1.000 / 1.001 | 1.000 / 1.001 | about 360 |

Today's format at k = 5000 needs 1.58 × k on average and up to 2.83 × k (`results-robust-k5000.txt`).

### 1b. How dense should the dense frames be?

Dense frames hold a random half of all blocks. Fewer would be cheaper to build, so `robust.mjs --densities=...` tried 20% to 60% in steps of 5%, with 10,000 blocks, 95% of frames lost, and 200 runs each (`results-density-k10000.txt`):

| Dense frame holds | Extra frames beyond k: mean / p99 / worst |
|---:|---:|
| 20% | 4.2 / 19 / 21 |
| 25% | 4.1 / 14 / 17 |
| 30% | 4.2 / 13 / 17 |
| 35% | 4.2 / 15 / 19 |
| 40% | 4.1 / 16 / 18 |
| 45% | 4.3 / 19 / 20 |
| 50% (app) | 4.3 / 14 / 19 |
| 55% | 4.3 / 13 / 18 |
| 60% | 3.9 / 14 / 17 |

They're all the same within noise: about 4 extra frames for 10,000 blocks (1.0004 × k), and at most about 21 (1.002). With thousands of blocks, even a 20% frame is random enough that each one fixes a missing piece about as surely as a 50% frame. A fully dense code averages about 1.6 extra frames, so this design is already within about 3 frames of the best possible; the small remainder comes from the sparse frames that keep decoding cheap. The app keeps 50%.

### 2. The app's decoder on real data

`app-decoder.mjs` runs the app's own `fountain.ts` on random files, drops frames at random, and checks every byte. CPU time on a desktop (multiply by 3–10 for a phone):

| k | File | Lost | Received ÷ k mean / worst | While receiving, total ms | Slowest frame ms | Finishing ms |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 0.4 MB | 50% | 1.0038 / 1.0060 | 37 | 31 | 24 |
| 5,000 | 2.1 MB | 50% | 1.0028 / 1.0060 | 248 | 117 | 346 |
| 10,000 | 4.3 MB | 50% | 1.0020 / 1.0020 | 907 | 429 | 1466 |
| 1,000 | 0.4 MB | 90% | 1.0044 / 1.0080 | 23 | 18 | 18 |
| 5,000 | 2.1 MB | 90% | 1.0020 / 1.0020 | 201 | 147 | 316 |
| 2,000 (1400-byte frames) | 2.7 MB | 25% | 1.0024 / 1.0040 | 58 | 47 | 114 |

While frames arrive, the decoder only peels and, every 0.2% of k frames, checks with bit masks whether the frames are enough. The block work happens once, after the camera stops ("Finishing…" on screen). The transfer itself takes minutes, so a second or two at the end is fine.

### 3. The 16-index cap was the bottleneck, not the distribution

The old frame format lists every source index in the header, capped at 16. With a mean degree around 5.8, some source blocks don't appear in any frame until very late (a coupon-collector problem), and no decoder can recover a block nobody has sent.

k = 5000 (about 1.5 MB at 300-byte blocks), 12 runs, frames shown ÷ k (`sim.mjs`):

| Strategy | perfect | 10% loss | 30% loss | 20% bursty loss |
|---|---:|---:|---:|---:|
| Old: app distribution, cap 16, peel | 1.512 | 1.771 | 2.258 | 1.956 |
| Same, peel + Gaussian elimination | 1.512 | 1.771 | 2.258 | 1.956 |
| Seeded robust soliton (no cap), peel | 1.060 | 1.175 | 1.504 | 1.330 |
| Seeded robust soliton (no cap), peel + GE | 1.001 | 1.111 | 1.424 | 1.266 |
| Systematic + dense repair, peel + GE | 1.000 | 1.111 | 1.422 | 1.265 |
| Ideal (1 ÷ (1 − loss)) | 1.000 | 1.111 | 1.429 | 1.250 |

The earlier `experiments/soliton` search tuned probabilities inside the cap, which helps at small k (321 blocks) but can't fix coverage at large k. That's why results were similar at 4321 blocks.

### 4. Base64 in a URL wastes about a quarter of every QR code

Old frames were a URL plus base64 in QR byte mode: 10.67 QR bits per payload byte. QR's alphanumeric mode packs 2 characters into 11 bits, and 3 characters can hold 2 bytes, so a payload in an alphanumeric segment costs 8.25 bits per byte. The URL stays in a byte segment in front of it.

Payload bytes per frame, ECC L (from `capacity.mjs`):

| QR version | Old (URL + base64, index list) | URL + alphanumeric, index list | URL + alphanumeric, seeded |
|---:|---:|---:|---:|
| 15 | 326 | 431 | 455 |
| 20 | 578 | 759 | 783 |
| 25 | 890 | 1162 | 1186 |
| 30 | 1235 | 1606 | 1630 |
| 40 | 2150 | 2790 | 2814 |

That's 30–40% more data in the same QR code. The app uses this now, with one change from Base45 (RFC 9285): Base45's alphabet includes space, "%" and "+", which break or change meaning in a URL. The app uses the other 42 characters (0–9, A–Z, and `$*-./:`). 42³ is still more than 65,536, so it's just as dense. `frame-format.test.ts` renders a frame as a real QR code and reads it back with ZBar unchanged. The native BarcodeDetector should behave the same, since mixed segments are standard QR, but that still needs a check on real phones.

### 5. Optics: there's a cliff, and it's sharp

`optical.mjs` renders real QR codes into a 960×720 "camera frame" (QR filling 60% of the height), blurs them (defocus, motion, and screen bleed), adds noise and glare-reduced contrast, and decodes them with ZBar.

Decoded / bytes per second at 10 frames per second:

| QR version | Pixels per module | blur σ=0.6 | σ=1.0 | σ=1.4 | σ=1.8 |
|---:|---:|---:|---:|---:|---:|
| 10 | 6.65 | 100% / 2003 | 100% / 2003 | 100% / 2003 | 100% / 2003 |
| 15 | 5.08 | 100% / 3848 | 100% / 3848 | 100% / 3848 | 92% / 3527 |
| 20 | 4.11 | 100% / 6383 | 100% / 6383 | 100% / 6383 | 0% |
| 25 | 3.46 | 100% / 9465 | 100% / 9465 | 0% | 0% |
| 30 | 2.98 | 100% / 12908 | 8% / 1076 | 0% | 0% |
| 40 | 2.34 | 83% / 18363 | 0% | 0% | 0% |

Each version works perfectly until the blur reaches about 0.35–0.45 of a module's width, then fails completely. The best QR size depends entirely on how sharp the receiver's picture is, so a fixed setting is either too cautious or broken. Today's default (300-byte blocks, about version 15) is the safe choice and leaves 2.5–5× on the table in good conditions.

ZBar also took about 100 ms per frame regardless of QR size, because it scans the whole 960×720 image. At that rate the receiver, not the sender, limits frames per second. Cropping to the QR's area or downscaling should help, as would using the native BarcodeDetector where it exists.

## Recommendations

In order of payoff for effort:

1. ~~**Seeded frames and an exact decoder.**~~ Done, with 2% dense frames instead of a systematic pass (section 1 explains why). 25–35% fewer frames on average than the old format, up to half as many in bad runs, and no tail.
2. ~~**Alphanumeric payload.**~~ Done. 30–40% more bytes per frame for the same QR code. The default block size went from 300 to 450 bytes, which is about the same QR size as before.
3. **Let the person pick QR density, and show them whether it's working.** The receiver should show the share of frames it decodes. If that's near 100%, the sender can go denser; if it drops, back off. Fountain frames can't mix block sizes, so changing density means restarting the transfer, which is quick to do at the start.
4. **Make the receiver faster.** Crop to the QR region, decode in a Web Worker, prefer the native detector, and stop rescanning frames identical to the last one.
5. **Pace the sender to the camera.** A frame shown for less than two camera frames (under 66 ms at 30 frames per second) is often captured mid-change. Around 10–15 frames per second is a sensible ceiling.

Rough effect for 1 MB with sharp conditions and 10% of frames lost: the old format (version 15, cap 16) needed about 3,200 blocks × 1.77 ≈ 5,700 frames, roughly 9.5 minutes at 10 frames per second. Version 2 at the same QR size needs about 2,300 blocks × 1.12 ≈ 2,600 frames, about 4.3 minutes. At version 25 it's about 885 blocks × 1.12 ≈ 990 frames, about 1.7 minutes, if the receiver keeps up with 10 frames per second.

## Next experiments

* **Real-device optical bench.** Run the sender at fixed QR versions and frame rates and log, on the receiver, the share of frames decoded and the decode time. Do this across a few phones and screens. The simulator's numbers are only as good as its blur and noise model.
* **Several QR codes per frame.** A 2×2 grid of smaller codes may beat one big code, since each needs less sharpness and they decode independently. `optical.mjs` can be extended to render grids.
* **Color channels.** Three QR codes in the red, green, and blue channels would triple the data per frame if cameras separate the colors well enough. This is promising but sensitive to white balance and screen color.
* **Feedback without a back-channel.** The receiver can show its own screen as a tiny status QR code that the sender's front camera reads ("have 82%, missing these blocks"). That would allow targeted repair and density changes without the person doing anything.
* **Decode cost on phones.** Time `fountain.ts` in a browser on a low-end phone for k = 5,000–20,000. On a desktop, finishing takes 0.35 s at k = 5,000 and 1.5 s at k = 10,000 (section 2).
