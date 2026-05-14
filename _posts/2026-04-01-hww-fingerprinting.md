---
layout: post
title: Is Hardware Wallet Fingerprinting Even Possible?
date: 2026-04-01
description:
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