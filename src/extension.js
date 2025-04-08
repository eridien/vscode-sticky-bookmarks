const vscode    = require('vscode');
const token     = require('./token.js');
const keywords  = require('./keywords.js');
const sidebar   = require('./sidebar.js');
const utils     = require('./utils.js');
const log       = utils.getLog('EXTN');

function activate(context) {
  log('activate');

  token.init(context);
  utils.init(context);
  keywords.init(context);

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
	const cleanFileCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.cleanFile', function () {
		token.cleanFile();
	});
	const cleanAllFilesCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.cleanAllFiles', function () {
		token.cleanAllFiles();
	});
	context.subscriptions.push(toggleCmd, clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd);

  vscode.window.registerTreeDataProvider(
    'sidebarView',
     new sidebar.SidebarProvider()
  );

  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
