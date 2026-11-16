/**
 * Daru Lab website: contact form backend (Google Apps Script web app).
 *
 * The form on People > "You" (_includes/contact-form.html) POSTs form-encoded fields here.
 * Each valid submission is appended to the "Submissions" sheet and emailed to the account that
 * deployed the script, with Reply-To set to the sender. Attachments (up to 3; PDF, Word, PNG or
 * JPEG; 5 MB each) are saved to a private Drive folder ("Daru Lab contact form uploads"), linked
 * in the sheet and attached to the email.
 *
 * SETUP (one time, about 5 minutes)
 *  1. Create a Google Sheet in your Drive, e.g. "Daru Lab contact form".
 *  2. In that sheet: Extensions -> Apps Script. Delete the sample code, paste this whole file, Save.
 *  3. Deploy -> New deployment -> gear icon -> Web app.
 *       Description: Contact form
 *       Execute as:  Me
 *       Who has access: Anyone
 *     Click Deploy and approve the permissions (Sheets, Drive for attachments, send email as you).
 *  4. Copy the Web app URL (it ends in /exec) into _config.yml:
 *       contact_form_endpoint: "https://script.google.com/macros/s/XXXX/exec"
 *     then rebuild / push the site.
 *
 *  To test: open the /exec URL in a browser; it should show {"ok":true,"service":"contact-form"}.
 *  After editing this script: Deploy -> Manage deployments -> edit -> Version: New version,
 *  so the same /exec URL serves the new code. (Upgrading from the first version adds Drive
 *  permission: approve it when asked. New columns are added to the right of the old ones.)
 */

var SHEET_NAME = 'Submissions';
var HEADERS = ['Timestamp', 'Name', 'Email', 'Role', 'Subject', 'Message', 'Page', 'User agent',
               'Interest', 'Position', 'Institution', 'Start', 'Funding', 'Links', 'Research interests',
               'Attachments'];
var MAX_MESSAGE = 3000;
var MIN_FILL_MS = 3000;
var MAX_FILES = 3;
var MAX_FILE_BYTES = 5 * 1024 * 1024;
var OK_FILE = /\.(pdf|docx?|png|jpe?g)$/i;
var UPLOAD_FOLDER = 'Daru Lab contact form uploads';

function doPost(e) {
  var p = (e && e.parameter) || {};
  var name = clean_(p.name, 200);
  var email = clean_(p.email, 320);
  var role = clean_(p.role, 100);
  var subject = clean_(p.subject, 200);
  var message = String(p.message || '').trim();
  var page = clean_(p.page, 500);
  var ua = clean_(p.ua, 500);
  var interest = clean_(p.interest, 100);
  var position = clean_(p.position, 100);
  var institution = clean_(p.institution, 200);
  var start = clean_(p.start, 100);
  var funding = clean_(p.funding, 200);
  var links = clean_(p.links, 400);
  var research = clean_(p.research, 300);

  // Spam checks: honeypot filled, or submitted faster than a person could type.
  if (String(p.website || '').trim() !== '') return json_({ ok: false, error: 'rejected' });
  var elapsed = Number(p.elapsed_ms);
  if (!isFinite(elapsed) || elapsed < MIN_FILL_MS) return json_({ ok: false, error: 'too_fast' });

  // Content checks.
  if (!name) return json_({ ok: false, error: 'name_required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'email_invalid' });
  if (!message) return json_({ ok: false, error: 'message_required' });
  if (message.length > MAX_MESSAGE) return json_({ ok: false, error: 'message_too_long' });
  if (p.consent !== 'yes') return json_({ ok: false, error: 'consent_required' });

  // Attachments: decoded, checked and saved privately in Drive.
  var blobs = [], urls = [];
  var nFiles = Math.min(Number(p.n_files) || 0, MAX_FILES);
  for (var i = 0; i < nFiles; i++) {
    var fname = clean_(p['file' + i + '_name'], 150).replace(/[\\/:*?"<>|]/g, '_');
    var data = p['file' + i + '_data'];
    if (!fname || !data || !OK_FILE.test(fname)) continue;
    var bytes;
    try { bytes = Utilities.base64Decode(String(data)); } catch (err) { continue; }
    if (bytes.length > MAX_FILE_BYTES) continue;
    blobs.push(Utilities.newBlob(bytes, clean_(p['file' + i + '_type'], 100) || 'application/octet-stream', fname));
  }
  if (blobs.length) {
    try {
      var folder = folder_();
      var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
      blobs.forEach(function (b) {
        var f = folder.createFile(b.copyBlob().setName(stamp + '_' + name.replace(/\s+/g, '-') + '_' + b.getName()));
        urls.push(f.getUrl());
      });
    } catch (err) {
      urls.push('(attachments could not be saved: ' + err + ')');
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = sheet_();
    sheet.appendRow([new Date(), name, email, role, subject, message, page, ua,
                     interest, position, institution, start, funding, links, research, urls.join('\n')].map(safe_));
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  } finally {
    lock.releaseLock();
  }

  try {
    var to = Session.getEffectiveUser().getEmail();
    var lines = ['Name: ' + name, 'Email: ' + email, 'About: ' + interest];
    if (position) lines = lines.concat(['Position: ' + position, 'Institution: ' + institution, 'Start: ' + start,
                                        'Funding: ' + funding, 'Research interests: ' + research, 'Links: ' + links]);
    lines = lines.concat(['Subject: ' + subject, '', message, '', '---']);
    if (urls.length) lines.push('Attachments (Drive): ' + urls.join(' '));
    lines = lines.concat(['Page: ' + page, 'User agent: ' + ua, 'Saved to: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()]);
    MailApp.sendEmail({
      to: to,
      replyTo: email,
      subject: 'Daru Lab contact form: ' + (position ? position + ' inquiry' : (subject || interest || 'new message')) + ' (' + name + ')',
      body: lines.join('\n'),
      attachments: blobs
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

function folder_() {
  var it = DriveApp.getFoldersByName(UPLOAD_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(UPLOAD_FOLDER);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {             // upgrade from the first version
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
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
