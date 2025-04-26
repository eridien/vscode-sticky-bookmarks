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
	const clearFileKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.clearFileKeyCmd',             commands.clearFileKeyCmd);
	const clearAllFilesKeyCmd = vscode.commands.registerCommand(
         'sticky-bookmarks.clearAllFilesKeyCmd', commands.clearAllFilesKeyCmd);
  const cleanFileKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanFileKeyCmd',             commands.cleanFileKeyCmd);
  const cleanAllFilesKeyCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanAllFilesKeyCmd',     commands.cleanAllFilesKeyCmd);

  const hideAllTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.hideAllTitleCmd',             commands.hideAllTitleCmd);
	const cleanAllFilesTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanAllFilesTitleCmd', commands.cleanAllFilesTitleCmd);
	const clearAllFilesTitleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.clearAllFilesTitleCmd', commands.clearAllFilesTitleCmd);

  const cleanFldrFilesItemCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanFldrFilesItemCmd', 
                                (item) => sidebar.cleanFldrFilesItemCmd(item));
  const cleanFileItemCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanFileItemCmd', 
                                    (item) => commands.cleanFileItemCmd(item));
  const cleanItemCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.cleanItemCmd',   (item) => commands.cleanItemCmd(item));

  const clearAllSavedDataCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.clearAllSavedData', async () => {
      for (const key of context.workspaceState.keys()) {
        await context.workspaceState.update(key, undefined);
      }
      for (const key of context.globalState.keys()) {
        await context.globalState.update(key, undefined);
      }
      vscode.window.showInformationMessage(
            'Sticky Bookmarks: All saved data has been cleared.');
    });

    const resetAllCmd = vscode.commands.registerCommand(
      'sticky-bookmarks.resetAll', async () => {
      for (const key of context.workspaceState.keys()) 
        await context.workspaceState.update(key, undefined);
      for (const key of context.globalState.keys()) 
        await context.globalState.update(key, undefined);
      vscode.window.showInformationMessage('Sticky Bookmarks keybindings reset.');
    });

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
                             clearFileKeyCmd, clearAllFilesKeyCmd,
                             cleanFileKeyCmd, cleanAllFilesKeyCmd, 
                             itemClickCmd, 
                             cleanItemCmd,
                             clearAllSavedDataCmd, resetAllCmd,
                             clearAllFilesTitleCmd, cleanAllFilesTitleCmd,
                             hideAllTitleCmd);

  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
