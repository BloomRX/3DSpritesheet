const path = require('node:path');
const { pathToFileURL } = require('node:url');

function isTrustedNavigation(destination, { isPackaged, appRoot, devOrigin } = {}) {
  try {
    const target = new URL(destination);
    if (isPackaged) {
      const trustedFile = new URL(pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href);
      return target.protocol === 'file:' && target.host === trustedFile.host && target.pathname === trustedFile.pathname && !target.search;
    }
    return Boolean(devOrigin && target.protocol === 'http:' && target.origin === devOrigin && !target.username && !target.password);
  } catch {
    return false;
  }
}

module.exports = { isTrustedNavigation };
