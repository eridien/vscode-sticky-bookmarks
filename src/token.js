const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('TOKE');

let context, globalMarks;
 
function init(contextIn) { 
  context = contextIn;

  context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  log('main initialized'); 
}

function getToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}

function addToGlobalMarks(data, token = getToken()) {
  globalMarks[token] = data;
  context.workspaceState.update('globalMarks', globalMarks);
  return token;
}

const tokenRegExp = new RegExp('\\:[0-9a-z]{4};', 'g');

function commentRegExp(languageId) {
  const [commLft, commRgt] = utils.commentStr(languageId);
  if(commRgt !== '') {
    return new RegExp(
      `\\s*${commLft}(?!.*${commLft}).*?${commRgt}\\s*?$`, 'g');
  }
  else {
    return new RegExp(
      `\\s*${commLft}(?!.*${commLft})\\s*?$`, 'g');
  }
}

function cleanLine(languageId, lineText) {
  // if(!tokenRegExp.test(lineText)) return null;
  const noTokenText = lineText.replaceAll(tokenRegExp, '');
  const commentRegEx = commentRegExp(languageId);
  return noTokenText.replaceAll(commentRegEx, '');
}


async function addToLine(editor, document, languageId, 
                         lineNumber, line, lineText, 
                         commLft, commRgt) {
  const relPath  = vscode.workspace.asRelativePath(document.uri);
  const token    = addToGlobalMarks({languageId, relPath, lineNumber});
  let maxLineLen = 0;
  const strtLnNum = Math.max(0, lineNumber-10);
  const endLnNum  = Math.min(document.lineCount, lineNumber+10); 
  for(let lineNum = strtLnNum; lineNum < endLnNum; lineNum++) {
    const line = document.lineAt(lineNum).text.trimEnd().replace(tokenRegExp, '');
    maxLineLen = Math.max(maxLineLen, line.length);
  }
  const padLen = maxLineLen - lineText.length;
  const newLine = lineText +
            `${' '.repeat(padLen)} ${commLft} ${token} ${commRgt}`;
  await editor.edit(builder => {
    builder.replace(line.range, newLine)}
  );
}

async function clrLine(editor, line, lineText) {
  // const newLine = lineText.replace(tokenRegx, '');
  // await editor.edit(builder => {
  //   builder.replace(line.range, newLine);
  // });
  const document   = editor.document;
  const languageId = document.languageId;
  const newLine = cleanLine(languageId, lineText);
  // if(newLine === null) return;
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
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  if(tokenRegExp.test(lineText)) 
       await clrLine(editor, line, lineText);
  else await addToLine(editor, document, languageId, 
                       lineNumber, line, lineText, 
                       commLft, commRgt);
  log('toggle, new line:', lineNumber, document.lineAt(lineNumber).text);
}

async function clearFile() {
  log('clearFile called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document   = editor.document;
  const relPath    = vscode.workspace.asRelativePath(document.uri);
  // const languageId = document.languageId;
  // const [commLft, commRgt] = utils.commentStr(languageId);
  let newContent = document.getText().replaceAll(tokenRegExp, '');
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