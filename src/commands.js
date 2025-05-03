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

async function prevItemCmd() {
  log('prevItemCmd');
  await sidebar.jumpToPrevNextItem(false);
}

async function nextItemCmd() {
  log('nextItemCmd');
  await sidebar.jumpToPrevNextItem(true);
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

async function delMarksInFileCmd(document) {
  log('delMarksInFileCmd');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if(!editor) return;
    document = editor.document;
  }
  await text.deleteAllTokensFromFile(document);
  await marks.deleteAllMarksFromFile(document);
}

async function deleteIconCmd(item) {
  log('deleteIconCmd');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected'); return; }
  }
  switch (item.type) {
    case 'folder':
      const folderUri  = vscode.Uri.file(item.folderFsPath);
      const fakeFolder = {uri:folderUri};
      await utils.runOnFilesInFolder(fakeFolder, marks.deleteAllMarksFromFile);
      break;
    case 'file':     await delMarksInFileCmd(item.document); break;
    case 'bookmark': await marks.deleteMark(item.mark);      break;
  }
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
}

async function changedVisEditors(editors) {
  for(const editor of editors)
    await text.refreshFile(editor.document);
}  

async function changedSelection(event) {
  const {textEditor:editor, selections, kind} = event;
  if(editor.document.uri.scheme !== 'file') return;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    const mark = marks.getMarkForLine(editor.document, clickPos.line);
    if(mark && mark.gen === 2) {
      const tokenRange = marks.getMarkTokenRange(mark);
      if(tokenRange?.contains(clickPos)) 
        await marks.deleteMark(mark, true, false);
    }
  }
  text.clearDecoration();
  await text.refreshFile(editor.document);
}

async function changedText(event) {
  const {document} = event;
  text.clearDecoration();
  await text.refreshFile(event.document);
}

module.exports = { init, toggleGen2Cmd, toggleGen1Cmd, 
                   prevCmd, nextCmd, prevItemCmd, nextItemCmd, 
                   hideCmd, refreshCmd, expandCmd, delMarksInFileCmd, 
                   itemClickCmd, nameCmd, eraseCmd, deleteIconCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

