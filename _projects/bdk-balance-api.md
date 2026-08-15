---
layout: page
title: BDK Balance API
description: Summer of Bitcoin work on how a wallet decides which coins to trust
img:
importance: 4
category: work
github: https://github.com/bitcoindevkit/bdk_wallet
---

Telling you your balance is the most basic thing a Bitcoin wallet does, and also one of
the subtlest. Unconfirmed money can still be replaced or double-spent, so a wallet has to
decide which pending coins it is willing to present as spendable.

[BDK](https://bitcoindevkit.org) used to answer that by looking at which of your keychains
the money landed on: anything arriving on a change address was trusted. That rule breaks in
both directions, and it produced two long-standing bugs
([bdk_wallet#16](https://github.com/bitcoindevkit/bdk_wallet/issues/16) and
[bdk_wallet#273](https://github.com/bitcoindevkit/bdk_wallet/issues/273)) pointing in
opposite ways.

As part of [Summer of Bitcoin](https://www.summerofbitcoin.org/) I replaced it with an
ancestry-based classification: a coin is trusted when its entire unconfirmed history only
spends coins you already own, and tainted as soon as it pulls in somebody else's. The work
spans the chain layer ([bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246)) and the
wallet layer ([bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431)).

<div class="mt-4">
  <a href="{{ '/blog/2026/bdk-wallet-balance-api/' | relative_url }}" class="btn btn-sm btn-primary">
    Read the full write-up
  </a>
</div>