---
layout: post
title: Is Hardware Wallet Fingerprinting Even Possible?
date: 2026-04-01
description: Can you tell which hardware wallet signed a Bitcoin transaction just by looking at its ECDSA or Schnorr signature? We tested ten devices and found out.
tags: ["Bitcoin", "Cryptography", "Hardware Wallets", "Wallet Fingerprinting", "Signatures", "Privacy"]
categories:
---

Every Bitcoin transaction contains one or more digital signatures. These signatures authorize the spending of funds, but they can also inadvertently reveal information about how or "who" have generated them.  

Let's start with a brief description ;)

**Wallet fingerprinting** is the practice of identifying which wallet, created a particular transaction. Software wallets are already relatively well studied in this area: they differ in how they select UTXOs, order inputs and outputs, estimate fees, etc. By the other hand, Hardware wallets however, have received almost no attention, largely because it's assumed they're all the same: isolated signing devices that just produce a deterministic signature and nothing more.

Well, that assumption turns out to be only partly true.

---

### What's actually in a signature?

To understand fingerprinting on those devices, you need to understand what a Bitcoin signature contains and how it's encoded.

#### ECDSA (Legacy and SegWit)

ECDSA signatures produce a pair of values $(r, s)$. The $r$ value is derived from a randomly chosen nonce $k$: specifically, $r = (kG)_x \mod n$.  
The $s$ value encodes the actual authorization using the private key: $s = k⁻1(z+dr) \mod n$.

