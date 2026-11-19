const { join } = require('path');

/**
 * Keep Puppeteer's Chrome for Testing cache inside the build artifact. The
 * Puppeteer 25 install script downloads its supported Chrome revision here.
 */
module.exports = {
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
    skipDownload: false,
};
