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

## BDK Balance

BDK reports your balance as four numbers:

- **Confirmed**: money already in a block.
- **Immature**: freshly mined coins the protocol locks for 100 blocks.
- **Trusted pending**: unconfirmed money the wallet is fairly sure will go through.
- **Untrusted pending**: unconfirmed money someone else could still pull back.

The last two are the interesting ones. Pending means the transaction isn't in a block yet, so it could still be replaced before it confirms.

### Old Logic

The old code decided trust from the keychain the coins landed on. The whole rule was one closure:

```rust
|&(k, _), _| k == KeychainKind::Internal
```

Which means: "did this land on a change address? then trust it."  

The point here is that trust has nothing to do with which of your addresses received the coin. It depends on where the money came from, so the correct approach would be to check who actually sent these coins.  

### Ancestry-Based Trust

To classify the coins correctly, that classification should be determined by the ancestry of the coin.

The main assumption would be: *only trust owned inputs*.  

| Case | Condition | Why |
| ---- | --------- | --- |
| **Trusted** | The coin's whole unconfirmed history only spends coins you own | You made every one of those transactions, so no outsider can replace them |
| **Untrusted** | Somewhere in that history it pulls in coins that aren't yours | Whoever controls those coins can still replace the transaction |
| **Unknown** | The wallet can't see far enough back | A history you can't verify isn't safe, so it falls back to untrusted |

