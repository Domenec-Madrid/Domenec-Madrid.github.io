---
layout: post
title: Is Hardware Wallet Fingerprinting Even Possible?
date: 2026-04-01
description:
tags: ["Bitcoin", "Cryptography", "Hardware Wallets", "Wallet Fingerprinting", "Signatures", "Privacy"]
categories:
---

When we think about Bitcoin privacy, most people focus on address reuse or network-level tracking. But there's a subtler question that doesn't get nearly enough attention: can someone tell _which hardware wallet signed a transaction just by looking at the signature_?

This is exactly what Jordi Herrera-Joancomartí and I set out to investigate. The short answer is: yes, partially — and the details are worth understanding.

---

## Why fingerprinting matters

Every Bitcoin transaction contains one or more digital signatures. These signatures authorize the spending of funds, but they can also inadvertently reveal information about the device that generated them.

**Wallet fingerprinting** is the practice of identifying which wallet — software or hardware — created a particular transaction. Software wallets are already relatively well studied in this area: they differ in how they select UTXOs, order inputs and outputs, and estimate fees. Hardware wallets, however, have received almost no attention, largely because it's assumed they're all the same: isolated signing devices that just produce a deterministic signature and nothing more.

That assumption turns out to be only partly true.

---

## What's actually in a signature?

To understand fingerprinting, you need to understand what a Bitcoin signature contains and how it's encoded.

### ECDSA (Legacy and SegWit)

ECDSA signatures produce a pair of values $(r, s)$. The $r$ value is derived from a randomly chosen nonce $k$: specifically, $r = (kG)_x \mod n$. The $s$ value encodes the actual authorization using the private key.

