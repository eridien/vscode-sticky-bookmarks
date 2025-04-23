const vscode  = require('vscode');
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

async function clearAllFilesCmd() {
  // log('clearAllFilesCmd command called');
  await utils.runOnAllFilesInFolder(clearFileCmd);
}

async function cleanAllFilesCmd() {
  // log('cleanAllFilesCmd command called');
  await utils.runOnAllFilesInFolder(cleanFileCmd);
}

let sidebarIsVisible = false;

async function changedSidebarVisiblitiy(visible) {
  // log('changedSidebarVisiblitiy', visible);
  if(visible && !sidebarIsVisible) {
    // if(firstVisible) {
    //   firstVisible = false;
    //   await cleanAllFilesCmd();
    // }
   utils.updateSidebar();
  }
  sidebarIsVisible = visible;
   utils.updateSidebar();
}

async function changedDocument() {
  // log('changedDocument', document.uri.path);
 utils.updateSidebar();
}

async function changedEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  // log('changedEditor', editor.document.uri.path);
 utils.updateSidebar();
}

async function changedVisEditors() {
  // log('changedVisEditors', editors.length);
 utils.updateSidebar();
}  

const changedSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.clearDecoration();
  await text.cleanFile(textEditor.document);
  utils.updateSidebar();
}, 200);

const changedText = utils.debounce(async (event) => {

  // document: [TextDocument],
  // contentChanges: [
  //   { range: Range { start: [Position], end: [Position] },
  //     rangeLength: 0,
  //     text: 'a' }
  // ],
  // reason: undefined

  const {document} = event;
  text.clearDecoration();
  await text.cleanFile(event.document);
  utils.updateSidebar();
}, 200);

module.exports = { toggleCmd, prevCmd, nextCmd,
                   deleteItemXCmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

