const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('MAIN');

function init() {
  log('main initialized');
}

module.exports = { init }