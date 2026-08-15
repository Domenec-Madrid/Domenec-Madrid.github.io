---
layout: post
title: Modifying the bdk_wallet Balance API for My Summer of Bitcoin Project
date: 2026-08-14
description: How I changed the way bdk_wallet decides which unconfirmed coins count as trusted, by following where the money came from instead of which keychain it landed on.
tags: ["Bitcoin", "BDK", "Rust", "Wallets", "Summer of Bitcoin", "Open Source"]
categories:
---

Let me start with a brief story in this post.

Imagine you want to buy a Coke in a supermarket, one of those that accepts bitcoin as payment. You just started using a wallet built on the BDK libraries, and half an hour ago someone sent you a few thousand sats. The transaction is still unconfirmed, but the balance says you can spend it.

So you grab the bottle, walk to the till, scan the QR code and... the payment fails. Not enough funds.

What happened in between is that the sender replaced their transaction with a higher-fee one ([RBF](https://bitcoinops.org/en/topics/replace-by-fee/)) that no longer pays you anything. The original never confirmed, so the coin you were about to spend simply never existed. The supermarket is fine, the network is fine, the sender did nothing the protocol forbids. The only thing that failed is how your wallet classified that coin.

Which brings us to the most basic thing a wallet does: telling you your balance. It sounds trivial, but *"how much do I have?"* doesn't have a single answer, and every wallet draws the line somewhere different. [BDK](https://bitcoindevkit.org) chooses to split it into four buckets, and deciding which coin belongs to which turns out to be surprisingly subtle.

This summer, as part of [Summer of Bitcoin](https://www.summerofbitcoin.org/), I've been working on exactly that: fixing how BDK decides which of your unconfirmed funds you can actually trust. The work closes two long-standing bugs in bdk_wallet:

- [**#16**](https://github.com/bitcoindevkit/bdk_wallet/issues/16) — the wallet trusted any unconfirmed coin that landed on its **change** keychain. But nothing stops a stranger from paying to a change address they spotted on-chain, and that money was counted as trusted even though the sender could still double-spend it.
- [**#273**](https://github.com/bitcoindevkit/bdk_wallet/issues/273) — the mirror image. Consolidating your own coins into one of your **receive** addresses was marked untrusted, while the exact same transaction sent to a change address was trusted. Same wallet, same coins, different bucket.

The fix spans two pull requests, one in the chain layer ([bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246)) and one in the wallet layer ([bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431)).

Let's start with the basics ;)

---

## Not all balance is equal

BDK reports your balance as four separate numbers:

- **Confirmed** — money in transactions that are already in a block.
- **Immature** — recently mined coins that the protocol won't let you spend yet, since a mining reward has to wait 100 blocks.
- **Trusted pending** — unconfirmed money the wallet is fairly sure will go through.
- **Untrusted pending** — unconfirmed money that someone else could still pull back.

Other wallets slice this differently, some show a single number, some only separate confirmed from unconfirmed, but the last two buckets are the interesting ones here.

*Pending* means the transaction isn't in a block yet, so it could still be replaced or double-spent before it confirms.  

---

## Where the old logic went wrong

The previous implementation decided trust by looking at the **keychain** the money landed on. The whole rule was one closure:

```rust
|&(k, _), _| k == KeychainKind::Internal
```

In other words: *"did this land on a change address? then trust it."* The reasoning being that change addresses are where your own transactions send money back to you.

That sounds reasonable, but it's asking the wrong question. Whether you can trust an unconfirmed coin has nothing to do with which of your addresses it landed on. It depends on **where the money came from**, and the two bugs are the two ways that assumption breaks:

- Change addresses aren't private. Anyone watching the chain can spot yours and pay to one, and the rule waved that payment straight through (**#16**).
- Your own transactions don't always pay to change. Consolidate into a receive address and the rule flagged your own money as if a stranger might snatch it back (**#273**).

---

## Ancestry based solution

So the wallet stops asking *"whose address did this land on?"* and starts asking *"whose coins paid for it, all the way back?"*

| Case | Condition | Why |
| ---- | --------- | --- |
| **Trusted** | The coin's entire unconfirmed history only spends coins you already own | You made every one of those transactions, so no outsider can replace them |
| **Untrusted** | Somewhere in that unconfirmed history it pulls in coins that aren't yours | Whoever controls those coins can still replace the transaction |
| **Unknown** | The wallet can't see far enough back, e.g. a parent transaction it never downloaded | A history you can't verify isn't a safe one, so it falls back to untrusted |

The coin from the supermarket now lands in the middle row, which is exactly the honest answer, and the one that would have saved you the walk to the till.

Answering that question takes both layers of the library.

### In `bdk_chain`

I added `classify_outpoints`, which labels every one of your coins with its spend eligibility: *settled*, *immature*, *trusted pending* or *untrusted pending*. It walks back through the transactions that funded a coin and stops as soon as it reaches something confirmed or something tainted, remembering what it has already seen so shared history is never walked twice. `balance` then becomes a thin fold over this classification.

Crucially, the chain layer doesn't decide what counts as tainted, or as final. It takes two predicates, one per concern:

- `does_taint(&tx)` — should this transaction be considered tainted?
- `is_settled(&pos)` — do we consider this chain position final?

### In `bdk_wallet`

The wallet supplies the first one, *"taint a transaction if any of its inputs spends an output I don't own"*. That single rule, applied along the walk, is what produces the whole table above. The wallet never has to reason about ancestry itself, and it never has to mention keychains again.

It also folds `classify_outpoints` directly instead of calling the chain's `balance`. Same result, but it leaves room to layer wallet-specific categories (locked or reserved coins, for instance) on top without touching bdk_chain.

### Maturity is not settledness

Along the way I also separated two ideas that had been tangled together:

- **Maturity** — I think this one is clear.
- **Settledness** — how many confirmations *you personally* want before treating money as final. Entirely your call.

They used to be the same check, and now they aren't, which is what makes the new option to require a minimum number of confirmations possible.

---

## Memories from a newbie in open-source contribution

Maybe the biggest lesson of the summer is that a good fix is rarely the *first* fix. This one went through several complete redesigns in review with the BDK maintainers and other contributors.

It started as a self-contained walk inside the wallet, then took over an earlier attempt in the chain layer ([bdk#2235](https://github.com/bitcoindevkit/bdk/pull/2235)), and through discussion it ended up as a smaller, faster, memoized walk that only ever inspects your unconfirmed coins and their ancestors, so it doesn't get slower as your wallet history grows.

A lot of the value came from other people poking holes in the approach. Performance concerns, edge cases like missing history, and questions about what "trust" should even mean. Contributing to open source is much less about writing the patch than about defending, breaking and rebuilding it in public.

---

## Where it stands

Both pull requests are still open and moving through review: [bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246) in the chain layer and [bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431) in the wallet. There are threads still to settle, naming, and exactly how the minimum confirmations should behave, but the core idea is in place:

> A wallet should trust a coin based on where it came from, not on where it landed.

Stay tuned, I'll update this post once everything is merged!

<sub>*Thanks to [Nymius](https://github.com/nymius) for mentoring me through all of this, and to [Evan](https://github.com/evanlinjin) for the groundwork in [bdk#2235](https://github.com/bitcoindevkit/bdk/pull/2235) and for sitting through round after round of review.*</sub>
