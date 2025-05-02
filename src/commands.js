const vscode            = require('vscode');
const sidebar           = require('./sidebar.js');
const text              = require('./text.js');
const marks             = require('./marks.js');
const utils             = require('./utils.js');
const {log, start, end} = utils.getLog('cmds');

let context, treeView;

function init(contextIn, treeViewIn) {
  context  = contextIn;
  treeView = treeViewIn;
}

////////////////////////////////  COMMANDS  ///////////////////////////////////

async function toggleGen1Cmd() {
  log('toggleGen1Cmd');
  await text.toggle(1);
  await text.refreshFile();
}

async function toggleGen2Cmd() {
  log('toggleGen2Cmd');
  await text.toggle(2);
  await text.refreshFile();
}

async function prevCmd() {
  log('prevCmd');
  await text.scrollToPrevNext(false);
}

async function nextCmd() {
  log('nextCmd');
  await text.scrollToPrevNext(true);
}

async function hideCmd() {
  log('hideCmd');
  utils.updateSide();
}

async function expandCmd() {
  log('expandCmd');
  const allWsFolders = vscode.workspace.workspaceFolders;
  for(const wsFolder of allWsFolders) {
    const folderFsPath  = wsFolder.uri.fsPath;
    await sidebar.toggleFolder(folderFsPath, true, false);
    setTimeout( async ()=> { 
          await sidebar.toggleFolder(folderFsPath, false,  true) }, 20);
  }
}

async function refreshCmd() {
  log('refreshCmd');
  await text.refreshMenu();
}

async function delMarksInFileCmd() {
  log('delMarksInFileCmd');
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await text.deleteAllTokensFromFile(editor.document);
    await marks.deleteAllMarks();
    utils.updateSide();
  }
}

async function deleteIconCmd(item) {
  log('deleteIconCmd');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected For Deletion'); return; }
  }
  // switch (item.type) {
  //   case 'folder':   await utils.runOnAllFilesInFolder(hideCmd); break;
  //   case 'file':     await utils.runOnAllFilesInFolder(hideCmd); break;
  //   case 'bookmark': await text.delMarkFromLineAndGlobal(
  //                       item.mark.document, item.mark.lineNumber); break;
  // }
}

async function nameCmd(item) {
  log('nameCmd');

}

async function eraseCmd(item) {
  log('eraseCmd');

}

async function itemClickCmd(item) {
  log('itemClickCmd');
  await sidebar.itemClick(item);
}

////////////////////////////////  CALLBACKS  //////////////////////////////////
let sidebarIsVisible = false;

async function changedSidebarVisiblitiy(visible) {
  if(visible && !sidebarIsVisible) {
    utils.updateSide();
  }
  sidebarIsVisible = visible;
  utils.updateSide(); 
}

async function changedDocument() {
  utils.updateSide();
}

async function changedEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  await text.refreshFile(editor.document);
  utils.updateSide();
}

async function changedVisEditors(editors) {
  for(const editor of editors)
    await text.refreshFile(editor.document);
  utils.updateSide();
}  

const changedSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  if(textEditor.document.uri.scheme !== 'file') return;
  text.clearDecoration();
  await text.refreshFile(textEditor.document);
  utils.updateSide(); 
}, 200);

const changedText = utils.debounce(async (event) => {
  const {document} = event;
  text.clearDecoration();
  await text.refreshFile(event.document);
  utils.updateSide(); 
}, 200);

module.exports = { init, toggleGen2Cmd, toggleGen1Cmd, prevCmd, nextCmd, 
                   hideCmd, refreshCmd, expandCmd, delMarksInFileCmd, 
                   itemClickCmd, nameCmd, eraseCmd, deleteIconCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

