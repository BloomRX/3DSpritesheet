const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isTrustedNavigation } = require('../electron/navigation-guard.cjs');

const appRoot = path.resolve('/opt/Lia Forge');
const trustedFile = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href;

assert.equal(isTrustedNavigation(trustedFile, { isPackaged: true, appRoot }), true);
assert.equal(isTrustedNavigation(`${trustedFile}#activity`, { isPackaged: true, appRoot }), true);
assert.equal(isTrustedNavigation(`${trustedFile}?redirect=https://example.com`, { isPackaged: true, appRoot }), false);
assert.equal(isTrustedNavigation(pathToFileURL(path.join(appRoot, 'secret.html')).href, { isPackaged: true, appRoot }), false);
assert.equal(isTrustedNavigation('https://example.com/', { isPackaged: true, appRoot }), false);

const devContext = { isPackaged: false, devOrigin: 'http://127.0.0.1:5173' };
assert.equal(isTrustedNavigation('http://127.0.0.1:5173/', devContext), true);
assert.equal(isTrustedNavigation('http://127.0.0.1:5173/activity?view=all', devContext), true);
assert.equal(isTrustedNavigation('http://user:pass@127.0.0.1:5173/', devContext), false);
assert.equal(isTrustedNavigation('https://127.0.0.1:5173/', devContext), false);
assert.equal(isTrustedNavigation('http://127.0.0.1:5174/', devContext), false);
assert.equal(isTrustedNavigation('https://example.com/', devContext), false);
assert.equal(isTrustedNavigation('not a url', devContext), false);

console.log('Electron navigation guard smoke test passed.');