<div class="demo-block" id="bt-slides" tabindex="0" aria-roledescription="carousel" aria-label="Old and new trust rule, explained with Alice and Bob">
    <svg class="bt-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <g id="bt-alice">
          <circle cx="20" cy="12" r="10"/>
          <path d="M20 22 V48 M4 32 H36 M20 48 L8 70 M20 48 L32 70 M9 9 Q3 22 8 31 M31 9 Q37 22 32 31"/>
        </g>
        <g id="bt-bob">
          <circle cx="20" cy="12" r="10"/>
          <path d="M20 22 V48 M4 32 H36 M20 48 L8 70 M20 48 L32 70 M7 3 H33 M13 3 V-6 H27 V3"/>
        </g>
        <!-- Rules with an ancestor in the selector don't reach <use> copies, so these carry their own styles. -->
        <g id="bt-coin">
          <circle r="14"/>
          <text y="5.5" style="stroke: none; fill: currentColor; font-size: 16px; font-weight: 600; text-anchor: middle;">₿</text>
        </g>
        <g id="bt-wallet">
          <text x="535" y="22" style="stroke: none; fill: var(--global-text-color-light); font-size: 16px; text-anchor: middle;">Alice's wallet</text>
          <rect x="450" y="32" width="170" height="200" rx="10" style="stroke: var(--demo-quiet);"/>
          <rect x="465" y="48" width="140" height="76" rx="6" style="stroke: var(--demo-quiet);"/>
          <rect x="465" y="140" width="140" height="76" rx="6" style="stroke: var(--demo-quiet);"/>
          <text x="474" y="65" style="stroke: none; fill: var(--global-text-color-light); font-size: 14px;">receive</text>
          <text x="474" y="157" style="stroke: none; fill: var(--global-text-color-light); font-size: 14px;">change</text>
        </g>
      </defs>
    </svg>

    <div class="bt-stage">
      <div class="bt-slide is-active">
        <div class="bt-kicker">Old rule</div>
        <div class="bt-title">Trust depends on the drawer</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="An unknown sender pays into either drawer of Alice's wallet. The receive drawer is stamped untrusted and the change drawer is stamped trusted.">
          <use href="#bt-wallet"/>
          <use href="#bt-bob" class="bt-fig bt-anyone" x="40" y="105"/>
          <text class="bt-t bt-t--light" x="60" y="197" text-anchor="middle">anyone</text>
          <path class="bt-line" d="M95 141 H300 M300 95 V187 M300 95 H459 m-8 -5 l8 5 l-8 5 M300 187 H459 m-8 -5 l8 5 l-8 5"/>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="95"/>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="187"/>
          <g class="bt-stamp bt-bad" transform="translate(672 95) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">UNTRUSTED</text></g>
          <g class="bt-stamp bt-ok" transform="translate(672 187) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">TRUSTED</text></g>
        </svg>
        <div class="bt-cap">Alice's wallet has two drawers: <strong>receive</strong> addresses she hands out, and <strong>change</strong> addresses the wallet uses for itself. The old rule only looked at which drawer an unconfirmed coin landed in. It never asked who sent it.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker">Old rule · bug #16</div>
        <div class="bt-title">Bob pays into the change drawer</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="Bob sends an unconfirmed transaction to one of Alice's change addresses. The old rule stamps the coin as trusted.">
          <use href="#bt-wallet"/>
          <use href="#bt-bob" class="bt-fig bt-bob" x="40" y="151"/>
          <text class="bt-t" x="60" y="243" text-anchor="middle">Bob</text>
          <text class="bt-t bt-t--small" x="160" y="176" text-anchor="middle">his coins</text>
          <path class="bt-line" d="M95 187 H224 m-8 -5 l8 5 l-8 5 M335 187 H459 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-line bt-dashed" x="230" y="165" width="100" height="44" rx="6"/>
          <text class="bt-t" x="280" y="192" text-anchor="middle">tx</text>
          <text class="bt-t bt-t--small" x="280" y="228" text-anchor="middle">unconfirmed</text>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="187"/>
          <text class="bt-t bt-t--small" x="672" y="163" text-anchor="middle">old rule</text>
          <g class="bt-stamp bt-ok" transform="translate(672 187) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">TRUSTED</text></g>
        </svg>
        <div class="bt-cap">Change addresses show up on-chain like any other, so nothing stops Bob from paying one. The old rule sees "change" and counts the coin as <strong>trusted</strong>, even though Alice had no part in the transaction.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker">Old rule · bug #16</div>
        <div class="bt-title">Bob takes it back</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="Bob replaces his transaction with one that pays himself. The original is crossed out and the coin in Alice's change drawer disappears.">
          <use href="#bt-wallet"/>
          <use href="#bt-bob" class="bt-fig bt-bob" x="40" y="151"/>
          <text class="bt-t" x="60" y="243" text-anchor="middle">Bob</text>
          <text class="bt-t bt-t--small" x="200" y="64" text-anchor="middle">replacement, higher fee</text>
          <path class="bt-line" d="M60 138 V97 H144 m-8 -5 l8 5 l-8 5 M255 97 H298 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-line" x="150" y="75" width="100" height="44" rx="6"/>
          <text class="bt-t" x="200" y="102" text-anchor="middle">tx'</text>
          <use href="#bt-coin" class="bt-fig bt-bob" x="318" y="97"/>
          <text class="bt-t bt-t--small" x="340" y="102">Bob's again</text>
          <path class="bt-quiet bt-dashed" d="M95 187 H224 M335 187 H459"/>
          <rect class="bt-quiet bt-dashed" x="230" y="165" width="100" height="44" rx="6"/>
          <text class="bt-t bt-t--light" x="280" y="192" text-anchor="middle">tx</text>
          <path class="bt-cross" d="M240 171 L320 203 M320 171 L240 203"/>
          <circle class="bt-quiet bt-dashed" cx="535" cy="187" r="14"/>
          <path class="bt-cross" d="M523 175 L547 199 M547 175 L523 199"/>
          <g class="bt-stamp bt-bad" transform="translate(672 187) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">GONE</text></g>
        </svg>
        <div class="bt-cap">Bob signed the transaction, so Bob can replace it (RBF) with one that pays himself. The original never confirms and the coin vanishes. Alice's "trusted" balance was money she never had: that is the Coke at the till.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker">Old rule · bug #273</div>
        <div class="bt-title">Alice pays herself, and isn't trusted</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="Alice sends her own coins to one of her receive addresses. The old rule stamps the coin as untrusted.">
          <use href="#bt-wallet"/>
          <use href="#bt-alice" class="bt-fig bt-alice" x="40" y="59"/>
          <text class="bt-t" x="60" y="151" text-anchor="middle">Alice</text>
          <text class="bt-t bt-t--small" x="160" y="84" text-anchor="middle">her coins</text>
          <path class="bt-line" d="M95 95 H224 m-8 -5 l8 5 l-8 5 M335 95 H459 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-line bt-dashed" x="230" y="73" width="100" height="44" rx="6"/>
          <text class="bt-t" x="280" y="100" text-anchor="middle">tx</text>
          <text class="bt-t bt-t--small" x="280" y="136" text-anchor="middle">unconfirmed</text>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="95"/>
          <text class="bt-t bt-t--small" x="672" y="71" text-anchor="middle">old rule</text>
          <g class="bt-stamp bt-bad" transform="translate(672 95) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">UNTRUSTED</text></g>
        </svg>
        <div class="bt-cap">Now the opposite mistake. Alice consolidates her own coins into one of her receive addresses. Only she can sign a replacement, so this is as safe as an unconfirmed coin gets. The old rule sees "receive" and calls it <strong>untrusted</strong>.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker bt-kicker--new">New rule</div>
        <div class="bt-title">Ask who funded it</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="The wallet walks back from the coin to the transaction that funded it and finds only Alice's coins. The coin is stamped trusted.">
          <use href="#bt-wallet"/>
          <use href="#bt-alice" class="bt-fig bt-alice" x="40" y="59"/>
          <text class="bt-t" x="60" y="151" text-anchor="middle">Alice</text>
          <text class="bt-t bt-t--small" x="160" y="84" text-anchor="middle">her coins</text>
          <path class="bt-line" d="M95 95 H224 m-8 -5 l8 5 l-8 5 M335 95 H459 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-line bt-dashed" x="230" y="73" width="100" height="44" rx="6"/>
          <text class="bt-t" x="280" y="100" text-anchor="middle">tx</text>
          <path class="bt-walk bt-ok" d="M447 116 C 390 185, 190 185, 104 126"/>
          <path class="bt-walk-head bt-ok" d="M108 136 L104 126 L115 126"/>
          <text class="bt-t bt-t--small bt-ok" x="275" y="196" text-anchor="middle">walk back: only Alice's coins</text>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="95"/>
          <text class="bt-t bt-t--small" x="672" y="71" text-anchor="middle">new rule</text>
          <g class="bt-stamp bt-ok" transform="translate(672 95) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">TRUSTED</text></g>
        </svg>
        <div class="bt-cap">The new rule ignores the drawer. The wallet walks back through the coin's unconfirmed history, and if every input along the way is Alice's, nobody else can replace anything. <strong>Trusted</strong>, whichever drawer it landed in.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker bt-kicker--new">New rule</div>
        <div class="bt-title">One input from Bob taints what follows</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="Bob pays Alice in transaction A, and Alice spends that coin to her change drawer in transaction B. The walk back reaches Bob's transaction and the coin is stamped untrusted.">
          <use href="#bt-wallet"/>
          <use href="#bt-bob" class="bt-fig bt-bob" x="16" y="151"/>
          <text class="bt-t" x="36" y="243" text-anchor="middle">Bob</text>
          <path class="bt-line" d="M70 187 H114 m-8 -5 l8 5 l-8 5 M195 187 H230 m-8 -5 l8 5 l-8 5 M272 187 H309 m-8 -5 l8 5 l-8 5 M390 187 H459 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-line bt-dashed bt-bad" x="120" y="165" width="70" height="44" rx="6"/>
          <text class="bt-t" x="155" y="192" text-anchor="middle">tx A</text>
          <text class="bt-t bt-t--small bt-bad" x="155" y="228" text-anchor="middle">Bob can replace</text>
          <use href="#bt-coin" class="bt-fig bt-alice" x="251" y="187"/>
          <rect class="bt-line bt-dashed" x="315" y="165" width="70" height="44" rx="6"/>
          <text class="bt-t" x="350" y="192" text-anchor="middle">tx B</text>
          <text class="bt-t bt-t--small" x="350" y="228" text-anchor="middle">Alice signed</text>
          <path class="bt-walk bt-bad" d="M447 166 C 400 95, 220 95, 160 156"/>
          <path class="bt-walk-head bt-bad" d="M171 153 L160 156 L163 145"/>
          <text class="bt-t bt-t--small bt-bad" x="300" y="98" text-anchor="middle">walk back: finds Bob</text>
          <use href="#bt-coin" class="bt-fig bt-alice" x="535" y="187"/>
          <text class="bt-t bt-t--small" x="672" y="163" text-anchor="middle">new rule</text>
          <g class="bt-stamp bt-bad" transform="translate(672 187) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">UNTRUSTED</text></g>
        </svg>
        <div class="bt-cap">Bob pays Alice (tx A), then Alice moves that coin to her own change (tx B). Tx B is all hers, but it stands on tx A, and if Bob replaces A then B falls with it. The walk reaches Bob's input and marks the coin <strong>untrusted</strong>. A history the wallet can't see gets the same answer.</div>
      </div>

      <div class="bt-slide">
        <div class="bt-kicker bt-kicker--new">Old vs new</div>
        <div class="bt-title">Same coins, right buckets</div>
        <svg viewBox="0 0 730 250" role="img" aria-label="Summary. Bob paying Alice's change address: the old rule said trusted, the new rule says untrusted. Alice paying her own receive address: the old rule said untrusted, the new rule says trusted.">
          <text class="bt-t bt-t--small" x="420" y="18" text-anchor="middle">old rule</text>
          <text class="bt-t bt-t--small" x="610" y="18" text-anchor="middle">new rule</text>
          <use href="#bt-bob" class="bt-fig bt-bob" x="30" y="32"/>
          <text class="bt-t" x="50" y="124" text-anchor="middle">Bob</text>
          <path class="bt-line" d="M85 68 H164 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-quiet" x="170" y="48" width="120" height="40" rx="6"/>
          <text class="bt-t" x="230" y="73" text-anchor="middle">change</text>
          <g class="bt-stamp bt-ok bt-old" transform="translate(420 68) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">TRUSTED</text><path d="M-52 0 H52"/></g>
          <g class="bt-stamp bt-bad" transform="translate(610 68) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">UNTRUSTED</text></g>
          <use href="#bt-alice" class="bt-fig bt-alice" x="30" y="142"/>
          <text class="bt-t" x="50" y="234" text-anchor="middle">Alice</text>
          <path class="bt-line" d="M85 178 H164 m-8 -5 l8 5 l-8 5"/>
          <rect class="bt-quiet" x="170" y="158" width="120" height="40" rx="6"/>
          <text class="bt-t" x="230" y="183" text-anchor="middle">receive</text>
          <g class="bt-stamp bt-bad bt-old" transform="translate(420 178) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">UNTRUSTED</text><path d="M-52 0 H52"/></g>
          <g class="bt-stamp bt-ok" transform="translate(610 178) rotate(-5)"><rect x="-44" y="-14" width="88" height="28" rx="5"/><text y="5">TRUSTED</text></g>
        </svg>
        <div class="bt-cap">The old rule got both cases backwards because the drawer says nothing about who can still replace the transaction. Following the money does: Bob's payment is <strong>untrusted</strong> until it confirms, and Alice's own coins are <strong>trusted</strong> wherever she sends them.</div>
      </div>
    </div>

    <div class="bt-nav">
      <button type="button" class="bt-btn" data-step="-1" aria-label="Previous slide">&larr;</button>
      <div class="bt-dots"></div>
      <span class="bt-count" aria-live="polite"></span>
      <button type="button" class="bt-btn" data-step="1" aria-label="Next slide">&rarr;</button>
    </div>
