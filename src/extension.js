const vscode   = require('vscode');
const commands = require('./commands.js');
const sidebar  = require('./sidebar.js');
const text     = require('./text.js');
const marks    = require('./marks.js');
const utils    = require('./utils.js');
const {start, end} = utils.getLog('extn');

async function activate(context) {
  start('activating extension');
  utils.initContext(context);
  if(!await utils.loadStickyBookmarksJson()) {
    end('extension');
    return;
  }
	const toggleCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleCmd',                         commands.toggleCmd);
	const prevCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.prevCmd',                             commands.prevCmd);
	const nextCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nextCmd',                             commands.nextCmd);
 	const hideCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.hideCmd',                             commands.hideCmd);
 const expandCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.expandCmd',                         commands.expandCmd);
 const refreshCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.refreshCmd',                       commands.refreshCmd);
	const deleteMenuCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteMenuCmd',                 commands.deleteMenuCmd);
	const deleteIconCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteIconCmd', (item) => commands.deleteIconCmd(item));
  const gotoCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.gotoCmd',              (item) => commands.gotoCmd(item));
  const eraseCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.eraseCmd',            (item) => commands.eraseCmd(item));
	const nameCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nameCmd',             (item) => commands.nameCmd(item));
  const clearAllSavedDataCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.clearAllSavedDataCmd',   commands.clearAllSavedDataCmd);
  const resetAllKeysCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.resetAllKeysCmd',              commands.resetAllKeysCmd);

  const sidebarProvider = new sidebar.SidebarProvider();
  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

  commands.init(context, treeView);
  await sidebar.init(treeView);
  utils.init(sidebarProvider, sidebar);
  await text.init(context);
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

  context.subscriptions.push(toggleCmd, prevCmd, nextCmd,
                             hideCmd, refreshCmd, expandCmd, deleteMenuCmd,
                             deleteIconCmd, gotoCmd, nameCmd, eraseCmd, 
                             clearAllSavedDataCmd, resetAllKeysCmd);
    
  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