These values are encoded in **DER format**, which has a quirk: if either $r$ or $s$ starts with a byte of `0x80` or higher, a `0x00` padding byte must be prepended to avoid the value being interpreted as negative (DER uses two's complement). This means a signature can be anywhere from 70 to 73 bytes long.

Since [BIP-62](https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki), the $s$ value is always normalized to the lower half of the curve, capping signatures at 72 bytes. But $r$ is still variable: roughly 50% of the time, $r$ starts with a high byte and needs that extra `0x00`.

### Schnorr (Taproot)

Schnorr signatures, introduced with Taproot, are a different story. They always encode to exactly **64 bytes** — 32 for the $x$-coordinate of the nonce point $R$, and 32 for $s$. No DER encoding, no variable length, no malleability.

---

## The fingerprinting vectors

Given the above, what can actually be used to fingerprint a hardware wallet?

### 1. Low-$r$ grinding

Some wallets — notably Bitcoin Core since v0.17.0 — iterate over candidate nonces until $r$ falls in the low range of the curve (i.e., doesn't need the leading `0x00`). This "low-$r$ grinding" produces signatures that are always 71 bytes instead of the usual 71–72.

{% include figure.liquid
   path="/assets/img/posts/hwwf/ecdsa_len.png"
   alt="ECDSA signature length distribution over time"
   caption="ECDSA signature length over time. The shift toward 71-byte signatures around October 2018 marks the adoption of low-r grinding in Bitcoin Core v0.17.0. Source: mainnet.observer"
   class="img-fluid w-75 d-block mx-auto rounded z-depth-1"
   zoomable=true
   loading="lazy" %}

The fingerprinting logic here is asymmetric:

- A **72-byte signature** means the wallet does _not_ implement low-$r$ grinding.
- A **71-byte signature** doesn't prove grinding — it could just be a lucky nonce.

It's probabilistic, not definitive. But it's real.

### 2. SIGHASH type

Every ECDSA signature ends with a one-byte SIGHASH flag that defines which parts of the transaction are covered by the signature. `SIGHASH_ALL` (the default) signs every input and output. Other types — `SIGHASH_NONE`, `SIGHASH_SINGLE`, and their `ANYONECANPAY` variants — sign subsets.

If a transaction uses any SIGHASH type other than `ALL`, it immediately narrows down which wallets could have produced it, since most hardware wallets only support `SIGHASH_ALL`.

### 3. Nonce determinism (RFC 6979)

[RFC 6979](https://datatracker.ietf.org/doc/html/rfc6979) defines a way to generate the nonce $k$ deterministically from the private key and the message, rather than randomly. This means signing the same PSBT twice with the same key should produce identical signatures.

In theory, this could be used for fingerprinting: sign the same transaction twice and compare. If the signatures are identical, the wallet uses RFC 6979. But in practice, **this is only detectable in a lab setting** — you can't broadcast two conflicting transactions, so an external observer on the blockchain cannot use this trait.

---

## Building a test environment: mainlabnet

One of the practical problems in this research was that some of the hardware wallets we wanted to test **only work on Bitcoin mainnet** — no testnet, no signet. Conducting extensive signing tests on real mainnet would be prohibitively expensive.

So we built our own: **mainlabnet**, a parallel Bitcoin mainnet that shares the same genesis block as the real network but runs in complete isolation.

The key requirement was that SegWit and Taproot had to be active from block 0, since later blocks use consensus rules that depend on their activation heights. To achieve this, we forked Bitcoin Core and modified `chainparams.cpp` to set both activation heights to 0.

Each node runs as a Docker container (~5.11 GB Ubuntu image with Bitcoin Core 24.0.1), connected through a bridge network that keeps the chain fully isolated. A central router node handles peer discovery, a dedicated miner produces blocks on demand (difficulty is 1, so mining is near-instant), and additional nodes validate the chain. We also deployed a local [Mempool Space](https://mempool.space/) instance for block exploration.

The full setup is available at [BTC-Labnet](https://github.com/Dmenec/BTC-Labnet).

---

## Results: ten hardware wallets, three groups

We tested ten devices, all initialized with the same BIP-39 seed phrase, all connected to [Sparrow Wallet](https://sparrowwallet.com/) (or their official companion app where Sparrow wasn't supported). For each wallet, we signed the same PSBT multiple times and observed the signatures.

The results clustered into three groups:

| Group                           | Behavior                                      |
| ------------------------------- | --------------------------------------------- |
| RFC 6979, no low-$r$ grinding   | Deterministic signatures, 71–72 byte range    |
| RFC 6979 + low-$r$ grinding     | Deterministic, always 71 bytes                |
| Anti-exfil, no low-$r$ grinding | Non-deterministic by design, 71–72 byte range |

The [Anti-Exfil](https://medium.com/blockstream/anti-exfil-stopping-key-exfiltration-589f02facc2e) group is particularly interesting: wallets like **BitBox02** and **Jade** deliberately introduce external randomness into nonce generation to prevent covert channel attacks (like Dark Skippy, which I've written about [before](/blog/2025/cvca/)). This makes their signatures non-deterministic — and therefore distinguishable from the rest.

On SIGHASH support, the picture was stark. Most wallets refused to sign with anything other than `SIGHASH_ALL`. Only **Ledger Nano S+** and **Keystone 3 Pro** accepted the full range of SIGHASH types, making them immediately identifiable when those types appear in the wild.

Here's the summary:

| Wallet              | Low-$r$ | NONE | SINGLE | ANYONECANPAY variants |
| ------------------- | :-----: | :--: | :----: | :-------------------: |
| Ledger Nano S+      |    ✗    |  ✓   |   ✓    |           ✓           |
| BitBox02            |    ✗    |  ✗   |   ✗    |           ✗           |
| Foundation Passport |    ✗    |  ✗   |   ✗    |           ✗           |
| Trezor Safe 3       |    ✗    |  ✗   |   ✗    |           ✗           |
| Trezor Safe 5       |    ✗    |  ✗   |   ✗    |           ✗           |
| Coldcard Mk4        |    ✓    |  ✗   |   ✗    |           ✗           |
| Jade                |    ✓    |  ✗   |   ✗    |           ✗           |
| KeepKey             |    ✗    |  ✗   |   ✗    |           ✗           |
| Keystone 3 Pro      |    ✗    |  ✓   |   ✓    |           ✓           |
| SeedSigner          |    ✓    |  ✗   |   ✗    |           ✗           |

---

## What this means in practice

Hardware wallets are, in general, much harder to fingerprint than software wallets. The attack surface is small: no UTXO selection, no output ordering, no fee estimation — just a signature.

But "small" is not "zero." Low-$r$ grinding can split devices into two probabilistic buckets. SIGHASH support can immediately identify Ledger and Keystone users when non-standard flags appear. And anti-exfil wallets are distinguishable from the rest the moment you sign the same PSBT twice (in a lab).

None of these are definitive fingerprints in real-world conditions. But they're real, they persist on the blockchain forever, and they represent a privacy gap that nobody had formally characterized before.

Future work should combine hardware wallet signatures with the much richer fingerprinting signals from software wallets — fee rates, UTXO selection, change detection — to evaluate what's actually feasible for a blockchain observer trying to cluster transactions and break privacy.

---

_This post is based on joint work with [Jordi Herrera-Joancomartí](mailto:Jordi.Herrera@uab.cat) (UAB), partially supported by the SECURING/NET, SAFE-BLOCKCHAIN, DANGER, and AGAUR SGR2021-00643 projects._