</div>

<style>
#bt-slides { outline: none; }
#bt-slides .bt-defs { position: absolute; }
#bt-slides .bt-slide { margin-bottom: 2rem; }
#bt-slides.is-ready .bt-stage { display: grid; }
#bt-slides.is-ready .bt-slide { grid-area: 1 / 1; margin: 0; visibility: hidden; opacity: 0; transition: opacity 0.2s; }
#bt-slides.is-ready .bt-slide.is-active { visibility: visible; opacity: 1; }
#bt-slides .bt-kicker { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--demo-pad); }
#bt-slides .bt-kicker--new { color: var(--demo-s); }
#bt-slides .bt-title { font-size: 1.15rem; font-weight: 600; margin: 0.15rem 0 0.8rem; }
#bt-slides .bt-slide svg { display: block; width: 100%; height: auto; }
#bt-slides .bt-cap { margin-top: 0.9rem; font-size: 0.9rem; line-height: 1.6; }

#bt-slides svg * { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#bt-slides .bt-line { stroke: var(--global-text-color); }
#bt-slides .bt-quiet { stroke: var(--demo-quiet); }
#bt-slides .bt-dashed { stroke-dasharray: 5 5; }
#bt-slides .bt-cross { stroke: var(--demo-pad); stroke-width: 3; }
#bt-slides .bt-fig { stroke: currentColor; stroke-width: 2.5; }
#bt-slides .bt-alice { color: var(--demo-r); }
#bt-slides .bt-bob { color: var(--global-text-color); }
#bt-slides .bt-anyone { color: var(--demo-quiet); }
#bt-slides .bt-ok { color: var(--demo-s); }
#bt-slides .bt-bad { color: var(--demo-pad); }
#bt-slides rect.bt-bad { stroke: var(--demo-pad); }
#bt-slides .bt-walk { stroke: currentColor; stroke-dasharray: 2 6; }
#bt-slides .bt-walk-head { stroke: currentColor; }
#bt-slides svg text { stroke: none; fill: var(--global-text-color); font-family: inherit; font-size: 16px; }
#bt-slides svg text.bt-t--small { font-size: 14px; fill: var(--global-text-color-light); }
#bt-slides svg text.bt-t--light { fill: var(--global-text-color-light); }
#bt-slides svg text.bt-ok, #bt-slides svg text.bt-bad { fill: currentColor; }
#bt-slides .bt-stamp rect { stroke: currentColor; }
#bt-slides .bt-stamp text { fill: currentColor; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-anchor: middle; }
#bt-slides .bt-stamp path { stroke: var(--global-text-color); }
#bt-slides .bt-old { opacity: 0.55; }

