---
layout: page
permalink: /repositories/
title: Repositories
description:
nav: true
nav_order: 4
---

{% if site.data.repositories.github_users %}

## Recent Activity

{% for user in site.data.repositories.github_users %}

<div class="activity-feed" id="activity-feed-{{ forloop.index }}" data-github-user="{{ user }}">
  <div class="activity-user-heading">
    <img src="https://github.com/{{ user }}.png?size=56" alt="{{ user }}" loading="lazy">
    <a href="https://github.com/{{ user }}">@{{ user }}</a>
  </div>
  <div class="activity-loading">Loading recent activity…</div>
</div>
{% endfor %}

<script>
(function () {
  // PurgeCSS scans the built site for literal class names, so every class
  // used below is spelled out here in full rather than built by
  // concatenation (see _sass/_demos.scss for the same rule).
  var ITEM_CLASS = {
    merged: 'activity-item activity-item--merged',
    openPr: 'activity-item activity-item--open-pr',
    openIssue: 'activity-item activity-item--open-issue'
  };

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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

  function itemRow(item, cls, label) {
    return '<a class="' + cls + '" href="' + item.html_url + '" target="_blank" rel="noopener">' +
      '<span class="activity-item-title">' + escapeHtml(item.title) + '</span>' +
      '<span class="activity-item-meta">' + escapeHtml(repoOf(item)) + ' #' + item.number +
      ' &middot; ' + label + '</span></a>';
  }

  function columnHtml(items, emptyText) {
    if (!items.length) return '<p class="activity-empty">' + emptyText + '</p>';
    return '<ul class="activity-list">' + items.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>';
  }

  function render(container, items) {
    var merged = [], open = [];
    items.forEach(function (item) {
      var isPr = !!item.pull_request;
      if (isPr && item.pull_request.merged_at) {
        merged.push(itemRow(item, ITEM_CLASS.merged, 'merged ' + timeAgo(item.pull_request.merged_at)));
      } else if (item.state === 'open') {
        var cls = isPr ? ITEM_CLASS.openPr : ITEM_CLASS.openIssue;
        var kind = isPr ? 'PR' : 'issue';
        open.push(itemRow(item, cls, kind + ' updated ' + timeAgo(item.updated_at)));
      }
    });
    merged = merged.slice(0, 6);
    open = open.slice(0, 6);

    container.innerHTML =
      '<div class="activity-columns">' +
        '<div class="activity-column activity-column--merged">' +
          '<div class="activity-column-title"><span class="activity-dot"></span>Recently merged</div>' +
          columnHtml(merged, 'Nothing merged recently.') +
        '</div>' +
        '<div class="activity-column activity-column--open">' +
          '<div class="activity-column-title"><span class="activity-dot"></span>Open right now</div>' +
          columnHtml(open, 'Nothing open right now.') +
        '</div>' +
      '</div>';
  }

  function renderError(container, username, rateLimited) {
    var msg = rateLimited
      ? "GitHub's public API rate limit was hit just now."
      : "Couldn't reach the GitHub API right now.";
    container.innerHTML = '<p class="activity-error">' + msg + ' <a href="https://github.com/' +
      username + '?tab=activity" target="_blank" rel="noopener">See the activity on GitHub instead</a>.</p>';
  }

  function load(container) {
    var username = container.dataset.githubUser;
    fetch('https://api.github.com/search/issues?q=author:' + encodeURIComponent(username) +
          '&sort=updated&order=desc&per_page=30', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) { renderError(container, username, res.status === 403); return null; }
        return res.json();
      })
      .then(function (data) {
        if (data) render(container, data.items || []);
      })
      .catch(function () { renderError(container, username, false); });
  }

  document.querySelectorAll('.activity-feed[data-github-user]').forEach(load);
})();
</script>

## GitHub Users

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
{% for user in site.data.repositories.github_users %}
  {% include repository/repo_user.liquid username=user %}
{% endfor %}
</div>

{% if site.repo_trophies.enabled %}
{% for user in site.data.repositories.github_users %}
{% if site.data.repositories.github_users.size > 1 %}

### {{ user }}

{% endif %}

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% include repository/repo_trophies.liquid username=user %}
</div>
{% endfor %}
{% endif %}

{% endif %}

{% if site.data.repositories.github_repos %}

## GitHub Repositories

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
{% for repo in site.data.repositories.github_repos %}
  {% include repository/repo.liquid repository=repo %}
{% endfor %}
</div>
{% endif %}
