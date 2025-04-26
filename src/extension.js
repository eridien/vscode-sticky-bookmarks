const vscode   = require('vscode');
const commands = require('./commands.js');
const sidebar  = require('./sidebar.js');
const text     = require('./text.js');
const marks    = require('./marks.js');
const utils    = require('./utils.js');
const {start, end} = utils.getLog('extn');

async function activate(context) {
  start('activating extension');
  utils.init(context);
  if(!await utils.loadStickyBookmarksJson()) {
    end('extension');
    return;
  }
	const toggleKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleKeyCmd',                   commands.toggleKeyCmd);
	const prevKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.prevKeyCmd',                       commands.prevKeyCmd);
	const nextKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nextKeyCmd',                       commands.nextKeyCmd);
  const refreshFileKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.refreshFileKeyCmd',         commands.refreshFileKeyCmd);
  const refreshAllFilesKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.refreshAllFilesKeyCmd', commands.refreshAllFilesKeyCmd);
	const deleteFileKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteFileKeyCmd',           commands.deleteFileKeyCmd);
  const deleteAllFilesKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteAllFilesKeyCmd',   commands.deleteAllFilesKeyCmd);

  const hideAllTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.hideAllTitleCmd',             commands.hideAllTitleCmd);
	const refreshAllTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.refreshAllTitleCmd',       commands.refreshAllTitleCmd);
	const deleteAllTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteAllTitleCmd',         commands.deleteAllTitleCmd);

  const eraseNameItemCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.eraseNameItemCmd',   
                                    (item) => commands.eraseNameItemCmd(item));
  const editNameItemCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.editNameItemCmd',   
                                     (item) => commands.editNameItemCmd(item));
  const refreshItemCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.refreshItemCmd',(item) => commands.refreshItemCmd(item));
  const deleteItemCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteItemCmd', 
                                       (item) => commands.deleteItemCmd(item));

  const clickItemCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.clickItemCmd',    (item) => commands.clickItemCmd(item));

  const clearAllSavedDataCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.clearAllSavedDataCmd',   commands.clearAllSavedDataCmd);

  const resetAllKeysCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.resetAllKeysCmd',              commands.resetAllKeysCmd);

  const sidebarProvider = new sidebar.SidebarProvider();
  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

  sidebar.init(treeView);
  utils.initProvider(sidebarProvider);
  text.init(context);
  await marks.init(context);

  treeView.onDidChangeVisibility(async event => {
    await commands.changedSidebarVisiblitiy(event.visible);
  });
  vscode.window.onDidChangeVisibleTextEditors(async editors => {
    console.log('Currently visible editors:', editors);
    await commands.changedVisEditors(editors);
  });
  vscode.workspace.onDidChangeTextDocument(async event => {
    const document = event.document;
    if (event?.document?.uri?.scheme !== 'file') { 
      // ignore virtual/extension docs like output channel write
      // must use console.log here or we get an infinite loop
      // console.log('Ignored non-file changeTextDocument', uri.path);
      return;
    }
    await commands.changedDocument(document);
  });
  vscode.window.onDidChangeActiveTextEditor(async editor => {
    await commands.changedEditor(editor);
  });
  vscode.window.onDidChangeTextEditorSelection(async event => {
    if (event?.textEditor?.document?.uri?.scheme !== 'file') return;
    await commands.changedSelection(event);
  });

  context.subscriptions.push(toggleKeyCmd, prevKeyCmd, nextKeyCmd,
                             refreshFileKeyCmd, refreshAllFilesKeyCmd,
                             deleteFileKeyCmd, deleteAllFilesKeyCmd,
                             hideAllTitleCmd, refreshAllTitleCmd, deleteAllTitleCmd,
                             eraseNameItemCmd, editNameItemCmd,
                             refreshItemCmd, deleteItemCmd,
                             clickItemCmd, clearAllSavedDataCmd, resetAllKeysCmd);
    
  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
