source "https://rubygems.org"

# Modern, plain Jekyll. The site uses only standard features
# (kramdown, rouge, SCSS, feed, sitemap) so GitHub Pages still
# builds it from `master` without a custom Actions workflow.
gem "jekyll", "~> 4.3"

group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-sitemap"
end

# Required for `jekyll serve` on Ruby 3.x (webrick left the stdlib).
gem "webrick"
