---
layout: post
title: Modifying the bdk_wallet Balance API for My Summer of Bitcoin Project
date: 2026-08-14
description: How I changed the way bdk_wallet decides which unconfirmed coins count as trusted, by following where the money came from instead of which keychain it landed on.
tags: ["Bitcoin", "BDK", "Rust", "Wallets", "Summer of Bitcoin", "Open Source"]
categories:
---

Let me start with a brief story.

Imagine you want to buy a Coke in a supermarket that accepts bitcoin. You just started using a wallet built on the BDK libraries, and half an hour ago someone sent you a few thousand sats. The transaction is still unconfirmed, but the balance says you can spend it.

So you grab the bottle, walk to the till, scan the QR code and... the payment fails. Not enough funds.

What happened is that the sender replaced their transaction with a higher-fee one ([RBF](https://bitcoinops.org/en/topics/replace-by-fee/)) that no longer pays you. The original never confirmed, so the coin you were about to spend never existed. The supermarket is fine, the network is fine, the sender did nothing the protocol forbids. The only thing that failed is how your wallet classified that coin.

That is what I worked on this summer for [Summer of Bitcoin](https://www.summerofbitcoin.org/): fixing how BDK decides which of your unconfirmed funds you can actually trust. It closes two long-standing bugs in bdk_wallet:

- [#16](https://github.com/bitcoindevkit/bdk_wallet/issues/16): the wallet trusted any unconfirmed coin that landed on its change keychain. But nothing stops a stranger from paying to a change address they spotted on-chain, and that money was counted as trusted even though the sender could still double-spend it.
- [#273](https://github.com/bitcoindevkit/bdk_wallet/issues/273): the mirror image. Consolidating your own coins into a receive address was marked untrusted, while the same transaction sent to a change address was trusted. Same wallet, same coins, different bucket.

## Not all balance is equal

BDK reports your balance as four numbers:

- Confirmed: money already in a block.
- Immature: freshly mined coins the protocol locks for 100 blocks.
- Trusted pending: unconfirmed money the wallet is fairly sure will go through.
- Untrusted pending: unconfirmed money someone else could still pull back.

The last two are the interesting ones. Pending means the transaction isn't in a block yet, so it could still be replaced before it confirms.

## Where the old logic went wrong

The old code decided trust from the keychain the money landed on. The whole rule was one closure:

```rust
|&(k, _), _| k == KeychainKind::Internal
```

That is: "did this land on a change address? then trust it." But it asks the wrong question. Trust has nothing to do with which of your addresses received the coin; it depends on where the money came from, and that is exactly the two ways the assumption breaks (#16 and #273).

## Trust comes from ancestry

So the wallet stops asking "whose address did this land on?" and starts asking "whose coins paid for it, all the way back?"

| Case | Condition | Why |
| ---- | --------- | --- |
| **Trusted** | The coin's whole unconfirmed history only spends coins you own | You made every one of those transactions, so no outsider can replace them |
| **Untrusted** | Somewhere in that history it pulls in coins that aren't yours | Whoever controls those coins can still replace the transaction |
| **Unknown** | The wallet can't see far enough back | A history you can't verify isn't safe, so it falls back to untrusted |

The supermarket coin now lands in the middle row, the honest answer. Getting there takes both layers of the library.

### In `bdk_chain` ([#2246](https://github.com/bitcoindevkit/bdk/pull/2246))

I added `classify_outpoints`, which labels each coin with its spend eligibility (settled, immature, or pending with its trust). It walks back through the transactions that funded a coin and stops as soon as it hits something confirmed or tainted, memoizing what it has seen so shared history is never walked twice. `balance` becomes a thin fold over this.

The chain layer doesn't decide what counts as tainted, or as final. It takes two predicates:

- `does_taint(&tx)`: should this transaction be considered tainted?
- `is_settled(&pos)`: do we consider this chain position final?

### In `bdk_wallet` ([#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431))

The wallet supplies the first: "taint a transaction if any input spends an output I don't own." That single rule produces the whole table. The wallet never reasons about ancestry itself, and never mentions keychains again. It folds `classify_outpoints` directly, which leaves room to add wallet-only categories on top without touching bdk_chain.

### Maturity is not settledness

I also split two ideas that had been tangled together: maturity (the protocol's 100-block wait on mined coins) and settledness (how many confirmations you personally want before treating money as final). They used to be one check; separating them is what makes a new `min_confirmations` option possible.

### A small primitive ([#2263](https://github.com/bitcoindevkit/bdk/pull/2263))

Out of the confirmation logic came `ChainPosition::blocks_since_conf`, which returns how many blocks sit on top of a confirmed position. A tiny helper that avoids the usual off-by-one, reused for confirmation thresholds and relative timelocks.

## Locked coins ([#538](https://github.com/bitcoindevkit/bdk_wallet/pull/538))

A confirmed coin can still be unspendable if its descriptor carries a timelock (`older`/CSV or `after`/CLTV) that hasn't matured. Today the balance counts it as confirmed, overstating what you can move, so I added a `locked` bucket. Because a timelock lives in the descriptor, which is a wallet concept, the check stays in the wallet: it folds `classify_outpoints` and routes a settled-but-still-locked output to `locked` instead of `confirmed`, keeping bdk_chain timelock-agnostic. Time-based locks (which need median-time-past) are left as a follow-up.

## Memories from a newbie in open-source contribution

Maybe the biggest lesson of the summer is that a good fix is rarely the *first* fix. This one went through several complete redesigns in review with the BDK maintainers and other contributors.

It started as a self-contained walk inside the wallet, then built on an earlier chain-layer effort ([#2235](https://github.com/bitcoindevkit/bdk/pull/2235)), and through discussion it ended up as a smaller, faster, memoized walk that only ever inspects your unconfirmed coins and their ancestors, so it doesn't get slower as your wallet history grows.

A lot of the value came from other people poking holes in the approach: performance concerns, edge cases like missing history, and questions about what "trust" should even mean. Contributing to open source is much less about writing the patch than about defending, breaking and rebuilding it in public.

## Where it stands

The core idea is in place:

> A wallet should trust a coin based on where it came from, not on where it landed.

#2246 has an ACK and is essentially done, pending final approval; #2263 is open; #431 stays a draft until #2246 ships in a `bdk_chain` release; #538 (locked) sits on top of #431 and is gated the same way. Next up are time-based timelocks and a future frozen/reserved category for coins you lock manually.

## What else?

The PRs and issues behind this project:

- [bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431) was my first attempt, a walk directly in the wallet, later reworked to delegate to the chain walk once #2246 existed, and gained `min_confirmations`.
- [bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246) is the ancestry-based trust and eligibility in `bdk_chain`, which then sent me back to rework #431 on top of it.
- [bdk#2263](https://github.com/bitcoindevkit/bdk/pull/2263) is the `blocks_since_conf` primitive.
- [bdk_wallet#538](https://github.com/bitcoindevkit/bdk_wallet/pull/538) is the `locked` balance category.

The issues that framed the work: [#16](https://github.com/bitcoindevkit/bdk_wallet/issues/16) and [#273](https://github.com/bitcoindevkit/bdk_wallet/issues/273) (the trust bugs), [#180](https://github.com/bitcoindevkit/bdk_wallet/issues/180) (locked coins), and [#183](https://github.com/bitcoindevkit/bdk_wallet/issues/183) (median-time-past, needed for time-based timelocks).

<sub>*Thanks to [nymius](https://github.com/nymius) for mentoring me through all of this, and to [Evan](https://github.com/evanlinjin) for the groundwork in [#2235](https://github.com/bitcoindevkit/bdk/pull/2235) and for sitting through round after round of review.*</sub>
