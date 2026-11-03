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
spans the chain layer ([bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246), plus the
small `blocks_since_conf` primitive in [bdk#2263](https://github.com/bitcoindevkit/bdk/pull/2263))
and the wallet layer ([bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431)),
and it added a new `locked` balance category for coins whose descriptor timelock has not
matured yet ([bdk_wallet#538](https://github.com/bitcoindevkit/bdk_wallet/pull/538)).

Both chain-layer pull requests were merged into `bdk` in September 2026 and featured in
[Bitcoin Optech](https://bitcoinops.org/en/newsletters/2026/09/18/). The two wallet-layer
pull requests stay open as drafts until a `bdk_chain` release ships the new API.

<div class="mt-4">
  <a href="{{ '/blog/2026/bdk-wallet-balance-api/' | relative_url }}" class="btn btn-sm btn-primary">
    Read the full write-up
  </a>
</div>
