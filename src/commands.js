const vscode  = require('vscode');
const sidebar = require('./sidebar.js');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

async function toggleCmd() {
  log('toggle command called');
  await text.toggle();
}

async function prevCmd() {
  log('prevCmd command called');
  await text.scrollToPrevNext(false);
}

async function nextCmd() {
  log('nextCmd command called');
  await text.scrollToPrevNext(true);
}

async function deleteMarkCmd(item) {
  // log('deleteMarkCmd command, X menu');
  const document = item.mark.document;
  switch (item.type) {
    case 'folder': await clearAllFilesCmd(item.mark.folderPath); break;
    case 'file':   await clearFileCmd(document);            break;
    default: {
      const line = document.lineAt(item.mark.lineNumber);
      await text.delMark(document, line, item.mark.languageId);
      sidebar.updateSidebar();
    }
  }
}

async function clearFileCmd(document) {
  if(!document) {
    log('clearFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'clearFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.clearFile(document);
}

async function cleanFileCmd(document) {
  if(!document) {
    log('cleanFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'cleanFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.cleanFile(document)
}

async function clearAllFilesCmd() {                          //:jsgi;
  log('clearAllFilesCmd command called');
  await utils.runOnAllFilesInFolder(clearFileCmd);
}

async function cleanAllFilesCmd() {
  log('cleanAllFilesCmd command called');
  await utils.runOnAllFilesInFolder(cleanFileCmd);
}

let sideBarIsVisible = false;
let firstVisible     = true;

async function sidebarVisibleChange(visible) {
  // log('sidebarVisibleChange', visible);
  if(visible && !sideBarIsVisible) {
    if(firstVisible) {
      firstVisible = false;
      await cleanAllFilesCmd();
    }
   sidebar.updateSidebar();
  }
  sideBarIsVisible = visible;
}

async function changeDocument() {
  // log('changeDocument', document.uri.path);
 sidebar.updateSidebar();
}

async function changeEditor(editor) {
  if(!editor || !editor.document) {
    log('changeEditor, no active editor');
    return;
  }
  // log('changeEditor', editor.document.uri.path);
 sidebar.updateSidebar();
}
async function changeVisEditors() {
  // log('changeVisEditors', editors.length);
 sidebar.updateSidebar();
}

async function changeSelection() {
  // log('changeSelection');
  // const uri      = editor.document.uri;
  // const position = editor.selection.active;
  // log('changeSelection', uri, position.line);
 sidebar.updateSidebar();
  text.clearDecoration();
  // treeView.selection = []; // doesn't work
}


module.exports = { toggleCmd, prevCmd, nextCmd,
                   deleteMarkCmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd,
                   sidebarVisibleChange, 
                   changeDocument, changeEditor, 
                   changeVisEditors, changeSelection };

