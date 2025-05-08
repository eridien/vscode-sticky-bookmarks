const vscode   = require('vscode');
const commands = require('./commands.js');
const sidebar  = require('./sidebar.js');
const text     = require('./text.js');
const marks    = require('./marks.js');
const settings = null;
const utils    = require('./utils.js');
const {log} = require('console');
const {start, end} = utils.getLog('extn');

async function activate(context) {
  start('activating extension');
  utils.initContext(context);
  if(!await utils.loadStickyBookmarksJson()) {
    end('extension');
    return;
  }
	const prevCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.prevCmd',                             commands.prevCmd);
	const nextCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nextCmd',                             commands.nextCmd);
	const toggleGen2Cmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen2Cmd',                 commands.toggleGen2Cmd);
	const toggleGen1Cmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen1Cmd',                 commands.toggleGen1Cmd);
     
	const prevGlobalCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.prevGlobalCmd',                  commands.prevGlobalCmd);
	const nextGlobalCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nextGlobalCmd',                 commands.nextGlobalCmd);
	const toggleGen2GlobalCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen2GlobalCmd',     commands.toggleGen2GlobalCmd);
	const toggleGen1GlobalCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.toggleGen1GlobalCmd',     commands.toggleGen1GlobalCmd);

	const delMarksInFileCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.delMarksInFileCmd',         commands.delMarksInFileCmd);
	const delMarksInFolderCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.delMarksInFolderCmd',     commands.delMarksInFolderCmd);
 	const hideCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.hideCmd',                             commands.hideCmd);

 const expandCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.expandCmd',                         commands.expandCmd);
 const refreshCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.refreshCmd',                       commands.refreshCmd);

  const itemClickCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.itemClickCmd',    (item) => commands.itemClickCmd(item));
  const moveFolderUpCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.moveFolderUpCmd', 
                                     (item) => commands.moveFolderUpCmd(item));
  const moveFolderDownCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.moveFolderDownCmd',    
                                   (item) => commands.moveFolderDownCmd(item));
   const eraseCmd = vscode.commands.registerCommand(
    'sticky-bookmarks.eraseCmd',            (item) => commands.eraseCmd(item));
	const nameCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.nameCmd',             (item) => commands.nameCmd(item));
	const deleteIconCmd = vscode.commands.registerCommand(
     'sticky-bookmarks.deleteIconCmd', (item) => commands.deleteIconCmd(item));

  const sidebarProvider = new sidebar.SidebarProvider();
  const treeView = vscode.window.createTreeView('sidebarView', {
    treeDataProvider: sidebarProvider,
  });

  await commands.init(context, treeView);
  await sidebar .init(treeView);
  await utils   .init(commands, sidebar, sidebarProvider, text, marks, settings);
  await text    .init(context);
  await marks   .init(context);

  // use this to track edits...
  vscode.workspace.onDidChangeTextDocument(async event => {
    const document = event.document;
    if (event?.document?.uri?.scheme !== 'file') { return }
    await commands.changedTextInDocument(event);
  });

  treeView.onDidChangeVisibility(async event => {
    await commands.changedSidebarVisiblitiy(event.visible);
  });

  vscode.window.onDidChangeVisibleTextEditors(async editors => {
    await commands.changedVisEditors(editors);
  });

  vscode.window.onDidChangeActiveTextEditor(async editor => {
    await commands.changedEditor(editor);
  });
  vscode.window.onDidChangeTextEditorSelection(async event => {
    if (event.textEditor?.document.uri.scheme !== 'file') return;
    await commands.changedSelection(event);
  });

  context.subscriptions.push(
                prevCmd, nextCmd, toggleGen2Cmd, toggleGen1Cmd, 
                prevGlobalCmd, nextGlobalCmd,
                toggleGen2GlobalCmd, toggleGen1GlobalCmd,
                delMarksInFileCmd, delMarksInFolderCmd, hideCmd, 
                expandCmd, refreshCmd, itemClickCmd, 
                moveFolderUpCmd, moveFolderDownCmd, eraseCmd, nameCmd,
                deleteIconCmd );
    
  end('activating extension');
}

function deactivate() {}


module.exports = { activate, deactivate }
