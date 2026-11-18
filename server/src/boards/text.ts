import { convert } from 'html-to-text';

// Greenhouse sends its HTML escaped inside the JSON ("&lt;p&gt;"). One pass, with &amp; last, so "&amp;lt;" stays "&lt;".
export function unescapeHtml(escaped: string): string {
  return escaped
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Descriptions are stored as plain text, so no untrusted markup is ever stored or shown.
export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      // The default shouts headings in capitals, which would distort the text used for scoring.
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      { selector: 'h4', options: { uppercase: false } },
    ],
  });
}
