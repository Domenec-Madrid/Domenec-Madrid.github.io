---
layout: post
title: What Grinding Has Actually Saved on Chain
date: 2026-08-16
description: Low-r grinding saves a byte per signature. I did the accounting over every ECDSA signature ever mined, to see what that adds up to and how much is still being left on the table.
tags: ["Bitcoin", "Cryptography", "Signatures", "Low-r grinding", "Rust", "Blockchain Analysis"]
categories:
---

A few months ago, I wrote about [whether you can fingerprint a hardware wallet](/blog/2026/hww-fingerprinting/)from its signatures, and I discovered that some wallet vendors implement a subtle technique to save an almost free byte on each ECDSA signature.

That's called **low-r grinding**. The **r** comes from one of the signature values, and **grinding** refers to repeatedly generating signatures until they manage to save that one byte.

Although I'll explain how this optimization works later in this post, the first thing that came to mind when I learned about it was:

**How many bytes has all that grinding actually saved?**

One byte is a ridiculously small thing to care about. Yet Bitcoin Core shipped a feature to save it, and other wallets followed suit. So either everyone is wasting their time, or maybe, as we say in Catalonia, *de mica en mica s'omple la pica* or many a little makes a mickle.

Let's count them ;)

## Encoding and Signature Values

An ECDSA signature is transmitted in DER format:

```
30 <len> 02 <len_r> <r> 02 <len_s> <s> <sighash>
```

DER integers are signed and encoded using two's complement. If the most significant bit of the first byte of $r$ or $s$ is set, the encoder prepends a `0x00` so the value isn't read as negative.

A *low value* is one for which $r < 2^{255}$, or $s \leq n/2$. Such values would save one byte in a DER encoded signature.

## How To Grind a Low Value

| | how you get a low value | cost |
| --- | --- | --- |
| **$s$** | negate it: if $(r, s)$ is valid, so is $(r, n - s)$ | 1 signature |
| **$r$** | throw the nonce away and sign again | ~2 signatures |

