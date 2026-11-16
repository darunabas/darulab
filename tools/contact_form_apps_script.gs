/**
 * Daru Lab website: contact form backend (Google Apps Script web app).
 *
 * The form on People > "You" (_includes/contact-form.html) POSTs form-encoded fields here.
 * Each valid submission is appended to the "Submissions" sheet and emailed to the account that
 * deployed the script, with Reply-To set to the sender.
 *
 * SETUP (one time, about 5 minutes)
 *  1. Create a Google Sheet in your Drive, e.g. "Daru Lab contact form".
 *  2. In that sheet: Extensions -> Apps Script. Delete the sample code, paste this whole file, Save.
 *  3. Deploy -> New deployment -> gear icon -> Web app.
 *       Description: Contact form
 *       Execute as:  Me
 *       Who has access: Anyone
 *     Click Deploy and approve the permissions (Sheets + send email as you).
 *  4. Copy the Web app URL (it ends in /exec) into _config.yml:
 *       contact_form_endpoint: "https://script.google.com/macros/s/XXXX/exec"
 *     then rebuild / push the site.
 *
 *  To test: open the /exec URL in a browser; it should show {"ok":true,"service":"contact-form"}.
 *  After editing this script: Deploy -> Manage deployments -> edit -> Version: New version,
 *  so the same /exec URL serves the new code.
 */

var SHEET_NAME = 'Submissions';
var HEADERS = ['Timestamp', 'Name', 'Email', 'Role', 'Subject', 'Message', 'Page', 'User agent'];
var MAX_MESSAGE = 3000;
var MIN_FILL_MS = 3000;

function doPost(e) {
  var p = (e && e.parameter) || {};
  var name = clean_(p.name, 200);
  var email = clean_(p.email, 320);
  var role = clean_(p.role, 100);
  var subject = clean_(p.subject, 200);
  var message = String(p.message || '').trim();
  var page = clean_(p.page, 500);
  var ua = clean_(p.ua, 500);

  // Spam checks: honeypot filled, or submitted faster than a person could type.
  if (String(p.website || '').trim() !== '') return json_({ ok: false, error: 'rejected' });
  var elapsed = Number(p.elapsed_ms);
  if (!isFinite(elapsed) || elapsed < MIN_FILL_MS) return json_({ ok: false, error: 'too_fast' });

  // Content checks.
  if (!name) return json_({ ok: false, error: 'name_required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'email_invalid' });
  if (!message) return json_({ ok: false, error: 'message_required' });
  if (message.length > MAX_MESSAGE) return json_({ ok: false, error: 'message_too_long' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = sheet_();
    sheet.appendRow([new Date(), name, email, role, subject, message, page, ua].map(safe_));
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  } finally {
    lock.releaseLock();
  }

  try {
    var to = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: to,
      replyTo: email,
      subject: 'Daru Lab contact form: ' + (subject || role || 'new message') + ' (' + name + ')',
      body: [
        'Name: ' + name,
        'Email: ' + email,
        'I am a: ' + role,
        'Subject: ' + subject,
        '',
        message,
        '',
        '---',
        'Page: ' + page,
        'User agent: ' + ua,
        'Saved to: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
      ].join('\n')
    });
  } catch (err) {
    // The row is saved even if the notification email fails (e.g. daily quota).
  }

  return json_({ ok: true });
}

// Health check: opening the /exec URL in a browser.
function doGet() {
  return json_({ ok: true, service: 'contact-form' });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// Formula-injection guard: values starting with = + - @ are stored as plain text.
function safe_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
