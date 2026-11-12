# Minimal Mistakes remote theme starter

Click [**Use this template**](https://github.com/mmistakes/mm-github-pages-starter/generate) button above for the quickest method of getting started with the [Minimal Mistakes Jekyll theme](https://github.com/mmistakes/minimal-mistakes).


## Local preview

The locked gems (github-pages 226, Jekyll 3.9.2) do not install on Ruby 4, so preview with Homebrew's Ruby 3.3. Gems go into `vendor/bundle` (ignored by Jekyll). `bin/preview_logger_fix.rb` patches two Ruby 3.3 incompatibilities in Jekyll 3.9.2 and Liquid 4.0.3, for local use only:

```sh
export PATH=/opt/homebrew/opt/ruby@3.3/bin:$PATH
bundle config set --local path vendor/bundle && bundle install   # first time only
RUBYOPT="-r$PWD/bin/preview_logger_fix.rb" bundle exec jekyll serve --port 4000 --host 127.0.0.1
```

Then open http://127.0.0.1:4000/.
