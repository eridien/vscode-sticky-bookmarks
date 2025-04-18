const vscode    = require('vscode');
const cmd       = require('./commands.js');
const sidebar   = require('./sidebar.js');
const files     = require('./text.js');
const marks     = require('./marks.js');
const utils     = require('./utils.js');
const {start, end} = utils.getLog('extn');

function waitForWorkspaceFolder() {
  return new Promise((resolve) => {
    const checkWsFldr = () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        resolve();
      } else {
        setTimeout(waitForWorkspaceFolder, 50);
      }
    };
    checkWsFldr();
  });
}

async function activate(context) {
  start('activating extension');
  await waitForWorkspaceFolder();
  const glblFuncs = {};
  Object.assign(glblFuncs, utils.init(context, glblFuncs));
  if(!await utils.loadStickyBookmarksJson()) {
    end('extension');
    return;
  }
  
	const toggleCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.toggleCmd',        cmd.toggleCmd);
	const prevCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.prevCmd',          cmd.prevCmd);
	const nextCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.nextCmd',          cmd.nextCmd);
	const clearFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearFileCmd',     cmd.clearFileCmd);
	const clearAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearAllFilesCmd', cmd.clearAllFilesCmd);
	const cleanFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanFileCmd',     cmd.cleanFileCmd);
	const cleanAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanAllFilesCmd', cmd.cleanAllFilesCmd);
  	const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClickCmd', (item) => sidebar.itemClickCmd(item)
  );
  const contextMenuCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.deleteMarkCmd', (item) => sidebar.deleteMarkCmd(item)
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

  const sidebarProvider = new sidebar.SidebarProvider();
  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

  Object.assign(glblFuncs, await marks   .init(context, glblFuncs));
  Object.assign(glblFuncs, await files   .init(glblFuncs));
  Object.assign(glblFuncs,       cmd   .init(glblFuncs));
  Object.assign(glblFuncs, await sidebar .init(
                              glblFuncs, sidebarProvider, treeView));

  treeView.onDidChangeVisibility(async event => {
    await sidebar.sidebarVisibleChange(event.visible);
  });

  vscode.window.onDidChangeVisibleTextEditors(async editors => {
    console.log('Currently visible editors:', editors);
    await sidebar.changeVisEditors(editors);
  });

  vscode.workspace.onDidChangeTextDocument(async event => {
    const document = event.document;
    const uri = document.uri;
    if (uri.scheme !== 'file') { 
      // ignore virtual/extension docs like output channel write
      // must use console.log here or we get an infinite loop
      // console.log('Ignored non-file changeTextDocument', uri.path);
      return;
    }
    await sidebar.changeDocument(document);
  });

  vscode.window.onDidChangeActiveTextEditor(async editor => {
    await sidebar.changeEditor(editor);
  });

  vscode.window.onDidChangeTextEditorSelection(async event => {
    const editor = event.textEditor;
    const uri    = editor.document.uri;
    if (uri.scheme !== 'file') { 
      // ignore virtual/extension docs like output channel write
      // must use console.log here or we get an infinite loop
      // console.log('Ignored non-file changeTextDocument', uri.path);
      return;
    }
    await sidebar.changeSelection(editor);
  });

  context.subscriptions.push(toggleCmd, prevCmd, nextCmd, 
                             clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd, 
                             itemClickCmd, contextMenuCmd,
                             clearAllSavedDataCmd);

  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