$s$ is free because both halves authorize the same thing, so a signer just keeps the one it likes. Core started doing that in [v0.9.0](https://bitcoin.org/en/release/v0.9.0) (March 2014) as a malleability fix, and [v0.10.3](https://bitcoin.org/en/release/v0.10.3) and [v0.11.1](https://bitcoin.org/en/release/v0.11.1) made high-$s$ non-standard in October 2015.

$r$ comes from the nonce, $r = (kG)_x \bmod n$, that implies that a wallet that wants another value has to sign again. Core shipped that in [v0.17.0](https://bitcoin.org/en/release/v0.17.0) (October 2018).

## The Accounting

[mainnet.observer](https://mainnet.observer) publishes a daily count of how many ECDSA signatures had a low or a high $r$, and the same for $s$. I read [the backend](https://github.com/0xB10C/mainnet-observer) first, to check that its thresholds are the ones that decide the padding byte. I wanted to do it by myself with an owned node, but for now I'll make the accounting with B10c data.

To do the accounting I wrote a small [tool](https://github.com/Dmenec/bytes-saved-by-grinding-signatures) that pulls those series, caches them and does the accounting. It reports two numbers:

- **saved** -> every low-$r$ and low-$s$ signature existing on chain.
- **missed** -> every high-$r$ and high-$s$ signature existing on chain.

<style>
.grind-chart {
  --viz-surface: var(--global-bg-color);
  --viz-grid: var(--global-divider-color);
  --viz-base: #8a8a8a;
  --viz-ann: #b0b0b0;
  --viz-s1: var(--demo-r);
  --viz-s2: var(--demo-s);
  margin: 1.5rem 0;
}
html[data-theme="dark"] .grind-chart {
  --viz-base: #7d7d7d;
  --viz-ann: #5c5c5c;
  --viz-s1: var(--demo-r);
  --viz-s2: var(--demo-s);
}
.grind-chart svg { width: 100%; height: auto; display: block; overflow: visible; }
.grind-plot { position: relative; }
.grind-chart .viz-tick { font-size: 12px; fill: var(--global-text-color-light); }
.grind-chart .viz-note { font-size: 11px; fill: var(--global-text-color-light); }
.grind-chart .viz-ann-label { font-size: 11px; fill: var(--global-text-color-light); }
.grind-chart .viz-dl { font-size: 13px; font-weight: 600; }
.grind-legend { display: flex; gap: 1.2rem; flex-wrap: wrap; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--global-text-color); }
.grind-legend i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; margin-right: 0.4rem; vertical-align: middle; }
.grind-tip {
  position: absolute; top: 8%; opacity: 0; pointer-events: none;
  background: var(--global-bg-color); border: 1px solid var(--global-divider-color);
  border-radius: 5px; padding: 5px 9px; font-size: 0.78rem; line-height: 1.45;
  white-space: nowrap; color: var(--global-text-color); transition: opacity .12s;
}
.grind-caption { font-size: 0.8rem; color: var(--global-text-color-light); margin-top: 0.5rem; }
</style>

<div class="grind-chart" id="grind-chart">
  <div class="grind-legend">
    <span><i style="background:var(--viz-s1)"></i>low-<em>r</em></span>
    <span><i style="background:var(--viz-s2)"></i>low-<em>s</em></span>
  </div>
  <div class="grind-plot">
    <svg viewBox="0 0 760 376" role="img" aria-label="Share of Bitcoin ECDSA signatures with a low r value and a low s value, per month, 2009 to 2026.">
    <line x1="46" y1="336.0" x2="656" y2="336.0" stroke="var(--viz-grid)" stroke-width="1"/>
    <line x1="46" y1="238.7" x2="656" y2="238.7" stroke="var(--viz-grid)" stroke-width="1"/>
    <line x1="46" y1="190.0" x2="656" y2="190.0" stroke="var(--viz-grid)" stroke-width="1"/>
    <line x1="46" y1="141.3" x2="656" y2="141.3" stroke="var(--viz-grid)" stroke-width="1"/>
    <line x1="46" y1="92.7" x2="656" y2="92.7" stroke="var(--viz-grid)" stroke-width="1"/>
    <line x1="46" y1="44.0" x2="656" y2="44.0" stroke="var(--viz-grid)" stroke-width="1"/>
    <text x="38" y="340.0" text-anchor="end" class="viz-tick">40%</text>
    <text x="38" y="242.7" text-anchor="end" class="viz-tick">60%</text>
    <text x="38" y="145.3" text-anchor="end" class="viz-tick">80%</text>
    <text x="38" y="48.0" text-anchor="end" class="viz-tick">100%</text>
    <line x1="46" y1="287.3" x2="656" y2="287.3" stroke="var(--viz-base)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="650" y="279.3" text-anchor="end" class="viz-note">50%</text>
    <line x1="225.2" y1="38" x2="225.2" y2="336" stroke="var(--viz-ann)" stroke-width="1" stroke-dasharray="2 3"/>
    <text x="225.2" y="18" text-anchor="middle" class="viz-ann-label">Core v0.9.0</text>
    <line x1="280.2" y1="38" x2="280.2" y2="336" stroke="var(--viz-ann)" stroke-width="1" stroke-dasharray="2 3"/>
    <text x="280.2" y="32" text-anchor="middle" class="viz-ann-label">Core v0.11.1</text>
    <line x1="384.2" y1="38" x2="384.2" y2="336" stroke="var(--viz-ann)" stroke-width="1" stroke-dasharray="2 3"/>
    <text x="384.2" y="18" text-anchor="middle" class="viz-ann-label">Core v0.17.0</text>
    <line x1="46" y1="336" x2="656" y2="336" stroke="var(--viz-grid)" stroke-width="1"/>
    <text x="80.7" y="356" text-anchor="middle" class="viz-tick">2010</text>
    <text x="150.1" y="356" text-anchor="middle" class="viz-tick">2012</text>
    <text x="219.5" y="356" text-anchor="middle" class="viz-tick">2014</text>
    <text x="288.8" y="356" text-anchor="middle" class="viz-tick">2016</text>
    <text x="358.2" y="356" text-anchor="middle" class="viz-tick">2018</text>
    <text x="427.6" y="356" text-anchor="middle" class="viz-tick">2020</text>
    <text x="497.0" y="356" text-anchor="middle" class="viz-tick">2022</text>
    <text x="566.4" y="356" text-anchor="middle" class="viz-tick">2024</text>
    <text x="635.8" y="356" text-anchor="middle" class="viz-tick">2026</text>
    <path d="M 46.0 268.6 L 48.9 279.5 L 51.8 273.6 L 54.7 297.3 L 57.6 301.3 L 60.5 295.6 L 63.3 289.2 L 66.2 287.3 L 69.1 287.3 L 72.0 280.2 L 74.9 259.7 L 77.8 295.1 L 80.7 293.2 L 83.6 286.8 L 86.5 293.3 L 89.4 286.7 L 92.3 291.6 L 95.1 280.4 L 98.0 286.3 L 100.9 285.8 L 103.8 286.7 L 106.7 282.5 L 109.6 286.8 L 112.5 288.7 L 115.4 288.0 L 118.3 289.9 L 121.2 286.7 L 124.1 287.5 L 126.9 287.2 L 129.8 286.8 L 132.7 287.6 L 135.6 287.3 L 138.5 287.7 L 141.4 288.1 L 144.3 287.7 L 147.2 287.9 L 150.1 287.0 L 153.0 287.6 L 155.9 287.6 L 158.7 287.4 L 161.6 287.4 L 164.5 287.5 L 167.4 287.4 L 170.3 287.4 L 173.2 287.4 L 176.1 287.3 L 179.0 287.5 L 181.9 287.3 L 184.8 287.4 L 187.7 287.2 L 190.5 287.3 L 193.4 287.1 L 196.3 287.1 L 199.2 287.2 L 202.1 287.3 L 205.0 287.1 L 207.9 287.0 L 210.8 286.4 L 213.7 285.6 L 216.6 280.8 L 219.5 277.3 L 222.4 272.6 L 225.2 256.1 L 228.1 226.6 L 231.0 209.6 L 233.9 205.5 L 236.8 203.1 L 239.7 198.4 L 242.6 192.8 L 245.5 190.2 L 248.4 189.4 L 251.3 150.7 L 254.2 81.2 L 257.0 63.2 L 259.9 69.9 L 262.8 90.2 L 265.7 90.5 L 268.6 86.0 L 271.5 58.3 L 274.4 59.4 L 277.3 58.7 L 280.2 62.1 L 283.1 45.9 L 286.0 44.0 L 288.8 44.0 L 291.7 44.0 L 294.6 44.0 L 297.5 44.0 L 300.4 44.0 L 303.3 44.0 L 306.2 44.0 L 309.1 44.0 L 312.0 44.0 L 314.9 44.0 L 317.8 44.0 L 320.6 44.0 L 323.5 44.0 L 326.4 44.0 L 329.3 44.2 L 332.2 44.0 L 335.1 44.0 L 338.0 44.0 L 340.9 44.0 L 343.8 44.0 L 346.7 44.0 L 349.6 44.0 L 352.4 44.0 L 355.3 44.0 L 358.2 44.0 L 361.1 44.2 L 364.0 44.0 L 366.9 44.0 L 369.8 44.0 L 372.7 44.0 L 375.6 44.0 L 378.5 44.0 L 381.4 44.0 L 384.2 44.0 L 387.1 44.0 L 390.0 44.0 L 392.9 44.0 L 395.8 44.0 L 398.7 44.0 L 401.6 44.0 L 404.5 44.0 L 407.4 44.0 L 410.3 44.0 L 413.2 44.0 L 416.0 44.0 L 418.9 44.0 L 421.8 44.0 L 424.7 44.0 L 427.6 44.0 L 430.5 44.0 L 433.4 44.0 L 436.3 44.0 L 439.2 44.0 L 442.1 44.0 L 445.0 44.0 L 447.8 44.0 L 450.7 44.0 L 453.6 44.0 L 456.5 44.0 L 459.4 44.0 L 462.3 44.0 L 465.2 44.0 L 468.1 44.0 L 471.0 44.0 L 473.9 44.0 L 476.8 44.0 L 479.6 44.0 L 482.5 44.0 L 485.4 44.0 L 488.3 44.0 L 491.2 44.0 L 494.1 44.0 L 497.0 44.0 L 499.9 44.0 L 502.8 44.0 L 505.7 44.0 L 508.6 44.0 L 511.5 44.0 L 514.3 44.0 L 517.2 44.0 L 520.1 44.0 L 523.0 44.0 L 525.9 44.0 L 528.8 44.0 L 531.7 44.0 L 534.6 44.0 L 537.5 44.0 L 540.4 44.0 L 543.3 44.0 L 546.1 44.0 L 549.0 44.0 L 551.9 44.0 L 554.8 44.0 L 557.7 44.0 L 560.6 44.0 L 563.5 44.0 L 566.4 44.0 L 569.3 44.0 L 572.2 44.0 L 575.1 44.0 L 577.9 44.0 L 580.8 44.0 L 583.7 44.0 L 586.6 44.0 L 589.5 44.0 L 592.4 44.0 L 595.3 44.0 L 598.2 44.0 L 601.1 44.0 L 604.0 44.0 L 606.9 44.0 L 609.7 44.0 L 612.6 44.0 L 615.5 44.0 L 618.4 44.0 L 621.3 44.0 L 624.2 44.0 L 627.1 44.0 L 630.0 44.0 L 632.9 44.0 L 635.8 44.0 L 638.7 44.0 L 641.5 44.0 L 644.4 44.0 L 647.3 44.0 L 650.2 44.0 L 653.1 44.0 L 656.0 44.0" fill="none" stroke="var(--viz-s2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M 46.0 268.6 L 48.9 313.1 L 51.8 295.2 L 54.7 265.0 L 57.6 294.3 L 60.5 229.9 L 63.3 304.6 L 66.2 281.5 L 69.1 291.0 L 72.0 298.0 L 74.9 300.5 L 77.8 278.8 L 80.7 279.7 L 83.6 277.7 L 86.5 291.2 L 89.4 287.0 L 92.3 290.1 L 95.1 288.1 L 98.0 288.5 L 100.9 287.0 L 103.8 290.2 L 106.7 286.7 L 109.6 286.2 L 112.5 287.4 L 115.4 288.1 L 118.3 287.1 L 121.2 288.0 L 124.1 287.1 L 126.9 286.7 L 129.8 287.1 L 132.7 286.9 L 135.6 287.9 L 138.5 287.2 L 141.4 287.4 L 144.3 287.2 L 147.2 287.7 L 150.1 287.9 L 153.0 286.9 L 155.9 286.8 L 158.7 287.6 L 161.6 287.6 L 164.5 287.5 L 167.4 287.4 L 170.3 287.3 L 173.2 287.1 L 176.1 287.2 L 179.0 287.4 L 181.9 287.2 L 184.8 287.4 L 187.7 287.4 L 190.5 287.5 L 193.4 287.3 L 196.3 287.2 L 199.2 287.5 L 202.1 287.3 L 205.0 287.2 L 207.9 287.3 L 210.8 287.3 L 213.7 287.3 L 216.6 287.4 L 219.5 287.1 L 222.4 287.3 L 225.2 287.4 L 228.1 287.1 L 231.0 287.3 L 233.9 287.4 L 236.8 287.4 L 239.7 287.0 L 242.6 286.8 L 245.5 287.0 L 248.4 287.0 L 251.3 287.1 L 254.2 286.9 L 257.0 286.8 L 259.9 286.3 L 262.8 285.9 L 265.7 285.5 L 268.6 285.8 L 271.5 259.4 L 274.4 284.4 L 277.3 254.5 L 280.2 283.4 L 283.1 284.6 L 286.0 285.2 L 288.8 285.4 L 291.7 285.2 L 294.6 283.7 L 297.5 283.4 L 300.4 283.7 L 303.3 283.6 L 306.2 283.6 L 309.1 283.8 L 312.0 284.0 L 314.9 283.9 L 317.8 284.3 L 320.6 283.8 L 323.5 283.6 L 326.4 283.3 L 329.3 283.6 L 332.2 284.2 L 335.1 284.3 L 338.0 285.1 L 340.9 285.8 L 343.8 285.9 L 346.7 286.3 L 349.6 286.6 L 352.4 286.6 L 355.3 286.6 L 358.2 286.8 L 361.1 286.8 L 364.0 287.0 L 366.9 286.7 L 369.8 286.6 L 372.7 286.8 L 375.6 286.7 L 378.5 286.6 L 381.4 286.3 L 384.2 284.4 L 387.1 280.8 L 390.0 277.5 L 392.9 275.7 L 395.8 272.3 L 398.7 268.9 L 401.6 265.9 L 404.5 258.9 L 407.4 251.3 L 410.3 250.7 L 413.2 244.8 L 416.0 240.7 L 418.9 242.4 L 421.8 233.6 L 424.7 237.1 L 427.6 239.3 L 430.5 236.0 L 433.4 234.0 L 436.3 225.4 L 439.2 226.1 L 442.1 222.9 L 445.0 218.3 L 447.8 218.6 L 450.7 216.5 L 453.6 209.9 L 456.5 211.7 L 459.4 209.5 L 462.3 212.1 L 465.2 209.0 L 468.1 202.3 L 471.0 206.5 L 473.9 201.7 L 476.8 207.8 L 479.6 201.1 L 482.5 209.2 L 485.4 206.4 L 488.3 206.5 L 491.2 207.1 L 494.1 200.9 L 497.0 207.0 L 499.9 199.8 L 502.8 207.1 L 505.7 203.8 L 508.6 202.9 L 511.5 198.1 L 514.3 195.1 L 517.2 192.2 L 520.1 193.6 L 523.0 192.5 L 525.9 199.0 L 528.8 188.9 L 531.7 192.5 L 534.6 200.3 L 537.5 203.3 L 540.4 201.1 L 543.3 214.2 L 546.1 206.7 L 549.0 201.5 L 551.9 204.3 L 554.8 198.0 L 557.7 216.0 L 560.6 207.8 L 563.5 216.7 L 566.4 211.1 L 569.3 210.8 L 572.2 214.3 L 575.1 223.9 L 577.9 228.0 L 580.8 230.5 L 583.7 223.6 L 586.6 228.1 L 589.5 226.0 L 592.4 234.4 L 595.3 236.2 L 598.2 242.6 L 601.1 237.0 L 604.0 225.6 L 606.9 227.9 L 609.7 229.0 L 612.6 237.2 L 615.5 236.5 L 618.4 233.9 L 621.3 241.3 L 624.2 242.7 L 627.1 239.6 L 630.0 229.6 L 632.9 238.3 L 635.8 230.7 L 638.7 234.3 L 641.5 235.2 L 644.4 229.1 L 647.3 229.8 L 650.2 204.5 L 653.1 200.3 L 656.0 198.8" fill="none" stroke="var(--viz-s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="666" y="48.0" class="viz-dl" fill="var(--viz-s2)">low-s 100%</text>
    <text x="666" y="202.8" class="viz-dl" fill="var(--viz-s1)">low-r 68%</text>
    <line id="grind-cross" x1="0" y1="44" x2="0" y2="336" stroke="var(--viz-base)" stroke-width="1" opacity="0"/>
    <circle id="grind-d1" r="4.5" fill="var(--viz-s1)" stroke="var(--viz-surface)" stroke-width="2" opacity="0"/>
    <circle id="grind-d2" r="4.5" fill="var(--viz-s2)" stroke="var(--viz-surface)" stroke-width="2" opacity="0"/>
    <rect id="grind-hit" x="46" y="44" width="610" height="292" fill="transparent"/>
    </svg>
    <div class="grind-tip" id="grind-tip"></div>
  </div>
  <p class="grind-caption">ECDSA signatures with a low <em>r</em> and a low <em>s</em> value, by month. Data: <a href="https://mainnet.observer">mainnet.observer</a>.</p>
</div>

<script>
(function () {
  var G = {"L": 46, "T": 44, "pw": 610, "ph": 292, "n": 212, "ymin": 40.0, "ymax": 100.0};
  var M = ["2009-01", "2009-02", "2009-03", "2009-04", "2009-05", "2009-06", "2009-07", "2009-08", "2009-09", "2009-10", "2009-11", "2009-12", "2010-01", "2010-02", "2010-03", "2010-04", "2010-05", "2010-06", "2010-07", "2010-08", "2010-09", "2010-10", "2010-11", "2010-12", "2011-01", "2011-02", "2011-03", "2011-04", "2011-05", "2011-06", "2011-07", "2011-08", "2011-09", "2011-10", "2011-11", "2011-12", "2012-01", "2012-02", "2012-03", "2012-04", "2012-05", "2012-06", "2012-07", "2012-08", "2012-09", "2012-10", "2012-11", "2012-12", "2013-01", "2013-02", "2013-03", "2013-04", "2013-05", "2013-06", "2013-07", "2013-08", "2013-09", "2013-10", "2013-11", "2013-12", "2014-01", "2014-02", "2014-03", "2014-04", "2014-05", "2014-06", "2014-07", "2014-08", "2014-09", "2014-10", "2014-11", "2014-12", "2015-01", "2015-02", "2015-03", "2015-04", "2015-05", "2015-06", "2015-07", "2015-08", "2015-09", "2015-10", "2015-11", "2015-12", "2016-01", "2016-02", "2016-03", "2016-04", "2016-05", "2016-06", "2016-07", "2016-08", "2016-09", "2016-10", "2016-11", "2016-12", "2017-01", "2017-02", "2017-03", "2017-04", "2017-05", "2017-06", "2017-07", "2017-08", "2017-09", "2017-10", "2017-11", "2017-12", "2018-01", "2018-02", "2018-03", "2018-04", "2018-05", "2018-06", "2018-07", "2018-08", "2018-09", "2018-10", "2018-11", "2018-12", "2019-01", "2019-02", "2019-03", "2019-04", "2019-05", "2019-06", "2019-07", "2019-08", "2019-09", "2019-10", "2019-11", "2019-12", "2020-01", "2020-02", "2020-03", "2020-04", "2020-05", "2020-06", "2020-07", "2020-08", "2020-09", "2020-10", "2020-11", "2020-12", "2021-01", "2021-02", "2021-03", "2021-04", "2021-05", "2021-06", "2021-07", "2021-08", "2021-09", "2021-10", "2021-11", "2021-12", "2022-01", "2022-02", "2022-03", "2022-04", "2022-05", "2022-06", "2022-07", "2022-08", "2022-09", "2022-10", "2022-11", "2022-12", "2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12", "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"], R = [53.85, 44.7, 48.39, 54.59, 48.57, 61.8, 46.46, 51.2, 49.24, 47.8, 47.29, 51.75, 51.57, 51.98, 49.21, 50.07, 49.43, 49.84, 49.77, 50.06, 49.42, 50.13, 50.24, 49.99, 49.84, 50.05, 49.86, 50.05, 50.12, 50.05, 50.09, 49.88, 50.02, 49.99, 50.03, 49.93, 49.88, 50.08, 50.1, 49.95, 49.95, 49.97, 49.99, 50.0, 50.04, 50.03, 49.98, 50.02, 49.99, 49.99, 49.96, 50.0, 50.02, 49.97, 50.0, 50.03, 50.01, 50.0, 50.0, 49.99, 50.04, 50.0, 49.99, 50.04, 50.0, 49.98, 49.99, 50.06, 50.1, 50.06, 50.07, 50.05, 50.08, 50.11, 50.22, 50.29, 50.37, 50.31, 55.73, 50.61, 56.75, 50.8, 50.57, 50.43, 50.4, 50.43, 50.75, 50.81, 50.74, 50.76, 50.77, 50.73, 50.69, 50.7, 50.63, 50.72, 50.77, 50.82, 50.77, 50.65, 50.63, 50.45, 50.32, 50.3, 50.21, 50.16, 50.16, 50.16, 50.1, 50.1, 50.07, 50.14, 50.16, 50.11, 50.12, 50.16, 50.22, 50.6, 51.34, 52.02, 52.39, 53.08, 53.78, 54.4, 55.85, 57.4, 57.52, 58.75, 59.58, 59.24, 61.05, 60.32, 59.86, 60.55, 60.96, 62.73, 62.59, 63.24, 64.18, 64.13, 64.55, 65.91, 65.55, 65.99, 65.46, 66.09, 67.47, 66.6, 67.59, 66.35, 67.72, 66.06, 66.64, 66.61, 66.48, 67.76, 66.5, 67.98, 66.48, 67.17, 67.35, 68.33, 68.96, 69.54, 69.26, 69.49, 68.15, 70.22, 69.49, 67.88, 67.26, 67.71, 65.02, 66.56, 67.63, 67.07, 68.35, 64.65, 66.34, 64.52, 65.66, 65.72, 65.01, 63.04, 62.19, 61.68, 63.1, 62.17, 62.6, 60.88, 60.51, 59.19, 60.35, 62.68, 62.22, 61.98, 60.31, 60.44, 60.98, 59.46, 59.18, 59.8, 61.87, 60.08, 61.63, 60.89, 60.71, 61.97, 61.83, 67.02, 67.89, 68.3], S = [53.85, 51.61, 52.82, 47.96, 47.14, 48.31, 49.61, 50.0, 50.0, 51.46, 55.67, 48.4, 48.8, 50.11, 48.77, 50.14, 49.13, 51.42, 50.21, 50.31, 50.13, 50.99, 50.1, 49.71, 49.86, 49.47, 50.14, 49.96, 50.02, 50.1, 49.94, 50.01, 49.92, 49.85, 49.92, 49.88, 50.06, 49.94, 49.95, 49.99, 49.99, 49.97, 49.99, 49.98, 49.98, 50.0, 49.96, 50.01, 49.98, 50.02, 50.0, 50.04, 50.05, 50.02, 50.01, 50.04, 50.07, 50.19, 50.35, 51.34, 52.07, 53.03, 56.41, 62.47, 65.97, 66.81, 67.31, 68.28, 69.42, 69.96, 70.13, 78.08, 92.35, 96.06, 94.68, 90.5, 90.45, 91.38, 97.06, 96.83, 96.98, 96.29, 99.6, 99.99, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 99.96, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 99.96, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0];
  var svg = document.querySelector('#grind-chart svg');
  var hit = document.getElementById('grind-hit');
  var cross = document.getElementById('grind-cross');
  var d1 = document.getElementById('grind-d1'), d2 = document.getElementById('grind-d2');
  var tip = document.getElementById('grind-tip');
  function px(i) { return G.L + i * G.pw / (G.n - 1); }
  function py(v) { return G.T + (G.ymax - v) * G.ph / (G.ymax - G.ymin); }
  function show(on) {
    [cross, d1, d2].forEach(function (e) { e.setAttribute('opacity', on ? '1' : '0'); });
    tip.style.opacity = on ? '1' : '0';
  }
  function move(ev) {
    var box = svg.getBoundingClientRect();
    var sx = (ev.clientX - box.left) / box.width * 760;
    var i = Math.round((sx - G.L) / G.pw * (G.n - 1));
    i = Math.max(0, Math.min(G.n - 1, i));
    var X = px(i);
    cross.setAttribute('x1', X); cross.setAttribute('x2', X);
    d1.setAttribute('cx', X); d1.setAttribute('cy', py(R[i]));
    d2.setAttribute('cx', X); d2.setAttribute('cy', py(S[i]));
    tip.innerHTML = '<strong>' + M[i] + '</strong><br><span style="color:var(--viz-s1)">&#9679;</span> low-r ' +
      R[i].toFixed(1) + '%<br><span style="color:var(--viz-s2)">&#9679;</span> low-s ' + S[i].toFixed(1) + '%';
    tip.style.left = (X / 760 * 100) + '%';
    tip.style.transform = (X > 500 ? 'translate(-105%, 0)' : 'translate(5%, 0)');
    show(true);
  }
  hit.addEventListener('mousemove', move);
  hit.addEventListener('mouseleave', function () { show(false); });
  hit.addEventListener('touchmove', function (e) { move(e.touches[0]); e.preventDefault(); }, { passive: false });
})();
</script>

**Low-$s$** sits at the coin flip until 2014, goes almost vertical through 2015, and is pinned at 100% from 2016 on, once high-$s$ was non-standard.

**Low-$r$** is flat at 50% for nine years, bends in **October 2018** when v0.17.0 shipped, and peaks at **70.2% in December 2022**. Then it sags, and has been drifting between 60% and 68% ever since.

I could not work out what drove the sag. My first guess was the input mix, since native P2WPKH went from 40% of all inputs in late 2022 to more than 70% today. But that share kept growing through 2026 while the low-$r$ rate recovered from a low of 59.2% in September 2025 to 68.3% today, so the mix cannot actually be.  

Answering it properly needs per-signer data, which, for obvious reasons, I don't have. If you know have another theory, [get in touch](https://domenec-madrid.github.io/contact/).

### Bytes Saved and Missed

Every ECDSA signature ever mined, up to 2026-08-16:

| | signatures | share |
| --- | ---: | ---: |
| **ECDSA signatures, total** | 3,459,841,248 | |
| low-$r$ | 2,067,946,821 | 59.77% |
| high-$r$ | 1,391,894,427 | 40.23% |
| low-$s$ | 3,396,981,816 | 98.18% |
| high-$s$ | 62,859,432 | 1.82% |

And the bytes:

| | saved | missed |
| --- | ---: | ---: |
| **$r$** | 2,067,946,821 B $\approx$ 1.93 GiB | 1,391,894,427 B $\approx$ 1.30 GiB |
| **$s$** | 3,396,981,816 B $\approx$ 3.16 GiB | 62,859,432 B $\approx$ 60 MiB |
| **total** | **5,464,928,637 B $\approx$ 5.09 GiB** | 1,454,753,859 B $\approx$ 1.35 GiB |  

So low values have kept **5.09 GiB** off the chain, and another **1.35 GiB** went on it that could have been avoided.

### Year By Year

| year | ECDSA signatures | low-$r$ | low-$s$ | bytes saved by low-$r$ |
| --- | ---: | ---: | ---: | ---: |
| 2009 | 2,887 | 50.02% | 50.43% | 1,444 |
| 2010 | 191,116 | 50.03% | 50.16% | 95,608 |
| 2011 | 3,447,119 | 50.01% | 49.96% | 1,723,828 |
| 2012 | 17,736,693 | 50.00% | 49.99% | 8,868,495 |
| 2013 | 44,792,943 | 50.00% | 50.22% | 22,394,729 |
| 2014 | 70,930,099 | 50.03% | 65.92% | 35,488,821 |
| 2015 | 134,307,571 | 51.57% | 95.78% | 69,257,943 |
| 2016 | 234,039,416 | 50.68% | 100.00% | 118,612,031 |
| 2017 | 288,523,846 | 50.44% | 100.00% | 145,545,026 |
| 2018 | 258,365,252 | 50.43% | 100.00% | 130,300,030 |
| 2019 | 293,511,914 | **56.96%** | 100.00% | 167,175,275 |
| 2020 | 327,550,787 | **63.51%** | 100.00% | 208,038,031 |
| 2021 | 335,559,999 | **66.74%** | 100.00% | 223,958,700 |
| 2022 | 331,825,716 | **68.29%** | 100.00% | 226,614,538 |
| 2023 | 295,429,445 | **66.95%** | 100.00% | 197,781,952 |
| 2024 | 303,704,931 | **62.53%** | 100.00% | 189,894,515 |
| 2025 | 310,498,544 | **60.78%** | 100.00% | 188,717,072 |
| 2026\* | 209,422,970 | **63.74%** | 100.00% | 133,478,783 |

<small>\* 2026 is partial, through August 16th.</small>

Since [SegWit](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki), not every byte takes up the same amount of a block. A block holds 4,000,000 *weight units* and a byte in the base transaction costs 4 of them, a byte in the witness costs 1. Divide weight by four and you get *vbytes*, so a base byte is 1 vbyte and a witness byte is only **0.25**.

That matters here because a signature in a legacy input sits in the *scriptSig*, which is base data, while a signature in a *SegWit* input sits in the witness.

**mainnet.observer** counts signatures but does not say which kind of input each one came from, so I had to do an approximation. Every day I splitted the signatures between *scriptSig* and *witness* in proportion to the *legacy* and *SegWit v0* inputs spent that day.  

Taproot inputs are left out, since they carry Schnorr signatures, not ECDSA.

>
> A BIP-340 signature is a flat **64 bytes**, 32 for $R_x$ and 32 for $s$ which means any byte cannot be saved from here.
{: .block-tip }

So the 5.09 GiB saved is not 5.09 GiB of block space. Most of those were witness bytes:

| | bytes | vbytes |
| --- | ---: | ---: |
| saved | 5,464,928,637 | 3,292,879,022 |
| missed | 1,454,753,859 | 969,157,898 |

A block holds one million vbytes and a new one arrives every ten minutes, which turns any pile of vbytes into an amount of time. The saved side comes to **3,293 blocks**, about three weeks of chain. The missed side comes to **969 blocks**, close to a week.

Counting only $r$, it is **906 blocks** of block space, more than six days.

High-$r$ signatures burned another **24.8 blocks** during 2026 alone, and in August 2026 low-$r$ is at 68.3%, so roughly **one signature in three still isn't ground**.

## How Much Of That Was Really Grinding?

Every low-$r$ signature saved a byte, but half of them would have been low anyway. When nobody grinds, $r$ is a coin flip. Only the excess over half was paid for by somebody:

$$
\text{bytes from grinding} = \text{low-}r - \frac{N}{2}
$$

Over all history that is 3,459,841,248 signatures, so chance alone gives 1,729,920,624 low-$r$ ones. The chain carries 2,067,946,821. The difference, **338,026,197 bytes or about 322 MiB**, is what grinding bought. The other 1.6 GiB was free.

The same subtraction works per year. But a coin flip never lands on exactly half, so a year with no grinding still shows some excess. For $N$ signatures that wobble is $\sqrt{N}/2$, and dividing the excess by it gives a $\sigma$ count: under 3 is what luck does on a good day.

| period | bytes from grinding | $\sigma$ from chance |
| --- | ---: | ---: |
| 2009–2013 | 0 | −0.3 |
| 2014 | 23,772 | 6 |
| 2015 | 2,104,158 | 363 |
| 2016 | 1,592,323 | 208 |
| 2017 | 1,283,103 | 151 |
| 2018 | 1,117,404 | 139 |
| 2019 | 20,419,318 | 2,384 |
| 2020 | 44,262,638 | 4,891 |
| 2021 | 56,178,700 | 6,134 |
| 2022 | 60,701,680 | 6,665 |
| 2023 | 50,067,230 | 5,826 |
| 2024 | 38,042,050 | 4,366 |
| 2025 | 33,467,800 | 3,799 |
| 2026\* | 28,767,298 | 3,976 |

That column splits the history in three.

**2009 to 2013 is luck.** 403 bytes of excess across five years, under one $\sigma$. Nobody was grinding.

**2019 onward is grinding.** Thousands of $\sigma$. Core shipped it in October 2018 and the chain answers immediately.

**2014 to 2018 I cannot explain.** Only 6 MiB, but at 139 to 364 $\sigma$ it is not chance either, and it starts four years before the feature existed. Something was already leaning towards low $r$. A large service running its own signing code would explain it, and so would signatures being less independent than a fair coin assumes. I would rather leave it open than pick one.

What I will defend is the split: **98.2% of the 322 MiB comes from 2019 onward**, once v0.17.0 was out.

That means that only about **36% of signatures come from software that grinds**.  

### How to Grind Even a Little “Byte” More

There is actually one more byte we could save.

If we kept grinding until $r < 2^{248}$, the first byte of $r$ would be `0x00`. DER could then drop it entirely, saving a second byte from every signature. Had this been done throughout Bitcoin's history, it would have saved another **3.22 GiB**, about two thirds of what low values have saved so far.

But! There is a reason nobody does it. Finding a regular low-$r$ value takes about two signing attempts on average. Finding one below $2^{248}$ would take about 256, making your signing device considerably slow every time you sign something.  

Furthermore, I am not aware of any device that implements this technique. If only one device did it, its unusually short signatures would make it easy to fingerprint on-chain.

<div class="demo-block" id="grind-demo">
  <h6 class="demo-heading">ECDSA signature grinding</h6>

  <div class="demo-modes">
    <button class="demo-mode is-active" data-mode="standard">No grinding</button>
    <button class="demo-mode" data-mode="low-r">Grind low-<em>r</em></button>
    <button class="demo-mode" data-mode="drop-byte">Grind <em>r</em> &lt; 2<sup>248</sup></button>
  </div>

  <div class="demo-stats">
    <div>
      <span class="demo-stat-value" id="grind-len">&mdash;</span>
      <span class="demo-stat-label">signature bytes</span>
    </div>
    <div>
      <span class="demo-stat-value" id="grind-tries">&mdash;</span>
      <span class="demo-stat-label">signing attempts</span>
    </div>
  </div>

  <div class="demo-legend">
    <span class="is-quiet">DER structure</span>
    <span class="is-r"><em>r</em></span>
    <span class="is-s"><em>s</em></span>
    <span class="is-pad">padding / dropped</span>
  </div>

  <div class="demo-hex" id="grind-hex"></div>
  <div class="demo-note" id="grind-note"></div>
</div>

<script>
(function () {
  function randBytes(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function h2(b) { return b.toString(16).padStart(2, '0'); }

  // DER encodes r as a signed big-endian integer with no redundant leading
  // zero, so the length of the encoded r depends entirely on its top bytes.
  function encodedRLen(r) {
    if (r[0] === 0x00) return r[1] >= 0x80 ? 32 : 31;   // leading zero stripped, maybe re-added
    return r[0] >= 0x80 ? 33 : 32;                       // 0x00 prepended to keep it positive
  }

  function sign(mode) {
    var r, rLen, tries = 0;
    do {
      r = randBytes(32);
      tries++;
      rLen = encodedRLen(r);
      if (mode === 'standard') break;
      if (mode === 'low-r' && rLen <= 32) break;
      if (mode === 'drop-byte' && rLen === 31) break;
    } while (tries < 5000);

    var s = randBytes(32);
    s[0] &= 0x7f;                       // BIP-62 low-s never needs padding
    if (s[0] === 0) s[0] = 0x01;

    return { r: r, s: s, rLen: rLen, tries: tries, sigLen: 6 + rLen + 32 + 1 };
  }

  // PurgeCSS scans the built site for literal class names, so these have to be
  // spelled out in full here. Building them as 'demo-byte--' + key would leave
  // the rules unreferenced and they would be stripped from the stylesheet.
  var BYTE_CLASS = {
    r: 'demo-byte--r',
    s: 'demo-byte--s',
    pad: 'demo-byte--pad',
    dropped: 'demo-byte--dropped'
  };

  function cell(hex, cls, title) {
    return '<span class="demo-byte' + (cls ? ' ' + BYTE_CLASS[cls] : '') +
      '" title="' + title + '">' + hex + '</span>';
  }

  function render(sig) {
    var r = sig.r, rLen = sig.rLen, out = '';
    out += cell('30', '', 'SEQUENCE') + cell(h2(4 + rLen + 32), '', 'total length');
    out += cell('02', '', 'INTEGER (r)') + cell(h2(rLen), '', 'r is ' + rLen + ' bytes');

    if (rLen === 33) {
      out += cell('00', 'pad', 'r[0] >= 0x80, so DER prepends 0x00');
      for (var i = 0; i < 32; i++) out += cell(h2(r[i]), 'r', 'r[' + i + ']');
    } else if (rLen === 31) {
      out += cell('00', 'dropped', 'r[0] was 0x00 and r[1] < 0x80, so DER drops it');
      for (var j = 1; j < 32; j++) out += cell(h2(r[j]), 'r', 'r[' + j + ']');
    } else {
      for (var k = 0; k < 32; k++) out += cell(h2(r[k]), 'r', 'r[' + k + ']');
    }

    out += cell('02', '', 'INTEGER (s)') + cell('20', '', 's is 32 bytes');
    for (var m = 0; m < 32; m++) out += cell(h2(sig.s[m]), 's', 's[' + m + ']');
    out += cell('01', '', 'SIGHASH_ALL');
    return out;
  }

  var NOTES = {
    33: '<code>r[0] &ge; 0x80</code>. DER reads integers as two&rsquo;s complement, so the encoder ' +
        'prepends <code>0x00</code> to stop it being negative.',
    32: '<code>r &lt; 2<sup>255</sup></code>, so the high bit is clear and no padding byte is needed. ',
    31: '<code>r &lt; 2<sup>248</sup></code>, so the top byte is <code>0x00</code> and DER drops it ' +
        'outright. 70 bytes, but the mean cost jumps to ~256 attempts and a wallet emitting these ' +
        'would be the loudest fingerprint on the chain.'
  };

  function run(mode, btn) {
    document.querySelectorAll('#grind-demo .demo-mode').forEach(function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    var sig = sign(mode);
    document.getElementById('grind-len').textContent = sig.sigLen;
    document.getElementById('grind-tries').textContent = sig.tries.toLocaleString();
    document.getElementById('grind-hex').innerHTML = render(sig);
    document.getElementById('grind-note').innerHTML = NOTES[sig.rLen];
  }

  function init() {
    var btns = document.querySelectorAll('#grind-demo .demo-mode');
    btns.forEach(function (b) {
      b.addEventListener('click', function () { run(b.dataset.mode, b); });
    });
    run('standard', btns[0]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>



## Run it yourself

The tool is Rust, two small modules and two dependencies. It caches every CSV on the first run, so after that it works offline.

```bash
cargo build --release

# all-time summary
./target/release/bytes-saved-by-grinding-signatures

# since low-r grinding shipped, month by month
./target/release/bytes-saved-by-grinding-signatures --from 2018-10-01 --group month

# export for plotting
./target/release/bytes-saved-by-grinding-signatures --group month --csv > out.csv
```

Every figure here comes out of that binary, except the input-mix percentages in the sag paragraph, which I worked out separately. Code and methodology notes are in the [repository](https://github.com/Dmenec/bytes-saved-by-grinding-signatures).

## So, was it worth it?

Grinding $r$ has bought Bitcoin 322 MiB of chain, about 159 blocks, in exchange for roughly doubling the ECDSA signing work of every wallet that does it. Negating $s$ cost nobody anything and bought five times more, in two years instead of eight.

That gap is the actual lesson, and it is not about bytes:

> Free optimizations reach 100%. Optimizations that cost something stall at two thirds and then drift back down.

Low-$r$ grinding has been available, documented and free-as-in-code for eight years, and two thirds of Bitcoin's ECDSA signatures still come from signers that don't use it. If your wallet signs ECDSA and doesn't grind, there are six days of block space with your name on it.

And Taproot? You can't run any of this on it. A BIP-340 signature is a flat **64 bytes**, 32 for $R_x$ and 32 for $s$, with no DER wrapper, no length prefixes and no sign bit to pad around. The `0x00` this whole post is about cannot exist there, so there is no low-$r$, no high-$r$ and nothing to grind.

Which makes the follow-up a different question, and a better one: not how many bytes wallets ground away, but how many bytes Bitcoin saved by making them impossible to waste. That's the post I want to write next!

<sub>*All data from [mainnet.observer](https://mainnet.observer) by [0xB10C](https://b10c.me), which does the hard part: parsing every block since 2009.*</sub>