#bt-slides .bt-nav { display: none; align-items: center; gap: 0.9rem; margin-top: 1.3rem; }
#bt-slides.is-ready .bt-nav { display: flex; }
#bt-slides .bt-btn { padding: 0.3rem 0.9rem; border: 1px solid var(--demo-rule); border-radius: 6px; background: transparent;
  color: var(--global-text-color); font-size: 1rem; line-height: 1.3; cursor: pointer; }
#bt-slides .bt-btn:hover:not(:disabled) { background: var(--demo-surface); }
#bt-slides .bt-btn:disabled { opacity: 0.35; cursor: default; }
#bt-slides .bt-dots { display: flex; flex: 1 1 auto; justify-content: center; gap: 0.5rem; }
#bt-slides .bt-dot { width: 0.6rem; height: 0.6rem; padding: 0; border: 0; border-radius: 50%; background: var(--demo-quiet);
  opacity: 0.4; cursor: pointer; }
#bt-slides .bt-dot.is-active { background: var(--demo-r); opacity: 1; }
#bt-slides .bt-count { font-size: 0.75rem; color: var(--global-text-color-light); font-variant-numeric: tabular-nums; }
</style>

<script>
(function () {
  var root = document.getElementById('bt-slides');
  var slides = root.querySelectorAll('.bt-slide');
  var buttons = root.querySelectorAll('.bt-btn');
  var dots = root.querySelector('.bt-dots');
  var count = root.querySelector('.bt-count');
  var current = 0;

  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === current); });
    dots.querySelectorAll('.bt-dot').forEach(function (d, n) { d.classList.toggle('is-active', n === current); });
    buttons[0].disabled = current === 0;
    buttons[1].disabled = current === slides.length - 1;
    count.textContent = (current + 1) + ' / ' + slides.length;
  }

  slides.forEach(function (_, n) {
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'bt-dot';
    d.setAttribute('aria-label', 'Go to slide ' + (n + 1));
    d.addEventListener('click', function () { show(n); });
    dots.appendChild(d);
  });
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { show(current + parseInt(b.dataset.step, 10)); });
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { show(current - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(current + 1); e.preventDefault(); }
  });

  // Swipe on touch screens.
  var startX = null;
  root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    startX = null;
  }, { passive: true });

  root.classList.add('is-ready');
  show(0);
})();
</script>

