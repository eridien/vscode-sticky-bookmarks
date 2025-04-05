const vscode = require('vscode');
const main   = require('./main.js');
const utils  = require('./utils.js');
const log    = utils.getLog('MAIN');

// Import the module and reference it with the alias vscode in your code below

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  main.init(context);
  utils.init(context);

	const toggleCmd = vscode.commands.registerCommand('sticky-bookmarks.toggle', function () {
		log('toggle');
	});

	context.subscriptions.push(toggleCmd);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
