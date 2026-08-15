---
layout: page
title: Hardware Wallet Fingerprinting
description: Can a Bitcoin signature reveal which device produced it?
img:
importance: 2
category: work
---

Wallet fingerprinting is the practice of identifying which wallet created a particular
transaction. Software wallets are relatively well studied here, they differ in how they
select UTXOs, order inputs and outputs or estimate fees. Hardware wallets, on the other
hand, had received almost no attention, largely because they are assumed to be
interchangeable signing boxes that all produce the same kind of signature.

This project set out to test that assumption. Ten devices were initialised with the same
BIP-39 seed phrase, connected through [Sparrow Wallet](https://sparrowwallet.com/) (or
their official companion app where Sparrow was not supported), and asked to sign the same
PSBT repeatedly. The resulting ECDSA and Schnorr signatures were then compared looking for
anything that distinguishes one manufacturer from another.

The work was presented at **RECSI 2026** in Tenerife.

<div class="mt-4">
  <a href="{{ '/blog/2026/hww-fingerprinting/' | relative_url }}" class="btn btn-sm btn-primary">
    Read the full write-up
  </a>
</div>