That was difficult on two counts: first to arrive at this idea, and second to actually implement it in the code. We thought it could be a good idea to have it folded in the wallet, but we noticed there were some useful primitives to perform the walk in chain. Unfortunately we could not use them, so we ended up doing something "totally aside" from the project: a new API in `bdk_chain` that let us run complex closures over the chain's balance function, erasing generics and giving a clearer API to work with.

Next I'll explain every change I made in the chain layer and the wallet layer.

#### In `bdk_chain` ([#2246](https://github.com/bitcoindevkit/bdk/pull/2246))

I added `classify_outpoints`, which labels each coin with its spend eligibility. It walks back through the transactions that funded a coin and stops as soon as it hits something confirmed or tainted, memoizing what it has seen so shared history is never walked twice.  

Eligibility is the vocabulary that walk speaks. Every unspent output comes back as one of three things: `Settled`, when its chain position satisfies `is_settled`; `Immature`, when it is a coinbase output that has not aged its 100 blocks; or `Unsettled(Trust)`, when it is still pending. That last one carries the verdict from the ancestry walk, `Trust::Trusted` when the whole unconfirmed history is yours and `Trust::Untrusted` when anything in it is tainted or missing. Balance stops being a special case and becomes a tally over those labels, which is what leaves room for new buckets later.

