const test = require('node:test');
const assert = require('node:assert/strict');

const { extractOnionUrl, platformDirName } = require('./runtime-utils');

test('extractOnionUrl handles current CLI output', () => {
  assert.equal(
    extractOnionUrl('[voxvera] Onion URL: http://test123.onion'),
    'http://test123.onion'
  );
});

test('extractOnionUrl handles legacy OnionShare output', () => {
  assert.equal(
    extractOnionUrl('OnionShare is hosting at http://legacy456.onion'),
    'http://legacy456.onion'
  );
});

test('extractOnionUrl returns null when no onion URL is present', () => {
  assert.equal(extractOnionUrl('still bootstrapping'), null);
});

test('platformDirName maps bundled resource folders correctly', () => {
  assert.equal(platformDirName('linux'), 'linux');
  assert.equal(platformDirName('darwin'), 'mac');
  assert.equal(platformDirName('win32'), 'win');
});
