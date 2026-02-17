// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-publications",
          title: "publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "A growing collection of your cool projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "dropdown-bookshelf",
              title: "bookshelf",
              description: "",
              section: "Dropdown",
              handler: () => {
                window.location.href = "/books/";
              },
            },{id: "dropdown-blog",
              title: "blog",
              description: "",
              section: "Dropdown",
              handler: () => {
                window.location.href = "/blog/";
              },
            },{id: "post-covert-nonce-channel-attacks-on-bitcoin-hardware-wallets",
        
          title: "Covert-Nonce Channel Attacks on Bitcoin Hardware Wallets",
        
        description: "",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/cvca/";
          
        },
      },{id: "post-build-your-own-bitcoin-main-net",
        
          title: "Build Your Own Bitcoin Main-net",
        
        description: "",
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
          window.open("/assets/pdf/example_pdf.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%79%6F%75@%65%78%61%6D%70%6C%65.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-inspire',
        title: 'Inspire HEP',
        section: 'Socials',
        handler: () => {
          window.open("https://inspirehep.net/authors/1010907", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=qc6CJjYAAAAJ", "_blank");
        },
      },{
        id: 'social-custom_social',
        title: 'Custom_social',
        section: 'Socials',
        handler: () => {
          window.open("https://www.alberteinstein.com/", "_blank");
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