The chain layer doesn't decide what counts as tainted, or as final. It takes two predicates:

- `does_taint(&tx)`: should this transaction be considered tainted?
- `is_settled(&pos)`: do we consider this chain position final?

Both of them replace something that was there before. `balance` used to take a `trust_predicate` and a `min_confirmations` number. The old predicate only saw an output's keychain and index, so it could tell you where a coin landed but never where it came from. `does_taint` takes the whole transaction instead, which is what makes it possible to look at the inputs. `min_confirmations` used to be a fixed number too.

While I was in there I also took a generic out. `balance` used to work over `(identifier, outpoint)` pairs, which dragged a type parameter through the signature without buying much, and it now takes plain `OutPoint`s. Together with the memoization, which guarantees `does_taint` runs at most once per transaction no matter how many of your coins trace back through it, the function ended up both simpler to call and cheaper to run than the one I set out to patch.

##### A Small Primitive ([#2263](https://github.com/bitcoindevkit/bdk/pull/2263))

Out of the confirmation logic came `ChainPosition::blocks_since_conf`, which returns how many blocks sit on top of a confirmed position. A tiny helper that avoids the usual off-by-one, reused for confirmation thresholds and relative timelocks.

#### In `bdk_wallet` ([#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431))

The wallet is the only layer that knows which coins are yours, so it is the one that supplies `does_taint`. Its rule is one line: a transaction is tainted if any of its inputs spends an output that none of the wallet's descriptors produced.

`Wallet::balance` takes a `min_confirmations` argument now, and that is the breaking part of the signature. Before counting anything, BDK has to pick which of several competing versions of a transaction is the canonical one, and that decision now starts from `tip - min_confirmations` instead of from the chain tip. A coin that has not cleared your threshold is therefore not treated as confirmed at any point, including when the ancestry walk is deciding whether it can stop.

