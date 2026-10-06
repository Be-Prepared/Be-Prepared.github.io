# Optical File Transfer: Where the Time Goes

These experiments look at the whole chain for sending a file with a stream of QR codes, not just the degree distribution:

1. **Coding:** how many frames must be shown before the receiver can rebuild the file (`sim.mjs`).
2. **Framing:** how many file bytes fit in one QR code (`capacity.mjs`).
3. **Optics:** which QR sizes a camera can actually read, and how long decoding takes (`optical.mjs`).

Transfer time ≈ (file size ÷ bytes per frame) × (frames needed ÷ frames decoded) ÷ frames per second. Each experiment attacks one factor.

## Running

```bash
cd experiments/transfer
node sim.mjs --k=1000 --runs=40                # coding strategies vs. loss
node sim.mjs --k=5000 --runs=12                # slower; closer to a 1.5 MB file
node capacity.mjs --fps=10 --file=1048576      # bytes per frame and time per MB
node optical.mjs --runs=12                     # QR decode rates under blur
node --test lib/                               # decoder correctness tests
```

All runs are seeded and reproducible. Raw output from the runs quoted below is in `results-k1000.txt`, `results-k5000.txt`, and `results-optical.txt`. `sim.mjs` channels can be changed with `--channels=perfect,iid:0.1,burst:0.2:8` (independent loss, or bursty loss averaging 20% with runs of about 8 frames). `optical.mjs` takes `--camera`, `--fill`, `--blur`, `--noise`, `--contrast`, `--ecl`, and `--versions`.

### How the simulator measures

Instead of moving real data, the simulator tracks which source blocks are in each frame. A set of frames can rebuild the file exactly when that 0/1 matrix has full rank over GF(2), which is the same condition a real decoder has. For each run it finds the smallest number of frames that works (doubling, then bisecting; decodability only improves with more frames) and reports frames shown ÷ k. Frames lost on the channel still count as shown, because they still took time. The best any code can do is 1 ÷ (1 − loss).

Decoders:

* **peel**: the standard LT decoder the app uses (resolve degree-1 frames, substitute, repeat).
* **peel+GE**: peel, then solve whatever is left by Gaussian elimination. `lib/decoder.test.mjs` checks it against an independent rank computation.

## Findings

### 1. The 16-index cap is the bottleneck, not the distribution

The current frame format lists every source index in the header, capped at 16. With a mean degree around 5.8, some source blocks don't appear in any frame until very late (a coupon-collector problem), and no decoder can recover a block nobody has sent.

k = 5000 (about 1.5 MB at 300-byte blocks), 12 runs, frames shown ÷ k:

| Strategy | perfect | 10% loss | 30% loss | 20% bursty loss |
|---|---:|---:|---:|---:|
| Today: app distribution, cap 16, peel | 1.512 | 1.771 | 2.258 | 1.956 |
| Same, peel + Gaussian elimination | 1.512 | 1.771 | 2.258 | 1.956 |
| Seeded robust soliton (no cap), peel | 1.060 | 1.175 | 1.504 | 1.330 |
| Seeded robust soliton (no cap), peel + GE | 1.001 | 1.111 | 1.424 | 1.266 |
| **Systematic + dense repair, peel + GE** | **1.000** | **1.111** | **1.422** | **1.265** |
| Ideal (1 ÷ (1 − loss)) | 1.000 | 1.111 | 1.429 | 1.250 |

At k = 5000, Gaussian elimination gives nothing on top of today's format: when the file finally decodes, peeling alone could already finish (leftover set size 0). At k = 1000 it helps a little (1.338 → 1.303). The p95 tail is also large (1.92 on a perfect channel at k = 5000).

The earlier `experiments/soliton` search tuned probabilities inside the cap, which helps at small k (321 blocks) but can't fix coverage at large k. That's why results were similar at 4321 blocks.

### 2. Systematic frames need dense repair

Sending each block once, in order, and then switching to random frames sounds ideal, and it is on a perfect channel (1.000). With loss, though, the app's low-degree repair frames mostly cover blocks the receiver already has, so finding the few missing ones is slow: **2.26× at 10% loss**, worse than not being systematic at all.

