const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('MAIN');

let context, globalMarks;

function init(contextIn) { 
  context = contextIn;
  globalMarks = context.workspaceState.get('globalMarks', {});
  log('main initialized'); 
}

function getToken() {
  const hashDigit = () => Math.floor(Math.random() * 36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  const token = `@${randHash}@`;
  globalMarks[token] = {};
  context.workspaceState.update('globalMarks', globalMarks);
  // log('generated token:', {token, globalMarks});
  return token;
}

function toggle() {
  log('toggle called');
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const languageId = document.languageId;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  const lineNum    = editor.selection.active.line;
  const token      = getToken();

  log('getToken:', {languageId, relPath, lineNum, token, globalMarks});
}

module.exports = { init, toggle };