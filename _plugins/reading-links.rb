require 'httparty'
require 'jekyll'
require 'nokogiri'
require 'uri'

# Turns the links listed in _data/reading.yml into cards for the reading page.
#
# Each entry can be just a URL, or a hash with `url` plus any of `title`,
# `authors`, `year`, `site`, `kind` (paper/article) and `note` to override or
# complete what the page itself says. Everything else is read at build time from
# the page's metadata: citation_* tags (arXiv, IACR ePrint, ACM, Springer...),
# then Open Graph, then <title>. Results are kept in the Jekyll cache so local
# rebuilds don't refetch, and a link that can't be fetched still renders.
module ReadingLinks
  PAPER_HOSTS = %w[
    arxiv.org eprint.iacr.org dl.acm.org ieeexplore.ieee.org link.springer.com
    openreview.net papers.ssrn.com www.ndss-symposium.org www.usenix.org
    fc17.ifca.ai ifca.ai eprints.whiterose.ac.uk
  ].freeze

  class Generator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      entries = site.data['reading'] || []
      cache = Jekyll::Cache.new('ReadingLinks')
      site.data['reading_items'] = entries.filter_map do |entry|
        entry = normalize(entry)
        next if entry.nil?

        meta = cache.key?(entry['url']) ? cache[entry['url']] : fetch(entry['url'])
        cache[entry['url']] = meta if meta && !meta['failed']
        build_item(entry, meta || {})
      end
    end

    private

    def normalize(entry)
      entry = { 'url' => entry } if entry.is_a?(String)
      return nil unless entry.is_a?(Hash) && entry['url'].to_s.strip != ''

      entry.merge('url' => entry['url'].to_s.strip)
    end

    # arXiv and ePrint PDFs have no metadata; their landing pages do.
    def metadata_url(url)
      url
        .sub(%r{\Ahttps?://arxiv\.org/pdf/([^/?#]+?)(?:\.pdf)?\z}, 'https://arxiv.org/abs/\1')
        .sub(%r{\A(https?://eprint\.iacr\.org/\d{4}/\d+)\.pdf\z}, '\1')
    end

    def fetch(url)
      Jekyll.logger.info 'Reading:', "fetching #{url}"
      res = HTTParty.get(metadata_url(url), follow_redirects: true, timeout: 10,
                                            headers: { 'User-Agent' => 'Mozilla/5.0 (reading list)' })
      return { 'failed' => true } unless res.code == 200
      return { 'pdf' => true } if res.headers['content-type'].to_s.include?('pdf')

      parse(Nokogiri::HTML(res.body))
    rescue StandardError => e
      Jekyll.logger.warn 'Reading:', "could not fetch #{url} (#{e.class})"
      { 'failed' => true }
    end

    def parse(doc)
      meta = lambda do |*names|
        names.each do |n|
          node = doc.at(%(meta[name="#{n}"])) || doc.at(%(meta[property="#{n}"]))
          value = node && node['content'].to_s.strip
          return value unless value.nil? || value.empty?
        end
        nil
      end

      authors = doc.css('meta[name="citation_author"]').map { |m| m['content'].to_s.strip }.reject(&:empty?)
      authors = [meta.call('author', 'article:author')].compact if authors.empty?
      date = meta.call('citation_publication_date', 'citation_date', 'citation_online_date',
                       'article:published_time', 'dc.date', 'DC.date')

      {
        'title' => meta.call('citation_title', 'og:title', 'twitter:title') || doc.at('title')&.text.to_s.strip,
        'authors' => authors,
        'year' => date && date[/\b(19|20)\d{2}\b/],
        'site' => meta.call('og:site_name', 'citation_journal_title', 'citation_conference_title'),
        'description' => meta.call('citation_abstract', 'og:description', 'description', 'twitter:description'),
        'scholarly' => !meta.call('citation_title').nil?
      }
    end

    def build_item(entry, meta)
      uri = URI.parse(entry['url']) rescue nil
      host = uri&.host.to_s.sub(/\Awww\./, '')
      pdf = meta['pdf'] || entry['url'].downcase.end_with?('.pdf')

      title = entry['title'] || meta['title']
      if title.nil? || title.empty?
        # Last resort: a readable version of the file or page name.
        last = uri&.path.to_s.split('/').reject(&:empty?).last.to_s
        title = last.sub(/\.pdf\z/i, '').tr('-_', '  ').strip
        title = host if title.empty?
      end

      kind = entry['kind'] ||
             (meta['scholarly'] || pdf || PAPER_HOSTS.include?(host) ? 'paper' : 'article')

      authors = entry['authors'] || meta['authors'] || []
      authors = [authors] if authors.is_a?(String)
      # citation_author is usually "Last, First"; show it as "First Last".
      authors = authors.map { |a| a.to_s.count(',') == 1 ? a.split(',').map(&:strip).reverse.join(' ') : a.to_s }

      description = entry.key?('description') ? entry['description'] : meta['description']
      description = description.to_s.gsub(/\s+/, ' ').strip
      description = "#{description[0, 220].sub(/\s+\S*\z/, '')}…" if description.length > 230

      {
        'url' => entry['url'],
        'title' => title.gsub(/\s+/, ' ').strip,
        'authors' => authors,
        'year' => (entry['year'] || meta['year']).to_s,
        'site' => entry['site'] || meta['site'] || host,
        'host' => host,
        'kind' => kind,
        'description' => description,
        'note' => entry['note']
      }
    end
  end
end