These values are encoded in **DER format**, which has a quirk: if either $r$ or $s$ starts with a byte of `0x80` or higher, a `0x00` padding byte must be prepended to avoid the value being interpreted as negative (DER uses two's complement). This means a signature can be anywhere from 70 to 73 bytes long.

Since [BIP-62](https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki), the $s$ value is always normalized to the lower half of the curve, capping signatures at 72 bytes. But $r$ is still variable: roughly 50% of the time, $r$ starts with a high byte and needs that extra `0x00`.

#### Schnorr (Taproot)

Schnorr signatures always encode to exactly **64 bytes**, 32 for the $x$-coordinate of the nonce point $R$, and 32 for $s$. No DER encoding, no variable length, no malleability.

---

<div class="demo-card" id="ecdsa-demo">
  <div class="card-body">
    <h6 class="card-title fw-bold mb-1">ECDSA vs Schnorr — signature length visualizer</h6>
    <p class="card-text text-muted mb-3" style="font-size:0.85rem">
      Random values simulate the nonce-derived $r$ and the BIP-62-normalized $s$. Hover any byte for its role.
    </p>
    <div class="d-flex align-items-center gap-3 flex-wrap mb-3">
      <button class="demo-btn demo-btn--primary" id="ecdsa-sign-btn">Sign</button>
      <button class="demo-btn" id="ecdsa-sign-many-btn">Sign 100×</button>
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="ecdsa-lowr-toggle">
        <label class="form-check-label small" for="ecdsa-lowr-toggle">Low-<em>r</em> grinding</label>
      </div>
    </div>
    <div id="ecdsa-output" style="display:none">
      <div class="d-flex gap-3 mb-3 flex-wrap">
        <div class="text-center">
          <div id="ecdsa-badge-len" class="demo-badge">?? bytes</div>
          <div class="small text-muted mt-1">ECDSA size</div>
        </div>
        <div class="text-center" id="ecdsa-attempts-block" style="display:none">
          <div id="ecdsa-badge-attempts" class="demo-badge">? attempt</div>
          <div class="small text-muted mt-1">grinding rounds</div>
        </div>
        <div class="text-center">
          <div class="demo-badge demo-badge--flat">64 bytes</div>
          <div class="small text-muted mt-1">Schnorr size</div>
        </div>
      </div>
      <div class="mb-2">
        <div class="small fw-bold mb-1">ECDSA — DER encoding</div>
        <div id="ecdsa-der-viz" class="font-monospace" style="word-break:break-all;line-height:2.1;font-size:0.78rem"></div>
        <div class="mt-2 d-flex flex-wrap gap-1" style="font-size:0.75rem">
          <span class="demo-badge" style="background:var(--demo-stone)">structure</span>
          <span class="demo-badge" style="background:var(--demo-orange)">r bytes</span>
          <span class="demo-badge" style="background:var(--demo-brick)">0x00 padding</span>
          <span class="demo-badge" style="background:var(--demo-green)">s bytes</span>
          <span class="demo-badge" style="background:var(--demo-dusk)">SIGHASH</span>
        </div>
      </div>
      <div class="mt-3">
        <div class="small fw-bold mb-1">Schnorr (Taproot) — always 64 bytes, no DER</div>
        <div id="ecdsa-schnorr-viz" class="font-monospace" style="word-break:break-all;line-height:2.1;font-size:0.78rem"></div>
        <div class="mt-2 d-flex flex-wrap gap-1" style="font-size:0.75rem">
          <span class="demo-badge" style="background:var(--demo-orange)">R x-coord (32 B)</span>
          <span class="demo-badge" style="background:var(--demo-green)">s (32 B)</span>
        </div>
      </div>
      <div id="ecdsa-many-stats" style="display:none" class="mt-3 p-2 rounded" style="background:var(--global-code-bg-color)">
        <div class="small fw-bold">Last 100 signatures:</div>
        <div class="d-flex gap-3 mt-1 small">
          <span><strong id="ecdsa-c71">0</strong> × 71 bytes</span>
          <span><strong id="ecdsa-c72">0</strong> × 72 bytes</span>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
(function () {
  function randBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  function signECDSA(grind) {
    let r, attempts = 0;
    do {
      r = randBytes(32);
      attempts++;
    } while (grind && r[0] >= 0x80 && attempts < 500);

    // BIP-62: low-s ⟹ s[0] always < 0x80
    const s = randBytes(32);
    s[0] = s[0] & 0x7f;
    if (s[0] === 0) s[0] = 0x01;

    const needsPad = r[0] >= 0x80;
    const rLen = needsPad ? 33 : 32;
    // structure: 0x30 totalLen 0x02 rLen [pad] r 0x02 0x20 s 0x01
    const totalLen = 2 + rLen + 2 + 32;
    const sigLen = 1 + 1 + totalLen + 1; // +1 sighash

    return { r, s, needsPad, rLen, totalLen, sigLen, attempts };
  }

  function byte(hex, title, bg, fg) {
    // Styling lives in .demo-byte (_sass/_demos.scss); only the role colour
    // varies per byte, so that is all we set inline.
    return '<span class="demo-byte" title="' + title + '" style="background:' + bg +
      (fg ? ';color:' + fg : '') + '">' + hex + '</span>';
  }

  function renderDER(sig) {
    const { r, s, needsPad, rLen, totalLen } = sig;
    let h = '';
    h += byte('30', 'SEQUENCE tag', 'var(--demo-stone)');
    h += byte(totalLen.toString(16).padStart(2, '0'), 'total length: ' + totalLen + ' bytes', 'var(--demo-stone)');
    h += byte('02', 'INTEGER tag (r)', 'var(--demo-orange)');
    h += byte(rLen.toString(16).padStart(2, '0'), 'r length: ' + rLen + ' bytes', 'var(--demo-orange)');
    if (needsPad) h += byte('00', 'padding: r[0] ≥ 0x80, two\'s-complement sign bit', 'var(--demo-brick)');
    Array.from(r).forEach(function (b, i) {
      h += byte(b.toString(16).padStart(2, '0'), 'r[' + i + ']' + (i === 0 && needsPad ? ' — would be negative without padding' : ''), 'var(--demo-orange)');
    });
    h += byte('02', 'INTEGER tag (s)', 'var(--demo-green)');
    h += byte('20', 's length: 32 bytes (BIP-62 low-s ⟹ never needs padding)', 'var(--demo-green)');
    Array.from(s).forEach(function (b, i) {
      h += byte(b.toString(16).padStart(2, '0'), 's[' + i + ']', 'var(--demo-green)');
    });
    h += byte('01', 'SIGHASH_ALL', 'var(--demo-dusk)');
    return h;
  }

  function renderSchnorr() {
    const R = randBytes(32);
    const s = randBytes(32);
    let h = '';
    Array.from(R).forEach(function (b, i) {
      h += byte(b.toString(16).padStart(2, '0'), 'R[' + i + '] — nonce point x-coordinate', 'var(--demo-orange)');
    });
    Array.from(s).forEach(function (b, i) {
      h += byte(b.toString(16).padStart(2, '0'), 's[' + i + ']', 'var(--demo-green)');
    });
    return h;
  }

  function updateUI(sig) {
    const grind = document.getElementById('ecdsa-lowr-toggle').checked;
    document.getElementById('ecdsa-badge-len').textContent = sig.sigLen + ' bytes';
    document.getElementById('ecdsa-badge-len').className = 'demo-badge ' + (sig.sigLen === 71 ? 'demo-badge--good' : 'demo-badge--warn');
    document.getElementById('ecdsa-badge-len').style.color = sig.sigLen === 71 ? '' : '#000';
    const attBlock = document.getElementById('ecdsa-attempts-block');
    if (grind) {
      attBlock.style.display = '';
      document.getElementById('ecdsa-badge-attempts').textContent = sig.attempts + ' attempt' + (sig.attempts !== 1 ? 's' : '');
    } else {
      attBlock.style.display = 'none';
    }
    document.getElementById('ecdsa-der-viz').innerHTML = renderDER(sig);
    document.getElementById('ecdsa-schnorr-viz').innerHTML = renderSchnorr();
    document.getElementById('ecdsa-output').style.display = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('ecdsa-sign-btn').addEventListener('click', function () {
      const sig = signECDSA(document.getElementById('ecdsa-lowr-toggle').checked);
      updateUI(sig);
      document.getElementById('ecdsa-many-stats').style.display = 'none';
    });

    document.getElementById('ecdsa-sign-many-btn').addEventListener('click', function () {
      const grind = document.getElementById('ecdsa-lowr-toggle').checked;
      let c71 = 0, c72 = 0;
      for (let i = 0; i < 100; i++) {
        const s = signECDSA(grind);
        s.sigLen === 71 ? c71++ : c72++;
      }
      updateUI(signECDSA(grind));
      document.getElementById('ecdsa-c71').textContent = c71;
      document.getElementById('ecdsa-c72').textContent = c72;
      document.getElementById('ecdsa-many-stats').style.display = '';
    });
  });
})();
</script>

