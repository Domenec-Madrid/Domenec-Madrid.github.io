---
layout: post
title: What CTV Refuses to Look At
date: 2026-08-24
description: OP_CHECKTEMPLATEVERIFY hashes eight fields of the spending transaction. The interesting part is the ones it leaves out, because the same omission gives covenants their best trick and their worst footgun.
tags: ["Bitcoin", "Covenants", "CTV", "CSFS", "Script", "Consensus"]
categories:
---

Bitcoin Script can say *who* may spend a coin, and *when*. It cannot say *where the money goes next*. Every construction that needs that, vaults, payment pools, channel factories, has to fake it with pre-signed transactions: generate a key, sign the future spends in advance, then delete the key and pray you deleted it properly. The security of the whole thing rests on a deletion nobody can prove happened.

A **covenant** moves that promise into consensus. The definition is narrow:

> A covenant occurs when the `scriptPubKey` of a UTXO restricts the `scriptPubKey` of the outputs of the transaction that spends it.

[CTV](https://github.com/bitcoin/bips/blob/master/bip-0119.mediawiki) is the smallest useful version of that idea. It hashes a description of the spending transaction and refuses the spend unless the real one matches. One opcode, one hash, one comparison.

And the whole character of CTV, both what it makes possible and what it can destroy, comes down to a single question:

**Which fields go into that hash, and which ones don't?**

## Eight fields and a comparison

`OP_CHECKTEMPLATEVERIFY` reuses `OP_NOP4` (`0xb3`). It looks at the top of the stack and does something deliberately anticlimactic:

- If the top element is **not** exactly 32 bytes, it behaves as a NOP.[^nop] Old nodes see nothing.
- If it **is** 32 bytes, it computes the template hash of the spending transaction and compares. Mismatch fails the script.

The hash, `DefaultCheckTemplateVerifyHash`, is a single SHA256 over these fields, in this order:

| # | field | serialization |
| --- | --- | --- |
| 1 | `nVersion` | 4 bytes, little-endian |
| 2 | `nLockTime` | 4 bytes, little-endian |
| 3 | `sha256(scriptSigs)` | **only if any scriptSig is non-empty**[^scriptsigs] |
| 4 | `input_count` | 4 bytes, little-endian |
| 5 | `sha256(sequences)` | over the 4-byte sequences |
| 6 | `output_count` | 4 bytes, little-endian |
| 7 | `sha256(outputs)` | over each `CTxOut`: 8-byte value, then length-prefixed script |
| 8 | `input_index` | 4 bytes, little-endian |

Amounts appear exactly once in that list, inside the outputs. Read the list again looking for the inputs and you will not find them. There are no txids, no outpoints, and no input amounts anywhere in the hash.

That is not an oversight. It is the entire design.

## Try it

Change anything on the left and watch the hash. The fields at the bottom are the ones CTV never looks at: touch them and the hash stays exactly where it was.

<div class="demo-block" id="ctv-tool">
    <h6 class="demo-heading">CTV template inspector</h6>

    <div class="ctv-grid">
      <div>
        <div class="ctv-group-title">Committed by the template</div>

        <div class="demo-field">
          <label for="ctv-version">nVersion</label>
          <input type="number" id="ctv-version" value="2" min="0" max="2147483647">
        </div>
        <div class="demo-field">
          <label for="ctv-locktime">nLockTime</label>
          <input type="number" id="ctv-locktime" value="0" min="0">
        </div>
        <div class="demo-field">
          <label for="ctv-sequence">nSequence</label>
          <input type="number" id="ctv-sequence" value="4294967293" min="0" max="4294967295">
        </div>
        <div class="demo-field">
          <label for="ctv-count">input_count</label>
          <input type="number" id="ctv-count" value="1" min="1" max="5">
        </div>
        <div class="demo-field">
          <label for="ctv-index">input_index</label>
          <input type="number" id="ctv-index" value="0" min="0" max="4">
        </div>

        <div class="ctv-outputs-head">
          <span>outputs</span>
          <span>
            <button class="demo-mode ctv-mini" id="ctv-out-remove" title="Remove an output">&minus;</button>
            <button class="demo-mode ctv-mini" id="ctv-out-add" title="Add an output">+</button>
          </span>
        </div>
        <div id="ctv-outputs"></div>

        <div class="ctv-group-title ctv-group-title--muted">Not committed &mdash; CTV never sees these</div>
        <div class="ctv-uncommitted">
          <div class="demo-field">
            <label for="ctv-txid">input txid</label>
            <input type="text" id="ctv-txid" value="9f2c…a10b" maxlength="20">
          </div>
          <div class="demo-field">
            <label for="ctv-vout">input vout</label>
            <input type="number" id="ctv-vout" value="0" min="0">
          </div>
          <div class="demo-field">
            <label for="ctv-inamount">input amount (BTC)</label>
            <input type="number" id="ctv-inamount" value="1.0" min="0" step="0.01">
          </div>
          <div id="ctv-uncommitted-note" class="ctv-hint">Change any of these three and the hash below will not move.</div>
        </div>
      </div>

      <div>
        <div class="ctv-group-title">What gets hashed</div>
        <div id="ctv-preimage" class="demo-hex"></div>
        <div class="demo-legend" id="ctv-legend">
          <span class="is-quiet">counts</span>
          <span class="is-r">version / locktime</span>
          <span class="is-quiet">sha256(sequences)</span>
          <span class="is-s">sha256(outputs)</span>
          <span class="is-pad">input_index</span>
        </div>

        <div class="ctv-group-title mt-3">Template hash</div>
        <div id="ctv-hash" class="ctv-hash">computing…</div>
        <div id="ctv-hash-state" class="ctv-hint"></div>

        <div class="ctv-group-title mt-3">Can this coin actually move?</div>
        <div id="ctv-verdict" class="ctv-verdict"></div>
      </div>
    </div>
</div>

<style>
#ctv-tool .ctv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 700px) { #ctv-tool .ctv-grid { grid-template-columns: 1fr; } }
#ctv-tool .ctv-group-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--global-text-color-light); margin-bottom: 0.7rem; font-weight: 600; }
#ctv-tool .ctv-group-title--muted { margin-top: 1.6rem; }
#ctv-tool .ctv-outputs-head { display: flex; justify-content: space-between; align-items: center;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.09em; font-weight: 600;
  color: var(--global-text-color-light); margin: 1.4rem 0 0.7rem; }
