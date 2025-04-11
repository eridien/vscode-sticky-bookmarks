const vscode    = require('vscode');
const token     = require('./token.js');
const sidebar   = require('./sidebar.js');
const marks     = require('./marks.js');
const keywords  = require('./keywords.js');
const utils     = require('./utils.js');
const log       = utils.getLog('extn');

function activate(context) {
  log('activate');

  utils   .init(context);
  keywords.init(context);
  marks   .init(context);

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
  
  const provider = new sidebar.SidebarProvider();

  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: provider,
  });

  treeView.onDidChangeVisibility((e) => {
    sidebar.visibleChange(provider, e.visible);
  });

	const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClick', (item) => sidebar.itemClickCmd(item)
  );

  const contextMenuCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.closeItem', (item) => sidebar.closeItem(item)
  );

  context.subscriptions.push(toggleCmd, prevCmd, nextCmd, 
                             clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd, 
                             itemClickCmd, contextMenuCmd);
  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
