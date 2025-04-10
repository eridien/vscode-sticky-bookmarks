const vscode    = require('vscode');
const token     = require('./token.js');
const sidebar   = require('./sidebar.js');
const marks     = require('./marks.js');
const keywords  = require('./keywords.js');
const utils     = require('./utils.js');
const log       = utils.getLog('EXTN');

function activate(context) {
  log('activate');

  utils   .init(context);
  keywords.init(context);
  marks   .init(context);
  sidebar .init(context);
  token   .init(context);

	const toggleCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.toggle',        token.toggle);
	const prevCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.prev',          token.prev);
	const nextCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.next',          token.next);
	const clearFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearFile',     token.clearFile);
	const clearAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearAllFiles', token.clearAllFiles);
	const cleanFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanFile',     token.cleanFile);
	const cleanAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanAllFiles', token.cleanAllFiles);
  
  const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClick', (item) => sidebar.itemClickCmd(item)
  );

  vscode.window.registerTreeDataProvider(
    'sidebarView',
     new sidebar.SidebarProvider()
  );

	context.subscriptions.push(toggleCmd, prevCmd, nextCmd, 
                             clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd, itemClickCmd);
  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