#ctv-tool .ctv-mini { padding: 0.1rem 0.6rem; font-size: 0.9rem; border: 1px solid var(--demo-rule);
  border-radius: 4px; margin-left: 0.25rem; }
#ctv-tool .ctv-out { display: flex; gap: 0.6rem; margin-bottom: 0.5rem; align-items: center; }
#ctv-tool .ctv-out input, #ctv-tool .ctv-out select { flex: 1 1 40%; min-width: 0; padding: 0.2rem 0.45rem;
  border: 0; border-bottom: 1px solid var(--demo-rule); background: transparent;
  color: var(--global-text-color); font-family: inherit; font-size: 0.8rem; }
#ctv-tool .ctv-uncommitted { padding: 0.9rem 1rem; border-radius: 4px; background: var(--demo-surface); }
#ctv-tool .ctv-hint { font-size: 0.75rem; color: var(--global-text-color-light); margin-top: 0.6rem; }
#ctv-tool .ctv-field-label { display: block; font-size: 0.68rem; color: var(--global-text-color-light);
  margin-top: 0.7rem; letter-spacing: 0.04em; }
#ctv-tool .ctv-hash { font-family: var(--bs-font-monospace, ui-monospace, monospace); font-size: 0.78rem;
  word-break: break-all; line-height: 1.9; padding-left: 0.9rem; border-left: 2px solid var(--demo-r); }
#ctv-tool .ctv-verdict { font-size: 0.83rem; line-height: 1.6; padding-left: 0.9rem;
  border-left: 2px solid var(--demo-s); }
#ctv-tool .ctv-verdict.is-bad { border-left-color: var(--demo-pad); }
</style>

