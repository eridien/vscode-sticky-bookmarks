const vscode = require('vscode');
const utils  = require('./utils.js');
const {log} = utils.getLog('cmds');

function init() {
  // log('commands initialized');
  return {getTokensInLine, delMark, clearFileCmd, clearAllFilesCmd, cleanFileCmd, cleanAllFilesCmd};
}

async function toggleCmd() {
  log('toggle command called');
  toggle();
}

async function prevcmd() {
  log('prevcmd command called');
  await scrollToPrevNext(false);
}

async function nextcmd() {
  log('nextcmd command called');
  await scrollToPrevNext(true);
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
      updateSidebar();
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
  clearFile(document);
}

async function cleanFileCmd(document) {
  if(!document) {
    log('cleanFileCmd command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  cleanFile(document)
}

async function clearAllFilesCmd(folderPath) {
  log('clearAllFilesCmd command called');
  await runOnAllFiles(clearFileCmd, folderPath);
}

async function cleanAllFilesCmd(folderPath) {
  log('cleanAllFilesCmd command called');
  await runOnAllFiles(cleanFileCmd, folderPath);
}

module.exports = { init, togglecmd, prevcmd, nextcmd,
                   clearFileCmd, clearAllFilesCmd,
                   cleanFileCmd, cleanAllFilesCmd };

