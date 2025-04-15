const vscode    = require('vscode');
const comnd     = require('./commands.js');
const sidebar   = require('./sidebar.js');
const label     = require('./label.js');
const marks     = require('./marks.js');
const utils     = require('./utils.js');
const {start, end} = utils.getLog('extn');

async function activate(context) {
  start('extension');

	const toggleCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.toggle',        comnd.toggle);
	const prevCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.prev',          comnd.prev);
	const nextCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.next',          comnd.next);
	const clearFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearFile',     comnd.clearFile);
	const clearAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.clearAllFiles', comnd.clearAllFiles);
	const cleanFileCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanFile',     comnd.cleanFile);
	const cleanAllFilesCmd = vscode.commands.registerCommand(
                          'sticky-bookmarks.cleanAllFiles', comnd.cleanAllFiles);
  
  const sidebarProvider = new sidebar.SidebarProvider();

  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

	const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClick', (item) => sidebar.itemClick(item)
  );

  const contextMenuCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.deleteMark', (item) => sidebar.deleteMark(item)
  );

  context.subscriptions.push(toggleCmd, prevCmd, nextCmd, 
                             clearFileCmd, clearAllFilesCmd,
                             cleanFileCmd, cleanAllFilesCmd, 
                             itemClickCmd, contextMenuCmd);

  const glblFuncs = {};
  Object.assign(glblFuncs, await marks   .init(context, glblFuncs));
  Object.assign(glblFuncs,       utils   .init(context, glblFuncs));
  Object.assign(glblFuncs, await label   .init(context, glblFuncs));
  Object.assign(glblFuncs,       comnd   .init(context, glblFuncs));
  Object.assign(glblFuncs, await sidebar .init(context, glblFuncs, sidebarProvider));

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

  end('extension');
}

function deactivate() {}

module.exports = { activate, deactivate }