<script>
(function () {
  var SCRIPTS = {
    'P2WPKH (22 B)': 22, 'P2TR (34 B)': 34, 'P2PKH (25 B)': 25, 'P2SH (23 B)': 23
  };
  var outputs = [
    { amount: 0.99, script: 'P2WPKH (22 B)' }
  ];
  var lastHash = null, lastCommitted = null;

  function el(id) { return document.getElementById(id); }
  function h2(n) { return n.toString(16).padStart(2, '0'); }

  // Little-endian serialization helpers, matching BIP-119 field widths.
  function u32le(n) { var a = []; n = n >>> 0; for (var i = 0; i < 4; i++) { a.push(n & 0xff); n >>>= 8; } return a; }
  function u64le(n) {
    var a = [], big = BigInt(Math.round(n));
    for (var i = 0; i < 8; i++) { a.push(Number(big & 255n)); big >>= 8n; }
    return a;
  }
  function compactSize(n) {
    if (n < 0xfd) return [n];
    if (n <= 0xffff) return [0xfd, n & 0xff, (n >> 8) & 0xff];
    return [0xfe].concat(u32le(n));
  }
  async function sha256(bytes) {
    var buf = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    return Array.from(new Uint8Array(buf));
  }
  function hex(bytes) { return bytes.map(h2).join(''); }

  function chip(bytes, cls, title) {
    return '<span class="demo-byte' + (cls ? ' demo-byte--' + cls : '') + '" title="' + title + '">' +
      hex(bytes) + '</span>';
  }

  function renderOutputs() {
    var html = '';
    outputs.forEach(function (o, i) {
      html += '<div class="ctv-out">' +
        '<input type="number" step="0.00000001" min="0" value="' + o.amount + '" data-out="' + i + '" data-k="amount">' +
        '<select data-out="' + i + '" data-k="script">' +
        Object.keys(SCRIPTS).map(function (s) {
          return '<option' + (s === o.script ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></div>';
    });
    el('ctv-outputs').innerHTML = html;
    el('ctv-outputs').querySelectorAll('input,select').forEach(function (n) {
      n.addEventListener('input', function () {
        var o = outputs[+n.dataset.out];
        o[n.dataset.k] = n.dataset.k === 'amount' ? parseFloat(n.value || 0) : n.value;
        recompute();
      });
    });
  }

  async function recompute() {
    var version = parseInt(el('ctv-version').value || 0, 10);
    var locktime = parseInt(el('ctv-locktime').value || 0, 10);
    var sequence = parseInt(el('ctv-sequence').value || 0, 10);
    var count = Math.max(1, parseInt(el('ctv-count').value || 1, 10));
    var index = Math.min(parseInt(el('ctv-index').value || 0, 10), count - 1);
    var inAmount = parseFloat(el('ctv-inamount').value || 0);
    el('ctv-index').max = count - 1;

    // sha256 over the concatenated 4-byte sequences, one per input.
    var seqBytes = [];
    for (var i = 0; i < count; i++) seqBytes = seqBytes.concat(u32le(sequence));
    var seqHash = await sha256(seqBytes);

    // sha256 over each CTxOut: 8-byte value, then the length-prefixed script.
    var outBytes = [];
    outputs.forEach(function (o) {
      var len = SCRIPTS[o.script];
      outBytes = outBytes.concat(u64le(o.amount * 1e8), compactSize(len), new Array(len).fill(0));
    });
    var outHash = await sha256(outBytes);

    // BIP-119 field order. sha256(scriptSigs) is omitted: every scriptSig is empty here.
    var fields = [
      { b: u32le(version), c: 'r', n: 'nVersion' },
      { b: u32le(locktime), c: 'r', n: 'nLockTime' },
      { b: u32le(count), c: '', n: 'input_count' },
      { b: seqHash, c: '', n: 'sha256(sequences)' },
      { b: u32le(outputs.length), c: '', n: 'output_count' },
      { b: outHash, c: 's', n: 'sha256(outputs)' },
      { b: u32le(index), c: 'pad', n: 'input_index' }
    ];

    var preimage = [], html = '';
    fields.forEach(function (f) {
      preimage = preimage.concat(f.b);
      html += '<span class="ctv-field-label">' + f.n + '</span>' + chip(f.b, f.c, f.n);
    });
    el('ctv-preimage').innerHTML = html;

    var digest = hex(await sha256(preimage));
    el('ctv-hash').textContent = digest;

    // Did this edit touch a committed field, or only the ignored ones?
    var committed = JSON.stringify(fields.map(function (f) { return f.b; }));
    if (lastHash !== null) {
      if (digest === lastHash && committed === lastCommitted) {
        el('ctv-hash-state').innerHTML =
          '<strong style="color:var(--demo-s)">Hash unchanged.</strong> That field is not committed.';
      } else {
        el('ctv-hash-state').textContent = 'Hash changed: that field is part of the template.';
      }
    }
    lastHash = digest; lastCommitted = committed;

    // Consensus still forbids creating bitcoins, and the template said nothing
    // about the input, so this is where the Unsatisfiable UTXO shows up.
    var outTotal = outputs.reduce(function (a, o) { return a + o.amount; }, 0);
    var v = el('ctv-verdict');
    if (outTotal > inAmount) {
      v.className = 'ctv-verdict is-bad';
      v.innerHTML = '<strong>Unsatisfiable.</strong> The template demands ' + outTotal.toFixed(8) +
        ' BTC of outputs from a ' + inAmount.toFixed(8) + ' BTC input. Every transaction that satisfies ' +
        'the covenant creates bitcoins, so none of them is valid. This coin can never move.';
    } else {
      v.className = 'ctv-verdict';
      v.innerHTML = '<strong>Spendable.</strong> Outputs total ' + outTotal.toFixed(8) + ' BTC against a ' +
        inAmount.toFixed(8) + ' BTC input, leaving ' + (inAmount - outTotal).toFixed(8) + ' BTC of fee.';
    }
  }

  function init() {
    renderOutputs();
    ['ctv-version', 'ctv-locktime', 'ctv-sequence', 'ctv-count', 'ctv-index', 'ctv-inamount', 'ctv-txid', 'ctv-vout']
      .forEach(function (id) { el(id).addEventListener('input', recompute); });
    el('ctv-out-add').addEventListener('click', function () {
      if (outputs.length < 5) { outputs.push({ amount: 0.1, script: 'P2TR (34 B)' }); renderOutputs(); recompute(); }
    });
    el('ctv-out-remove').addEventListener('click', function () {
      if (outputs.length > 1) { outputs.pop(); renderOutputs(); recompute(); }
    });
    recompute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>

## Omission one: no outpoint, so the template floats

A template does not know which coin it is spending. It describes a *shape*: this many inputs, this many outputs, these amounts, these scripts, this locktime.

That is what makes it a template rather than a pre-signed transaction. Any UTXO whose script commits to this hash can be spent by any transaction with the right shape. Send funds to the same address twice and both coins accept the same spend, because neither is named anywhere in what was hashed.

Now put [CSFS](https://bips.dev/348/) next to it. `OP_CHECKSIGFROMSTACK` reuses `OP_SUCCESS204` (`0xcc`), works only in tapscript, and differs from `OP_CHECKSIG` in one respect: the signed message comes off the stack instead of being derived from the transaction. It consumes, top down, a pubkey, a message and a signature, and it does not hash the message first, since BIP-340 takes messages of any length.

```
Tapscript:  OP_CHECKTEMPLATEVERIFY <PubKey> OP_CHECKSIGFROMSTACK
Witness:    <sig> <TemplateHash>
```

Read what that signature actually covers. Not a txid. Not an outpoint. It covers the **template hash**, which is to say the shape of the spend. So the same signature stays valid for any coin that lands in this script.

That is a **re-bindable signature**, and it is the property [ANYPREVOUT](https://github.com/bitcoin/bips/blob/master/bip-0118.mediawiki) was designed to provide. CTV+CSFS reaches it without touching sighash logic at all: sign a hash that never mentioned the input, and the signature was never bound to one in the first place.

Everything people want from this pair follows from here. LN-Symmetry, where the latest channel state simply wins and nobody stores revocation secrets. Ark and channel factories, where a tree of spends is agreed once and rebound as membership changes. Vaults with no ephemeral keys to delete, because there is nothing to delete.

## Omission two: no input amount, so the coin can starve

Here is the same omission wearing a different face.

The hash pins your outputs, amounts included. It says nothing about what came in. Consensus still enforces the one rule that has always been there: a transaction cannot create bitcoins.

So picture an address whose template says *one input, one output of 0.99 BTC, 0.01 for fees*. It was built expecting 1.0 BTC. Somebody sends **0.5 BTC** instead.

The template is still satisfiable in the sense that a matching transaction exists. It just cannot be valid: it would move 0.99 BTC out of a 0.5 BTC input. Every spend that satisfies the covenant is invalid, and every valid spend violates the covenant. Nothing can move the coin, ever.

This is the **Unsatisfiable UTXO**, and it is not a bug in CTV. Committing to the input amount is exactly what would stop the template from being a template: pin the input and you have pinned the coin, and re-bindable signatures die with it.

You can defend against it. The usual answer is a Taproot key-path escape hatch, so the script path is one option and not the only one, which quietly gives up part of the trustlessness the covenant was for. What you cannot do is have the amount both committed and not committed.

## The same choice, twice

Put the two side by side and the shape of the trade is hard to miss.

| omitted from the hash | what you get | what it costs |
| --- | --- | --- |
| the input outpoint | templates float; signatures re-bind; APO semantics for free | none anyone has found |
| the input amount | the template stays a template | a wrong deposit can brick the coin forever |

Both come from the same decision: describe the spend, not the coin. One reading gives CTV its best trick, the other its worst failure mode, and no amount of care in wallet software makes the second one disappear, because the omission is in consensus.

Which is why the most interesting successor proposal does not try to fix the footgun directly.

## CTHV: make the omissions selectable

`OP_TEMPLATEHASH`, floated on Delving Bitcoin in December 2024 and sometimes called CTV++, keeps the machinery and changes who decides. A flag byte lets the script choose which transaction fields the hash commits to, and a companion opcode, `OP_INPUTAMOUNTS`, makes input amounts reachable.

The Unsatisfiable UTXO stops being a property of the design and becomes a choice: commit to the input amount when you want a fixed-value deposit, leave it out when you want a floating template. The same flags are enough to emulate every BIP-341 sighash mode, and it composes with CSFS exactly as CTV does.

Further up the scale sit the general primitives. [OP_CAT](https://github.com/bitcoin/bips/blob/master/bip-0347.mediawiki), which Satoshi disabled and which was re-proposed in 2023, concatenates two stack elements and, almost as a side effect, unlocks full introspection, recursive covenants and BitVM. MATT commits each UTXO to a Merkle root of its own state and verifies transitions on chain. The expressiveness runs roughly:

$$\text{CTV} \rightarrow \text{CSFS} \rightarrow \text{CTHV} \rightarrow \texttt{OP\_VAULT} \rightarrow \text{MATT} \rightarrow \texttt{OP\_CAT}$$

Every step buys capability and spends review budget, and the argument about where to stop is most of what the covenant debate has been for eight years.

## Where it actually stands

Not activated. Nothing on this page is live on mainnet.

CTV has a deployment client with a signaling window that opened on **30 March 2026**, and miner signaling has been sitting at zero. In parallel, [66 developers signed an open letter](https://ctv-csfs.com/) arguing that CTV and CSFS are the two proposals mature enough to ship: extensively reviewed, small, and repeatedly asked for.

That gap is familiar. I spent [the last post](/blog/2026/grinding-bytes/) counting a one-byte optimization that has been free and documented for eight years and that two thirds of ECDSA signatures still do not use. Shipped code and adopted code are different quantities, and the distance between them is usually not technical.

What I find worth holding onto is smaller and more specific than the activation question. CTV is a hash of eight fields. Reading the list of what it hashes tells you what it can do; reading the list of what it skips tells you both why it is powerful and how it can fail. Those turn out to be the same list.

<sub>*Written up from a talk I gave on Bitcoin covenants. Field definitions checked against [BIP-119](https://github.com/bitcoin/bips/blob/master/bip-0119.mediawiki) and [BIP-348](https://bips.dev/348/).*</sub>

[^nop]: Consensus treats a non-32-byte argument as a NOP, which is what keeps the soft fork soft. Standardness policy is stricter and rejects it with `SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS`, so you cannot relay one by accident.

[^scriptsigs]: This field is conditional, which is easy to miss: BIP-119 includes `sha256(scriptSigs)` only when at least one input carries a non-empty scriptSig. For the segwit and taproot spends where CTV is actually interesting, every scriptSig is empty and the field is skipped entirely. The tool above assumes that case.
