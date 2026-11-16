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

## Contact form

The "Get in touch" form on People > "You" sends each message to a Google Sheet in the lab's Google Drive and emails it to the account that deployed the script. Visitors choose what they are writing about (joining the lab, collaboration, media, supporter, other); for "joining the lab" they also choose a position (PhD student, postdoc, research intern, undergraduate researcher, visiting student/scholar, research staff) and can give their institution, start date, funding, interests and links. Up to 3 attachments (PDF, Word, PNG, JPEG; 5 MB each) are saved to a private Drive folder, "Daru Lab contact form uploads", linked in the sheet and attached to the email. The backend is `tools/contact_form_apps_script.gs` (not published with the site).

1. Create a Google Sheet in your Drive (e.g. "Daru Lab contact form").
2. In the sheet: **Extensions → Apps Script**, replace the sample code with the contents of `tools/contact_form_apps_script.gs`, and save.
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Deploy and approve the permissions (Sheets, Drive and email).
4. Copy the web app URL (ending in `/exec`) into `_config.yml` as `contact_form_endpoint: "https://script.google.com/macros/s/…/exec"`, then push.

While `contact_form_endpoint` is empty, the page shows a "Contact form coming soon" notice with the lab email instead of the form. After editing the script, use **Deploy → Manage deployments → Edit → New version** so the same URL keeps working.
