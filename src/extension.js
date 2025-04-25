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
	const toggleCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.toggleCmd',        commands.toggleCmd);
	const prevCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.prevCmd',          commands.prevCmd);
	const nextCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.nextCmd',          commands.nextCmd);
	const clearFileCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.clearFileCmd',     commands.clearFileCmd);
	const clearAllFilesCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.clearAllFilesCmd', commands.clearAllFilesCmd);
  const clearAllFilesMenuCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.clearAllFilesMenuCmd', 
                                                     commands.clearAllFilesCmd);
  const cleanAllFilesMenuCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.cleanAllFilesMenuCmd', 
                                                     commands.cleanAllFilesCmd);
  const hideAllMenuCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.hideAllMenuCmd', 
                                                     commands.hideAllCmd);
	const cleanFileCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.cleanFileCmd',     commands.cleanFileCmd);
	const cleanAllFilesCmd = vscode.commands.registerCommand(
                'sticky-bookmarks.cleanAllFilesCmd', commands.cleanAllFilesCmd);
  const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClickCmd', (item) =>   sidebar.itemClickCmd(item)
  );
  const contextMenuCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.deleteItemXCmd', (item) => commands.deleteItemXCmd(item)
  );

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
    if (!event?.textEditor) return;
    await commands.changedSelection(event);
  });

  context.subscriptions.push(toggleCmd, prevCmd, nextCmd, 
                             clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd, 
                             itemClickCmd, contextMenuCmd,
                             clearAllSavedDataCmd, resetAllCmd,
                             clearAllFilesMenuCmd, cleanAllFilesMenuCmd,
                             hideAllMenuCmd);

  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
