const vscode  = require('vscode');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

let sidebarProvider;

function init(contextIn, sidebarProviderIn) {
  sidebarProvider = sidebarProviderIn;
}

function updateSidebar() { sidebarProvider._onDidChangeTreeData.fire() }

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

let sidebarIsVisible = false;
let firstVisible     = true;

async function sidebarVisibleChange(visible) {
  // log('sidebarVisibleChange', visible);
  if(visible && !sidebarIsVisible) {
    if(firstVisible) {
      firstVisible = false;
      await cleanAllFilesCmd();
    }
   updateSidebar();
  }
  sidebarIsVisible = visible;
}

async function changeDocument() {
  // log('changeDocument', document.uri.path);
 updateSidebar();
}

async function changeEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  // log('changeEditor', editor.document.uri.path);
 updateSidebar();
}

async function changeVisEditors() {
  // log('changeVisEditors', editors.length);
 updateSidebar();
}  

const changeSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.clearDecoration();
  await text.cleanFile(textEditor.document);
  await updateSidebar(textEditor);
}, 200);

// document: [TextDocument],
// contentChanges: [
//   { range: Range { start: [Position], end: [Position] },
//     rangeLength: 0,
//     text: 'a' }
// ],
// reason: undefined
async function textEdited (event) {
  const {textEditor} = event;
  text.clearDecoration();
  await text.cleanFile(textEditor.document);
  await updateSidebar(textEditor);
}

module.exports = { toggleCmd, prevCmd, nextCmd,
                   deleteItemXCmd, init,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd,
                   sidebarVisibleChange, textEdited,
                   changeDocument, changeEditor, 
                   changeVisEditors, changeSelection };

