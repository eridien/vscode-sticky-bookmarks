const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('MAIN');

let context, globalMarks;

function init(contextIn) { 
  context = contextIn;
  context.workspaceState.update('globalMarks', {}); // DEBUG
  globalMarks = context.workspaceState.get('globalMarks', {});
  log('main initialized'); 
}

function getToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `@${randHash}@`;
}

function addToGlobalMarks(data, token) {
  token = token ?? getToken();
  globalMarks[token] = data;
  context.workspaceState.update('globalMarks', globalMarks);
  return token;
}

function toggle() {
  log('toggle called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const languageId = document.languageId;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  const lineNumber = editor.selection.active.line;
  const token      = addToGlobalMarks({languageId, relPath, lineNumber});
  const line       = document.lineAt(lineNumber);
  editor.edit(builder => {builder.insert(line.range.end, ` // ${token}`)});
  log('toggle globalMarks:', globalMarks);
}

module.exports = { init, toggle };