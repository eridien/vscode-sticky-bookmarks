const vscode  = require('vscode');
const sidebar = require('./sidebar.js');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

async function toggleCmd() {
  // log('toggle command called');
  await text.toggle();
}

async function prevCmd() {
  // log('prevCmd command called');
  await text.scrollToPrevNext(false);
}

async function nextCmd() {
  // log('nextCmd command called');
  await text.scrollToPrevNext(true);
}

async function clearFileCmd(document) {
  if(!document) {
    // log('clearFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'clearFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.clearFile(document);
}

async function deleteItemXCmd(item) {
  // log('deleteItemXCmd command, X menu');
  switch (item.type) {
    case 'folder': await clearAllFilesCmd(item.folderPath); break;
    case 'file':   await clearFileCmd(item.document);       break;
    case 'bookmark': await text.delMarkFromLineAndGlobal(
                 item.mark.document, item.mark.lineNumber); break;
  }
}

async function cleanFileCmd(document) {
  if(!document) {
    // log('cleanFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'cleanFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.cleanFile(document)
}

async function clearAllFilesCmd() {                          //
  // log('clearAllFilesCmd command called');
  await utils.runOnAllFilesInFolder(clearFileCmd);
}

async function cleanAllFilesCmd() {
  // log('cleanAllFilesCmd command called');
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
   await sidebar.updateSidebar();
  }
  sideBarIsVisible = visible;
}

async function changeDocument() {
  // log('changeDocument', document.uri.path);
 await sidebar.updateSidebar();
}

async function changeEditor(editor) {
  if(!editor || !editor.document) {
    // log('changeEditor, no active editor');
    return;
  }
  // log('changeEditor', editor.document.uri.path);
 await sidebar.updateSidebar();
}

async function changeVisEditors() {
  // log('changeVisEditors', editors.length);
 await sidebar.updateSidebar();
}  

const changeSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.clearDecoration();
  await text.cleanFile(textEditor.document);
  await sidebar.updateSidebar(textEditor);
});

module.exports = { toggleCmd, prevCmd, nextCmd,
                   deleteItemXCmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd,
                   sidebarVisibleChange, 
                   changeDocument, changeEditor, 
                   changeVisEditors, changeSelection };

