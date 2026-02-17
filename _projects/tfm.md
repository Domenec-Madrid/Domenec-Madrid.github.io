---
layout: page
title: Analysis of Covert-Nonce Channel Attacks on Bitcoin Hardware Wallets
description: Master's Thesis on Bitcoin Hardware Wallet Security
img: assets/img/projects/tfm/image.png
importance: 1
category: work
related_publications: true
---

<div class="row">
    <div class="col-lg-8 col-md-7">
        <h3>Abstract</h3>
        
        <p>
        In the context of Bitcoin hardware wallets, it is often assumed that due to its complete isolation from the Internet, specifically designed to achieve maximum security and capable of operating without a direct connection to a computer, they are an impenetrable fortress. Nothing could be further from the truth.
        </p>
        
        <p>
        Although significantly more secure than most other solutions, these devices remain vulnerable to highly sophisticated attack vectors capable of extracting the most sensitive piece of information that a Bitcoin wallet can hold: the seed. This can lead to the total loss of the funds associated with the private keys, all in a way that is completely invisible to the user and entirely remote.
        </p>
        
        <p>
        This master's thesis aims to explore the different covert channel attacks that exploit the random values used in probabilistic cryptographic signatures in Bitcoin. It also analyzes how such attacks can be carried out, if there are existing countermeasures to mitigate them, and, finally, whether the most advanced security solutions, such as hardware wallets, already implement these protections.
        </p>
        
        <div class="mt-4">
            <a href="{{ '/assets/pdf/tfm.pdf' | relative_url }}" class="btn btn-sm btn-primary" target="_blank">
                <i class="fas fa-file-pdf"></i> Download Full Thesis (PDF)
            </a>
        </div>
    </div>
    
    <div class="col-lg-4 col-md-5 mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/tfm/image.png" title="Thesis cover" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

<div class="row mt-5">
    <div class="col-12">
        <h3>Key Topics Covered</h3>
    </div>
</div>

<div class="row">
    <div class="col-sm-4 mt-3">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><i class="fas fa-lock"></i> Covert Channels</h5>
                <p class="card-text">Analysis of nonce-based covert channel attacks in ECDSA signatures.</p>
            </div>
        </div>
    </div>
    
    <div class="col-sm-4 mt-3">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><i class="fas fa-shield-alt"></i> Countermeasures</h5>
                <p class="card-text">Evaluation of existing protections and mitigation strategies.</p>
            </div>
        </div>
    </div>
    
    <div class="col-sm-4 mt-3">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><i class="fas fa-wallet"></i> Hardware Wallets</h5>
                <p class="card-text">Security assessment of commercial hardware wallet implementations.</p>
            </div>
        </div>
    </div>
</div>