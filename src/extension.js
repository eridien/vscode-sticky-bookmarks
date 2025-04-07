const vscode = require('vscode');
const token  = require('./token.js');
const utils  = require('./utils.js');
const log    = utils.getLog('EXTN');

function activate(context) {
  log('activate');

  token.init(context);
  utils.init(context);
	const toggleCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.toggle', function () {
		token.toggle();
	});
	const clearFileCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.clearFile', function () {
		token.clearFile();
	});
	const clearAllFilesCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.clearAllFiles', function () {
		token.clearAllFiles();
	});
  console.log(typeof toggleCmd.dispose);
	context.subscriptions.push(toggleCmd, clearFileCmd, clearAllFilesCmd);
  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
