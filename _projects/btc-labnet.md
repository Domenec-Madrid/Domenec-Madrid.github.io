---
layout: page
title: BTC-Labnet
description: A fully dockerized parallel Bitcoin mainnet for research
img:
importance: 3
category: work
github: https://github.com/Dmenec/BTC-Labnet
---

Testnet and regtest are the usual answer when you need a Bitcoin network you can break
safely, but many wallets, and hardware wallets in particular, offer limited or no support
for them. That makes them a poor environment for studying how real wallets behave.

BTC-Labnet takes a different route. It is built directly from the original Bitcoin Core
source code and shares the genesis block with the real network, but it runs in complete
isolation from public mainnet. Wallets connect to it believing they are on mainnet, which
means their behaviour can be observed exactly as it would be in production, with zero-cost
transactions and full control over the chain.

It was built to support research on wallet fingerprinting and address clustering, where
being able to drive real devices through real mainnet-looking transactions was the whole
point.

<div class="mt-4">
  <a href="{{ '/blog/2025/byom/' | relative_url }}" class="btn btn-sm btn-primary">
    Read the full write-up
  </a>
  <a href="https://github.com/Dmenec/BTC-Labnet" class="btn btn-sm btn-secondary">
    Source on GitHub
  </a>
</div>