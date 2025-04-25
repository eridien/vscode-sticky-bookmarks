const vscode  = require('vscode');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

async function toggleCmd() {
  await text.toggle();
}

async function prevCmd() {
  await text.scrollToPrevNext(false);
}

async function nextCmd() {
  await text.scrollToPrevNext(true);
}

async function clearFileCmd(document) {
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'clearFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.clearFile(document);
}

async function deleteItemXCmd(item) {
  switch (item.type) {
    case 'folder': await clearAllFilesCmd(item.folderPath); break;
    case 'file':   await clearFileCmd(item.document);       break;
    case 'bookmark': await text.delMarkFromLineAndGlobal(
                 item.mark.document, item.mark.lineNumber); break;
  }
}

async function cleanFileCmd(document) {
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'cleanFileCmd, No active editor'); return; }
    document = editor.document;
  }
  await text.cleanFile(document)
}

async function clearAllFilesCmd() {
  await utils.runOnAllFilesInFolder(clearFileCmd);
}

async function cleanAllFilesCmd() {
  await utils.runOnAllFilesInFolder(cleanFileCmd);
}

async function hideAllCmd() {
  log('hideAllCmd');
}

let sidebarIsVisible = false;

async function changedSidebarVisiblitiy(visible) {
  if(visible && !sidebarIsVisible) {
    utils.updateSidebar();
  }
  sidebarIsVisible = visible;
  utils.updateSidebar(); 
}

async function changedDocument() {
  utils.updateSidebar();
}

async function changedEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  utils.updateSidebar();
}

async function changedVisEditors() {
  utils.updateSidebar();
}  

const changedSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.clearDecoration();
  await text.cleanFile(textEditor.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

const changedText = utils.debounce(async (event) => {
  const {document} = event;
  text.clearDecoration();
  await text.cleanFile(event.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

module.exports = { toggleCmd, prevCmd, nextCmd,
                   deleteItemXCmd, hideAllCmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

