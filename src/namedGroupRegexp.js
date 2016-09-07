/**
* Regular Expression to identify a capture group in PCRE formats
* `(?<name>regex)`, `(?'name'regex)` or `(?P<name>regex)` (see
* regular-expressions.info/refext.html); RegExp is built as a string
* to enable more detailed annotation.
*
* @type {RegExp}
* @author kadamwhite
* @link https://github.com/WP-API/node-wpapi/blob/0b4fbe8740fe4bf5b8c4e1a5c06127a9325d5d6d/lib/util/named-group-regexp.js
*/
export default new RegExp([
  // Capture group start
  '\\(\\?',
  // Capture group name begins either `P<`, `<` or `'`
  '(?:P<|<|\')',
  // Everything up to the next `>`` or `'` (depending) will be the capture group name
  '([^>\']+)',
  // Capture group end
  '[>\']',
  // Get everything up to the end of the capture group: this is the RegExp used
  // when matching URLs to this route, which we can use for validation purposes.
  '([^\\)]*)',
  // Capture group end
  '\\)',
].join(''));
