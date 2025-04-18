const vscode  = require('vscode');
const sidebar = require('./sidebar.js');
const text   = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

let glblFuncs;

function init(glblFuncsIn) {
  glblFuncs = glblFuncsIn;
  // log('commands initialized');
  return {clearFileCmd, clearAllFilesCmd, cleanFileCmd, cleanAllFilesCmd};
}

async function toggleCmd() {
  log('toggle command called');
  text.toggle();
}

async function prevcmd() {
  log('prevcmd command called');
  await text.scrollToPrevNext(false);
}

async function nextcmd() {
  log('nextcmd command called');
  await text.scrollToPrevNext(true);
}

async function deleteMarkCmd(item) {                                                //
  // log('deleteMarkCmd command');                                                  //:1vyo;
  const document = item.document;
  switch (item.type) {
    case 'folder': glblFuncs.clearAllFilesCmd(item.folderPath); break;
    case 'file':   glblFuncs.clearFileCmd(document);            break;
    default: {
      const line = document.lineAt(item.lineNumber);
      await glblFuncs.delMark(document, line, item.languageId);
      sidebar.updateSidebar();
    }
  }
}

async function clearFileCmd(document) {
  if(!document) {
    log('clearFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  text.clearFile(document);
}

async function cleanFileCmd(document) {
  if(!document) {
    log('cleanFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  text.cleanFile(document)
}

async function clearAllFilesCmd(folderPath) {
  log('clearAllFilesCmd command called');
  await text.runOnAllFiles(clearFileCmd, folderPath);
}

async function cleanAllFilesCmd(folderPath) {
  log('cleanAllFilesCmd command called');
  await text.runOnAllFiles(cleanFileCmd, folderPath);
}

module.exports = { init, toggleCmd, prevcmd, nextcmd,
                   deleteMarkCmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd };

