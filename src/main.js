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

function tokenRegEx(lang, commLft, commRgt) {
  return new RegExp(
    (commLft + '.*?@([0-9a-z]{4})@.*?' + commRgt)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
}

function toggle() {
  log('toggle called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  const lineNumber = editor.selection.active.line;
  const languageId = document.languageId;
  const token      = addToGlobalMarks({languageId, relPath, lineNumber});
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text;
  const [commLft, commRgt] = utils.commentStr(languageId);
  const tokenRegx  = tokenRegEx(languageId, commLft, commRgt); 
  if(tokenRegx.test(lineText)) {
    const newLine = lineText.replace(tokenRegx, '');
    editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else {
    editor.edit(builder => {builder.insert(line.range.end, 
                            ` ${commLft+token+commRgt}`)});
  }
  log('toggle, new line:', document.lineAt(lineNumber).text);
}

function clearFile() {
  log('clearFile called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  const languageId = document.languageId;
  const [commLft, commRgt] = utils.commentString(languageId);
  const tokenRegx  = tokenRegEx(languageId, commLft, commRgt); 
  let newContent = document.getText().replaceAll(tokenRegx, '');
  editor.edit(builder => {
    builder.replace(new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
    ), newContent);
  });
  Object.keys(globalMarks).forEach(token => {
    if(globalMarks[token].relPath === relPath) delete globalMarks[token];
  });
  context.workspaceState.update('globalMarks', globalMarks);
  log('clearFile globalMarks:', globalMarks);
} 

module.exports = { init, toggle, clearFile };