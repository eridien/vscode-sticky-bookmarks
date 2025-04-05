const vscode = require('vscode');
const main   = require('./main.js');
const utils  = require('./utils.js');
const log    = utils.getLog('EXTN');

function activate(context) {
  main.init(context);
  utils.init(context);
	const toggleCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.toggle', function () {
		main.toggle();
	});
	const clearFileCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.clearFile', function () {
		main.clearFile();
	});
	context.subscriptions.push(toggleCmd, clearFileCmd);
  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
