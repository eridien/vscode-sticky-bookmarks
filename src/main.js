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
    ('\\s*' + commLft + '\\s*?@[0-9a-z]{4}@\\s*' + commRgt), 'g');
}

async function addToLine(editor, document, languageId, 
                         lineNumber, line, lineText, 
                         commLft, commRgt, tokenRegx) {
  const relPath  = vscode.workspace.asRelativePath(document.uri);
  const token    = addToGlobalMarks({languageId, relPath, lineNumber});
  let maxLineLen = 0;
  const strtLnNum = Math.max(0, lineNumber-10);
  const endLnNum  = Math.min(document.lineCount, lineNumber+10); 
  for(let lineNum = strtLnNum; lineNum < endLnNum; lineNum++) {
    const line = document.lineAt(lineNum).text.trimEnd().replace(tokenRegx, '');
    maxLineLen = Math.max(maxLineLen, line.length);
  }
  const padLen = maxLineLen - lineText.length;
  const newLine = lineText +
            `${' '.repeat(padLen)} ${commLft} ${token} ${commRgt}`;
  await editor.edit(builder => {
    builder.replace(line.range, newLine)}
  );
}

async function clrLine(editor, line, lineText, tokenRegx) {
  const newLine = lineText.replace(tokenRegx, '');
  await editor.edit(builder => {
    builder.replace(line.range, newLine);
  });
}

async function toggle() {
  log('toggle called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const languageId = document.languageId;
  const lineNumber = editor.selection.active.line;
  const [commLft, commRgt] = utils.commentStr(languageId);
  const tokenRegx  = tokenRegEx(languageId, commLft, commRgt); 
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  if(tokenRegx.test(lineText)) 
       await clrLine(editor, line, lineText, tokenRegx);
  else await addToLine(editor, document, languageId, 
                       lineNumber, line, lineText, 
                       commLft, commRgt, tokenRegx);
  log('toggle, new line:', lineNumber, document.lineAt(lineNumber).text);
}

async function clearFile() {
  log('clearFile called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  const languageId = document.languageId;
  const [commLft, commRgt] = utils.commentStr(languageId);
  const tokenRegx  = tokenRegEx(languageId, commLft, commRgt); 
  let newContent = document.getText().replaceAll(tokenRegx, '');
  await editor.edit(builder => {
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