---

### The fingerprinting vectors

Given the above, what can actually be used to fingerprint a hardware wallet?

#### 1. Low-$r$ grinding

Some wallets iterate over candidate nonces until $r$ falls in the low range of the curve (i.e., doesn't need the leading `0x00`). This "low-$r$ grinding" produces signatures that are always 71 bytes instead of the usual 71–72.

{% include figure.liquid
   path="/assets/img/posts/hww-fp/ecdsa_len.png"
   alt="ECDSA signature length distribution over time"
   caption="ECDSA signature length over time. The shift toward 71-byte signatures around October 2018 marks the adoption of low-r grinding in Bitcoin Core v0.17.0. Source: mainnet.observer"
   class="img-fluid w-75 d-block mx-auto rounded z-depth-1"
   zoomable=true
   loading="lazy" %}

The fingerprinting logic here is asymmetric:

- A **72-byte signature** means the wallet does _not_ implement low-$r$ grinding.
- A **71-byte signature** doesn't prove grinding, it could just be a lucky nonce.

So... it is a probabilistic fingerprint.

#### 2. SIGHASH type

Every ECDSA signature ends with a one-byte SIGHASH flag that defines which parts of the transaction are covered by the signature.

If a transaction uses any SIGHASH type other than `ALL`, it immediately narrows down which wallets could have produced it, since most hardware wallets only support `SIGHASH_ALL`.

#### 3. Nonce determinism (RFC 6979)

[RFC 6979](https://datatracker.ietf.org/doc/html/rfc6979) defines a way to generate the nonce $k$ deterministically from the private key and the message, rather than randomly. This means signing the same PSBT twice with the same key should produce identical signatures.

In theory, this could be used for fingerprinting, you just have to sign the same transaction twice and compare. If the signatures are identical, the wallets uses RFC 6979. But in practice, **this is only detectable in a lab setting**, you can't broadcast two conflicting transactions, so an external observer on the blockchain cannot use this trait.

During our experiments, we observed some of the wallets implementing RFC 6979 were differing on signature values. We concluded it was related to *low R grinding* and the number of RFC 6979 rounds they performed to obtain a low-R value.  

---

### Building a test environment

One of the practical problems in this research was that some of the wallets we wanted to test **only work on Bitcoin mainnet**.
So we built our own main-net, a parallel Bitcoin mainnet that shares the same genesis block as the real network but runs in complete isolation. See how to replicate it [here :)](https://domenec-madrid.github.io/blog/2025/byom/)

Although this environment is not necessary for signature creation and observation, we needed it to verify whether signatures generated with different sighashes were valid on mainnet.

In any case, find the full setup available at [BTC-Labnet](https://github.com/Dmenec/BTC-Labnet).

---

### Results

We tested ten devices, all initialized with the same BIP-39 seed phrase, all connected to [Sparrow Wallet](https://sparrowwallet.com/) (or their official companion app where Sparrow wasn't supported). For each wallet, we signed the same PSBT multiple times and observed the signatures.

The results clustered into three groups:

| Group                           | Behavior                                      |
| ------------------------------- | --------------------------------------------- |
| RFC 6979, no low-$r$ grinding   | Deterministic signatures, 71–72 byte range    |
| RFC 6979 + low-$r$ grinding     | Deterministic, always 71 bytes                |
| Anti-exfil, no low-$r$ grinding | Non-deterministic by design, 71–72 byte range |  

<small> In case you've haven't heard of [anti-exfil](https://medium.com/blockstream/anti-exfil-stopping-key-exfiltration-589f02facc2e).</small>  

Wallets like **BitBox02** and **Jade** deliberately introduce external randomness into nonce generation to prevent covert channel attacks (like Dark Skippy, which I've written about [before](/blog/2025/cvca/)). This makes their signatures non-deterministic, and therefore distinguishable from the rest.

On SIGHASH support, the picture was stark. Most wallets refused to sign with anything other than `SIGHASH_ALL`. Only **Ledger Nano S+** and **Keystone 3 Pro** accepted the full range of SIGHASH types, making them immediately identifiable when those types appear in the wild.

Here's the summary:

| Wallet                                         | Low-$r$ | NONE | SINGLE | ANYONECANPAY variants | Cluster |
| ---------------------------------------------- | :-----: | :--: | :----: | :-------------------: | :-----: |
| Ledger Nano S Plus (Bitcoin App 2.3.0)         |    ✗    |  ✓   |   ✓    |           ✓           |    A    |
| BitBox02 (Multi 9.21.0)                        |    ✗    |  ✗   |   ✗    |           ✗           |    B    |
| Foundation Passport (2.3.5)                    |    ✗    |  ✗   |   ✗    |           ✗           |    B    |
| Trezor Model T Safe 3 (2.8.7)                  |    ✗    |  ✗   |   ✗    |           ✗           |    B    |
| Trezor Model T Safe 5 (2.8.7)                  |    ✗    |  ✗   |   ✗    |           ✗           |    B    |
| Coldcard Mk4 (5.2.0)                           |    ✓    |  ✗   |   ✗    |           ✗           |    C    |
| Blockstream Jade (1.0.35)                      |    ✓    |  ✗   |   ✗    |           ✗           |    C    |
| KeepKey (7.9.1)                                |    ✗    |  ✗   |   ✗    |           ✗           |    B    |
| Keystone 3 Pro (BTC 1.1.4)                     |    ✗    |  ✓   |   ✓    |           ✓           |    A    |
| SeedSigner (0.7.0)                             |    ✓    |  ✗   |   ✗    |           ✗           |    C    |

---

### So, are them fingerprintable or not?

Hardware wallets are, in general, much harder to fingerprint than software wallets.

The main difficulty in fingerprinting them is determining whether a signature was produced by a hardware wallet rather than a software one, which is practically impossible without additional information. Even if you know that a transaction was signed using a hardware wallet, you might be able to assign it to one of the three groups of devices. However, there is still no reliable way to distinguish between individual wallets within the same group.

Therefore, we can conclude that individually distinguishing a hardware wallet from a signature is essentially infeasible.