Repair frames that XOR a random half of all blocks fix this. Any k plus a few independent frames decode, regardless of which ones were lost, and the receiver only eliminates over the blocks it missed (about 500 at 10% loss for k = 5000). The sender XORs about k/2 blocks per repair frame: 750 KB per frame for a 1.5 MB file, which is fine at 10–20 frames per second.

This needs seeded frames: the header carries a 32-bit seed, and both sides derive the indices from it with the same PRNG. That also shrinks the header from 16 + 4 × degree bytes to a fixed 16 bytes.

### 3. Base64 in a URL wastes about a quarter of every QR code

Frames are a URL plus base64 in QR byte mode, which carries 6 bits of payload per 8-bit character. Base45 (RFC 9285) uses exactly QR's alphanumeric character set, which QR packs at 11 bits per 2 characters (2 bytes → 3 characters), so a frame can keep the URL in a byte segment and put the payload in an alphanumeric segment.

Payload bytes per frame, ECC L (from `capacity.mjs`):

| QR version | Today (URL + base64, index list) | URL + Base45, index list | URL + Base45, seeded |
|---:|---:|---:|---:|
| 15 | 326 | 431 | 455 |
| 20 | 578 | 759 | 783 |
| 25 | 890 | 1162 | 1186 |
| 30 | 1235 | 1606 | 1630 |
| 40 | 2150 | 2790 | 2814 |

That's 30–40% more data in the same QR code. To check before relying on it: the QR library must support mixed segments, and both receivers (native BarcodeDetector and ZBar) must return the alphanumeric text unchanged. Both are standard QR features, so they should.

### 4. Optics: there's a cliff, and it's sharp

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

1. **Seeded frames with systematic + dense repair, and a peel + elimination decoder.** About 1.5× fewer frames on a perfect channel and 1.6× fewer at 10% loss for large files, and it removes the long tail. This needs a new frame format (a version byte, so old frames can still be read).
2. **Base45 payload in an alphanumeric segment.** 30–40% more bytes per frame for the same QR code. This also needs the new format.
3. **Let the person pick QR density, and show them whether it's working.** The receiver should show the share of frames it decodes. If that's near 100%, the sender can go denser; if it drops, back off. Fountain frames can't mix block sizes, so changing density means restarting the transfer, which is quick to do at the start.
4. **Make the receiver faster.** Crop to the QR region, decode in a Web Worker, prefer the native detector, and stop rescanning frames identical to the last one.
5. **Pace the sender to the camera.** A frame shown for less than two camera frames (under 66 ms at 30 frames per second) is often captured mid-change. Around 10–15 frames per second is a sensible ceiling.

Rough effect for 1 MB with sharp conditions and 10% of frames lost: today (version 15, cap 16) needs about 3,200 blocks × 1.77 ≈ 5,700 frames, roughly 9.5 minutes at 10 frames per second. Seeded, systematic + dense, Base45 at version 25 needs about 885 blocks × 1.11 ≈ 980 frames, roughly 1.6 minutes, if the receiver keeps up with 10 frames per second.

## Next experiments

* **Real-device optical bench.** Run the sender at fixed QR versions and frame rates and log, on the receiver, the share of frames decoded and the decode time. Do this across a few phones and screens. The simulator's numbers are only as good as its blur and noise model.
* **Several QR codes per frame.** A 2×2 grid of smaller codes may beat one big code, since each needs less sharpness and they decode independently. `optical.mjs` can be extended to render grids.
* **Color channels.** Three QR codes in the red, green, and blue channels would triple the data per frame if cameras separate the colors well enough. This is promising but sensitive to white balance and screen color.
* **Feedback without a back-channel.** The receiver can show its own screen as a tiny status QR code that the sender's front camera reads ("have 82%, missing these blocks"). That would allow targeted repair and density changes without the person doing anything.
* **Decode cost on phones.** Time the peel + elimination decoder in a browser on a low-end phone for k = 5000–20000 to confirm elimination over the missing blocks stays fast enough.
