// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-books",
          title: "Books",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/books/";
          },
        },{id: "nav-blog",
          title: "Blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-publications",
          title: "Publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "Projects",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-cv",
          title: "CV",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-contact",
          title: "Contact",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/contact/";
          },
        },{id: "post-teaching-a-bitcoin-wallet-to-trust-the-right-coins",
        
          title: "Teaching a Bitcoin Wallet to Trust the Right Coins",
        
        description: "My Summer of Bitcoin work on BDK&#39;s balance API — why a wallet should decide which unconfirmed coins to trust by looking at where the money came from, not at where it landed.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/bdk-wallet-balance-api/";
          
        },
      },{id: "post-is-hardware-wallet-fingerprinting-even-possible",
        
          title: "Is Hardware Wallet Fingerprinting Even Possible?",
        
        description: "Can you tell which hardware wallet signed a Bitcoin transaction just by looking at its ECDSA or Schnorr signature? We tested ten devices and found out.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/hww-fingerprinting/";
          
        },
      },{id: "post-covert-nonce-channel-attacks-on-bitcoin-hardware-wallets",
        
          title: "Covert-Nonce Channel Attacks on Bitcoin Hardware Wallets",
        
        description: "How a compromised hardware wallet can silently leak your Bitcoin seed through the signatures it produces — and what the Anti-Exfil protocol does to stop it.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/cvca/";
          
        },
      },{id: "post-build-your-own-bitcoin-main-net",
        
          title: "Build Your Own Bitcoin Main-net",
        
        description: "How we built a fully isolated Bitcoin mainnet replica in Docker — same genesis block as the real network, zero-cost transactions, and hardware wallet support out of the box.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/byom/";
          
        },
      },{id: "news-i-ve-been-accepted-to-the-b40s-residency-in-florianópolis-a-residency-where-a-bunch-of-devs-of-different-levels-come-together-to-learn-and-develop-bitcoin-stuff-learn-a-little-bit-more-about-it",
          title: 'I’ve been accepted to the B40S residency in Florianópolis 🎉. A residency where...',
          description: "",
          section: "News",},{id: "news-i-started-working-as-an-adjunct-professor-at-uab-in-the-computer-networks-course-labs-additionally-i-began-supervising-4-bachelor-thesis-on-topics-related-to-bitcoin-hacking-privacy-and-artificial-intelligence",
          title: 'I started working as an adjunct professor at UAB in the computer networks...',
          description: "",
          section: "News",},{id: "news-attended-btc-in-floripa-during-the-residency-a-great-conference-with-lots-of-technical-talks-around-bitcoin-development-highly-recommend-if-you-ever-get-the-chance",
          title: 'Attended BTC++ in Floripa during the residency. A great conference with lots of...',
          description: "",
          section: "News",},{id: "news-just-wrapped-up-3-weeks-of-bitcoin-residency-in-florianópolis-with-b4os-amazing-experience-building-learning-and-talking-bitcoin-with-people-from-all-over-the-world-already-looking-forward-to-the-next-one",
          title: 'Just wrapped up 3 weeks of Bitcoin residency in Florianópolis with B4OS 🌴....',
          description: "",
          section: "News",},{id: "news-presented-our-paper-is-hardware-wallet-fingerprinting-even-possible-at-recsi-2026-in-tenerife",
          title: 'Presented our paper Is Hardware Wallet Fingerprinting Even Possible? at RECSI 2026 in...',
          description: "",
          section: "News",},{id: "news-currently-deep-into-hardware-wallet-fingerprinting-research-if-you-re-curious-about-what-it-means-for-bitcoin-privacy-check-out-my-latest-blog-post",
          title: 'Currently deep into hardware wallet fingerprinting research 🔍. If you’re curious about what...',
          description: "",
          section: "News",},{id: "news-accepted-into-summer-of-bitcoin-️-working-on-the-balance-api-of-bdk-wallet-i-wrote-about-it-in-teaching-a-bitcoin-wallet-to-trust-the-right-coins",
          title: 'Accepted into Summer of Bitcoin ☀️, working on the balance API of bdk_wallet....',
          description: "",
          section: "News",},{id: "projects-analysis-of-covert-nonce-channel-attacks-on-bitcoin-hardware-wallets",
          title: 'Analysis of Covert-Nonce Channel Attacks on Bitcoin Hardware Wallets',
          description: "Master&#39;s Thesis on Bitcoin Hardware Wallet Security",
          section: "Projects",handler: () => {
              window.location.href = "/projects/tfm/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/Domenec_Madrid_CV.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%44%6F%6D%65%6E%65%63.%4D%61%64%72%69%64@%75%61%62.%63%61%74", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
