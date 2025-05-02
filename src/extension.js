const vscode   = require('vscode');
const commands = require('./commands.js');
const sidebar  = require('./sidebar.js');
const text     = require('./text.js');
const marks    = require('./marks.js');
const settings = null;
const utils    = require('./utils.js');
const {start, end} = utils.getLog('extn');

async function activate(context) {
  start('activating extension');
  utils.initContext(context);
  if(!await utils.loadStickyBookmarksJson()) {
    end('extension');
    return;
  }
	const toggleGen2Cmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen2Cmd',                         commands.toggleGen2Cmd);
	const toggleGen1Cmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen1Cmd',                 commands.toggleGen1Cmd);
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
	const delMarksInFileCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.delMarksInFileCmd',                 commands.delMarksInFileCmd);
	const deleteIconCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteIconCmd', (item) => commands.deleteIconCmd(item));
  const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClickCmd',    (item) => commands.itemClickCmd(item));
  const eraseCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.eraseCmd',            (item) => commands.eraseCmd(item));
	const nameCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nameCmd',             (item) => commands.nameCmd(item));

  const sidebarProvider = new sidebar.SidebarProvider();
  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

  commands.init(context, treeView);
  await sidebar.init(treeView);
  utils.init(commands, sidebar, sidebarProvider, text, marks, settings);
  await text.init(context);
  await marks.init(context);
  
  utils.refreshFile();
  utils.updateSide();

  treeView.onDidChangeVisibility(async event => {
    await commands.changedSidebarVisiblitiy(event.visible);
  });
  vscode.window.onDidChangeVisibleTextEditors(async editors => {
    // console.log('Currently visible editors:', editors);
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

  context.subscriptions.push(toggleGen2Cmd, toggleGen1Cmd, prevCmd, nextCmd,
                             hideCmd, refreshCmd, expandCmd, delMarksInFileCmd,
                             deleteIconCmd, itemClickCmd, nameCmd, eraseCmd );
    
  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