Finally, the wallet folds `classify_outpoints` itself rather than calling `bdk_chain`'s `balance`. The numbers come out the same, but folding it here means the wallet can add buckets that mean nothing to the chain layer, which is exactly what the next pull request needed.

##### Locked coins ([#538](https://github.com/bitcoindevkit/bdk_wallet/pull/538))

A confirmed coin can still be unspendable if its descriptor carries a timelock that has not matured yet, and until now the balance counted it as `confirmed` and overstated what you could actually move. So there is a `locked` bucket now, and `Wallet::balance` returns a `WalletBalance` to carry it.

A timelock lives in the descriptor, which is a wallet concept, so the check stays in the wallet. It folds `classify_outpoints` and reroutes the outputs that hold to `locked`, leaving `bdk_chain` timelock-agnostic.

Two limits worth saying out loud. Only height-based locks are handled, because time-based ones need median-time-past and BDK does not track it yet ([#183](https://github.com/bitcoindevkit/bdk_wallet/issues/183)). And a descriptor with several spending paths gets a default satisfaction rather than a full policy analysis, so a coin that is spendable through some other branch can still show up as locked.

## Memories from a newbie in open-source contribution

Maybe the biggest lesson of the summer is that a good fix is rarely the *first* fix. This one went through several complete redesigns in review with the BDK maintainers and other contributors.

It started as a self-contained walk inside the wallet, then built on an earlier chain-layer effort ([#2235](https://github.com/bitcoindevkit/bdk/pull/2235)), and through discussion it ended up as a smaller, faster, memoized walk that only ever inspects your unconfirmed coins and their ancestors, so it doesn't get slower as your wallet history grows.

A lot of the value came from other people poking holes in the approach: performance concerns, edge cases like missing history, and questions about what "trust" should even mean. Contributing to open source is much less about writing the patch than about defending, breaking and rebuilding it in public.

## Where it stands

**Update, September 2026:** the trust redesign (#2246) and the confirmation primitive (#2263) are merged into `bdk`'s main branch. Neither has shipped in a `bdk_chain` release yet, so the wallet delegation and the `locked` category, both in `bdk_wallet`, stay open as drafts until one does: `bdk_wallet` builds against a published `bdk_chain`, and that's the one hard dependency. Next up are time-based timelocks and a future frozen/reserved category for coins the user locks manually.

## What else?

The PRs and issues behind this project:

- [bdk_wallet#431](https://github.com/bitcoindevkit/bdk_wallet/pull/431) was my first attempt, a walk directly in the wallet, later reworked to delegate to the chain walk once #2246 existed, and gained `min_confirmations`.
- [bdk#2246](https://github.com/bitcoindevkit/bdk/pull/2246) is the ancestry-based trust and eligibility in `bdk_chain`, which then sent me back to rework #431 on top of it.
- [bdk#2263](https://github.com/bitcoindevkit/bdk/pull/2263) is the `blocks_since_conf` primitive.
- [bdk_wallet#538](https://github.com/bitcoindevkit/bdk_wallet/pull/538) is the `locked` balance category.

The issues that framed the work: [#16](https://github.com/bitcoindevkit/bdk_wallet/issues/16) and [#273](https://github.com/bitcoindevkit/bdk_wallet/issues/273) (the trust bugs), [#180](https://github.com/bitcoindevkit/bdk_wallet/issues/180) (locked coins), and [#183](https://github.com/bitcoindevkit/bdk_wallet/issues/183) (median-time-past, needed for time-based timelocks).

<sub>*Thanks to [nymius](https://github.com/nymius) for mentoring me through all of this, and to [Evan](https://github.com/evanlinjin) for the groundwork in [#2235](https://github.com/bitcoindevkit/bdk/pull/2235) and for sitting through round after round of review.*</sub>
