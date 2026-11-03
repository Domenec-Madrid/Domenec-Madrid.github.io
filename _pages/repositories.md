---
layout: page
permalink: /repositories/
title: Repositories
description:
nav: true
nav_order: 4
---

{% if site.data.repositories.github_users %}

## GitHub Profile

<div class="gh-profiles">
{% for user in site.data.repositories.github_users %}
  <div class="gh-profile-card" data-gh-user="{{ user }}">
    <img class="gh-profile-avatar" src="https://github.com/{{ user }}.png?size=128" alt="{{ user }}" loading="lazy">
    <div>
      <div class="gh-profile-name">{{ user }}</div>
      <a class="gh-profile-handle" href="https://github.com/{{ user }}" target="_blank" rel="noopener">@{{ user }}</a>
      <p class="gh-profile-bio gh-loading">Loading profile…</p>
    </div>
  </div>
{% endfor %}
</div>

{% endif %}

{% if site.data.repositories.github_repos %}

## Repositories

<div class="gh-repos" id="gh-repos">
{% for repo in site.data.repositories.github_repos %}
  <a class="gh-repo-card" href="https://github.com/{{ repo }}" target="_blank" rel="noopener" data-gh-repo="{{ repo }}">
    <div class="gh-repo-name"><i class="fa-solid fa-code-branch"></i>{{ repo | split: '/' | last }}</div>
    <p class="gh-repo-desc gh-loading">Loading…</p>
  </a>
{% endfor %}
</div>

{% endif %}

{% if site.data.repositories.github_users %}

## Open Source Contributions

{% for user in site.data.repositories.github_users %}

<div class="gh-contrib-section" data-gh-contrib-user="{{ user }}">
  <p class="gh-loading">Loading contributions…</p>
</div>
{% endfor %}

{% endif %}

<script>
(function () {
  // PurgeCSS scans the built site for literal class names, so classes are
  // spelled out here rather than assembled by concatenation (see
  // _sass/_demos.scss for the same rule and why it matters).
  var LANG_COLORS = {
    Rust: '#dea584',
    'C++': '#f34b7d',
    C: '#555555',
    Python: '#3572A5',
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Shell: '#89e051',
    Dockerfile: '#384d54',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Go: '#00ADD8'
  };

  function loadProfile(card) {
    var username = card.dataset.ghUser;
    fetch('https://api.github.com/users/' + encodeURIComponent(username))
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (u) {
        var bio = card.querySelector('.gh-profile-bio');
        bio.classList.remove('gh-loading');
        bio.textContent = u.bio || '';
        var stats = document.createElement('div');
        stats.className = 'gh-profile-stats';
        stats.innerHTML =
          '<span><i class="fa-solid fa-book"></i>' + u.public_repos + ' repositories</span>' +
          '<span><i class="fa-solid fa-user-group"></i>' + u.followers + ' followers</span>';
        card.querySelector('div').appendChild(stats);
      })
      .catch(function () {
        var bio = card.querySelector('.gh-profile-bio');
        bio.classList.remove('gh-loading');
        bio.className = 'gh-error';
        bio.textContent = "Couldn't load GitHub profile data right now.";
      });
  }

  function loadRepo(card) {
    var repo = card.dataset.ghRepo;
    fetch('https://api.github.com/repos/' + repo)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (r) {
        var desc = card.querySelector('.gh-repo-desc');
        desc.classList.remove('gh-loading');
        desc.textContent = r.description || '';

        var meta = document.createElement('div');
        meta.className = 'gh-repo-meta';
        var langHtml = '';
        if (r.language) {
          var color = LANG_COLORS[r.language] || null;
          langHtml = '<span class="gh-repo-lang"><span class="gh-lang-dot"' +
            (color ? ' style="background:' + color + '"' : '') + '></span>' + r.language + '</span>';
        }
        meta.innerHTML = langHtml +
          '<span><i class="fa-regular fa-star"></i>' + r.stargazers_count + '</span>' +
          '<span><i class="fa-solid fa-code-fork"></i>' + r.forks_count + '</span>';
        card.appendChild(meta);
      })
      .catch(function () {
        var desc = card.querySelector('.gh-repo-desc');
        desc.classList.remove('gh-loading');
        desc.className = 'gh-error';
        desc.textContent = "Couldn't load repository data right now.";
      });
  }

  function timeAgo(iso) {
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return days + ' days ago';
    var months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago');
    var years = Math.floor(months / 12);
    return years + (years === 1 ? ' year ago' : ' years ago');
  }

  function repoOf(item) {
    var parts = item.repository_url.split('/');
    return parts[parts.length - 2] + '/' + parts[parts.length - 1];
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function contribCard(item, cardClass, icon, label) {
    return '<a class="' + cardClass + '" href="' + item.html_url +
      '" target="_blank" rel="noopener">' +
      '<span class="gh-contrib-title">' + escapeHtml(item.title) + '</span>' +
      '<span class="gh-contrib-meta"><i class="' + icon + '"></i>' +
      escapeHtml(repoOf(item)) + ' #' + item.number + ' &middot; ' + label + '</span></a>';
  }

  function contribGroup(items, headingClass, icon, heading, emptyText) {
    var body = items.length
      ? '<div class="gh-contribs">' + items.join('') + '</div>'
      : '<p class="gh-loading" style="animation:none">' + emptyText + '</p>';
    return '<div class="gh-contrib-group">' +
      '<div class="gh-contrib-heading ' + headingClass + '"><i class="' + icon + '"></i>' + heading + '</div>' +
      body + '</div>';
  }

  function loadContributions(container) {
    var username = container.dataset.ghContribUser;
    fetch('https://api.github.com/search/issues?q=author:' + encodeURIComponent(username) +
          '&sort=updated&order=desc&per_page=30', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (data) {
        var merged = [], open = [];
        (data.items || []).forEach(function (item) {
          var isPr = !!item.pull_request;
          if (isPr && item.pull_request.merged_at) {
            merged.push(contribCard(item, 'gh-contrib-card gh-contrib-card--merged', 'fa-solid fa-code-merge',
              'merged ' + timeAgo(item.pull_request.merged_at)));
          } else if (item.state === 'open') {
            var icon = isPr ? 'fa-solid fa-code-pull-request' : 'fa-regular fa-circle-dot';
            open.push(contribCard(item, 'gh-contrib-card gh-contrib-card--open', icon,
              (isPr ? 'PR' : 'issue') + ' updated ' + timeAgo(item.updated_at)));
          }
        });
        container.innerHTML =
          contribGroup(merged.slice(0, 6), 'gh-contrib-heading--merged', 'fa-solid fa-code-merge',
            'Recently merged', 'Nothing merged recently.') +
          contribGroup(open.slice(0, 6), 'gh-contrib-heading--open', 'fa-solid fa-circle-check',
            'Open right now', 'Nothing open right now.');
      })
      .catch(function () {
        container.innerHTML = '<p class="gh-error">Couldn\'t load contribution data right now. ' +
          '<a href="https://github.com/' + username + '?tab=activity" target="_blank" rel="noopener">' +
          'See the activity on GitHub instead</a>.</p>';
      });
  }

  document.querySelectorAll('.gh-profile-card[data-gh-user]').forEach(loadProfile);
  document.querySelectorAll('.gh-repo-card[data-gh-repo]').forEach(loadRepo);
  document.querySelectorAll('.gh-contrib-section[data-gh-contrib-user]').forEach(loadContributions);
})();
</script>
