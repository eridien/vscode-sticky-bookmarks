const vscode            = require('vscode');
const sidebar           = require('./sidebar.js');
const text              = require('./text.js');
const marks             = require('./marks.js');
const utils             = require('./utils.js');
const {log, start, end} = utils.getLog('cmds');

let context, treeView, hiddenFolder = null;

function init(contextIn, treeViewIn) {
  context  = contextIn;
  treeView = treeViewIn;
}

////////////////////////////////  COMMANDS  ///////////////////////////////////

async function prevCmd(item) {
  log('prevCmd');
  await text.scrollToPrevNext(false);
}

async function nextCmd(item) {
  log('nextCmd');
  await text.scrollToPrevNext(true);
}

async function toggleGen2Cmd(item) {
  log('toggleGen2Cmd');
  await text.toggle(2);
  await text.refreshFile();
}

async function toggleGen1Cmd(item) {
  log('toggleGen1Cmd');
  await text.toggle(1);
  await text.refreshFile();
}


async function prevGlobalCmd(item) {
  log('prevGlobalCmd');
}

async function nextGlobalCmd(item) {
  log('nextGlobalCmd');
}

async function toggleGen2GlobalCmd(item) {
  log('toggleGen2GlobalCmd');
}

async function toggleGen1GlobalCmd(item) {
  log('toggleGen1GlobalCmd');
}

async function delMarksInFileCmd(document) {
  log('delMarksInFileCmd');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if(!editor) return;
    document = editor.document;
  }
  await text.deleteAllTokensInFile(document);
  await marks.deleteAllMarksFromFile(document);
}

async function delMarksInFolderCmd(item) {
  log('delMarksInFolderCmd');
  const editor = vscode.window.activeTextEditor;
  if(!editor) return;
  const wsFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  await utils.runOnFilesInFolder(wsFolder, async (file) => {
    await marks.deleteAllMarksFromFile(file);
  });
}

function getHiddenFolder() {//​.
  return hiddenFolder;
}

function clrHiddenFolder() {//​.
  hiddenFolder = null;
  log('clrHiddenFolder');
  utils.updateSide();
}

async function hideCmd(item) {//​.
  log('hideCmd');
  let wsFolder = null;
  const editor = vscode.window.activeTextEditor;
  if(editor) {
    wsFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  }
  if(!wsFolder) {
    const wsFolders = vscode.workspace.workspaceFolders;
    wsFolder = wsFolders && wsFolders.length > 0 
                          ? wsFolders[0] : undefined;
  }
  if(!wsFolder) {
    log('info', 'No workspace folder to hide');
    return;
  }
  hiddenFolder = wsFolder;
  await utils.runOnFilesInFolder(wsFolder, async (doc) => {
    await text.deleteAllTokensInFile(doc);
  });
  utils.updateSide();
}

async function expandCmd(item) {
  log('expandCmd');
  const allWsFolders = vscode.workspace.workspaceFolders;
  for(const wsFolder of allWsFolders) {
    const folderFsPath  = wsFolder.uri.fsPath;
    await sidebar.toggleFolder(folderFsPath, true, false);
    setTimeout( async ()=> { 
          await sidebar.toggleFolder(folderFsPath, false,  true) }, 20);
  }
}

async function refreshCmd(item) {
  log('refreshCmd');
  await text.refreshMenu();
}

async function itemClickCmd(item) {
  // log('itemClickCmd');
  await sidebar.itemClick(item);
}

async function moveFolderUpCmd(item) {
  log('moveFolderUpCmd');
}

async function moveFolderDownCmd(item) {
  log('moveFolderDownCmd');
}

async function eraseCmd(item) {
  log('eraseCmd');
}

async function nameCmd(item) {
  log('nameCmd');
}

async function deleteIconCmd(item) {
  log('deleteIconCmd');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected'); return; }
  }
  switch (item.type) {
    case 'folder':
      const fakeFolder = {uri:item.mark.folderUri()};
      await utils.runOnFilesInFolder(fakeFolder, marks.deleteAllMarksFromFile);
      break;
    case 'file':     await delMarksInFileCmd(item.document); break;
    case 'bookmark': await marks.deleteMark(item.mark);      break;
  }
}

////////////////////////////////  EVENTS  //////////////////////////////////
let sidebarIsVisible = false;

async function changedTextInDocument(event) {//​.
  // log('changedDocument');
  const {document, contentChanges} = event;
  log('\nchangedTextInDocument', document.uri.fsPath, '\n');
  for(const contentChange of contentChanges) {
    const {range, rangeOffset, rangeLength, text} = contentChange;
    log('text change', {range, rangeOffset, rangeLength, text});
  }
  utils.updateSide();
}

async function changedSidebarVisiblitiy(visible) {
  log('changedSidebarVisiblitiy');
  if(visible && !sidebarIsVisible) {
    utils.updateSide();
  }
  sidebarIsVisible = visible;
}

async function changedEditor(editor) {
  if(!editor || !editor.document) return;
  log('changedEditor');
  await text.refreshFile(editor.document);
}

async function changedVisEditors(editors) {
  log('changedVisEditors');
  for(const editor of editors) {
    if(editor.document.uri.scheme !== 'file') continue;
    // log('changedVisEditors', editor.document.fileName);
    await text.refreshFile(editor.document);
  }
}

async function changedSelection(event) {//​.
  log('changedSelection');
  // clrHiddenFolder();
  const {textEditor:editor, selections, kind} = event;
  if(editor.document.uri.scheme !== 'file') return;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    const tokens = text.getTokensInLine(editor.document, clickPos.line);
    for (const token of tokens) {
      const tokenRange = new vscode.Range(
        token.range.start.line, token.range.start.character+1,
        token.range.end.line,   token.range.end.character-1
      );
      if(tokenRange.contains(clickPos)) {
        const mark = await marks.getMarkByTokenRange(
                                           editor.document, token.range);
        if (mark) await marks.deleteMark(mark);
        break;
      }
    }
  }
  text.clearDecoration();
  await text.refreshFile(editor.document);
}

module.exports = { init, 
                   prevCmd, nextCmd, toggleGen2Cmd, toggleGen1Cmd, 
                   prevGlobalCmd, nextGlobalCmd, clrHiddenFolder,
                   toggleGen2GlobalCmd, toggleGen1GlobalCmd,
                   delMarksInFileCmd, delMarksInFolderCmd, hideCmd, 
                   expandCmd, refreshCmd, itemClickCmd, 
                   moveFolderUpCmd, moveFolderDownCmd, eraseCmd, nameCmd, 
                   deleteIconCmd, changedSidebarVisiblitiy, changedTextInDocument,
                   changedTextInDocument, changedEditor, getHiddenFolder,
                   changedVisEditors, changedSelection };

