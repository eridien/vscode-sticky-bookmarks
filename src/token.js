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

function getRandomToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}

function addToGlobalMarks(data, token = getRandomToken()) {
  globalMarks[token] = data;
  context.workspaceState.update('globalMarks', globalMarks);
  return token;
}

function removeFromGlobalMarks(token) {
  delete globalMarks[token];
  context.workspaceState.update('globalMarks', globalMarks);
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

async function addToLine(editor, lineNumber, 
                         line, lineText, commentRegEx) {
  const document  = editor.document;
  let maxLineLen  = 0;
  const strtLnNum = Math.max(0, lineNumber-10);
  const endLnNum  = Math.min(document.lineCount, lineNumber+10); 
  for(let lineNum = strtLnNum; lineNum < endLnNum; lineNum++) {
    const strippedLn = document.lineAt(lineNum).text
           .replace(tokenRegExp, '').replaceAll(commentRegEx, '')
    maxLineLen = Math.max(maxLineLen, strippedLn.length);
  }
  const padLen    = maxLineLen - lineText.length;
  const relPath   = vscode.workspace.asRelativePath(document.uri);
  const languageId = document.languageId;
  const [commLft, commRgt] = utils.commentStr(languageId);
  const token   = addToGlobalMarks({languageId, relPath, lineNumber});
  const newLine = lineText +
            `${' '.repeat(padLen)} ${commLft} ${token} ${commRgt}`;
  await editor.edit(builder => { builder.replace(line.range, newLine)} );
}

function clrLine(editor, line, languageId, commentRegEx) {
  const lineText = line.text.trimEnd();
  const match    = lineText.match(tokenRegExp);
  if(match === null) return lineText; 
  delete globalMarks[match[0]];
  const noTokenText = lineText.replaceAll(tokenRegExp, '');
  const newLine     = noTokenText.replaceAll(commentRegEx, '');
  return newLine;
}

async function toggle() {
  log('toggle called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document     = editor.document;
  const lineNumber   = editor.selection.active.line;
  const line         = document.lineAt(lineNumber);
  const lineText     = line.text.trimEnd();
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  if(tokenRegExp.test(lineText)) {
    const newLine = clrLine(
            editor, line, languageId, commentRegEx);
    await editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else 
    await addToLine(editor, lineNumber, 
                    line, lineText, commentRegEx);
}

async function clearFile() {
  log('clearFile called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('toggle, No active editor'); return; }
  const document     = editor.document;
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  let newFileText = '';
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    newFileText += await clrLine(
          editor, line, languageId, commentRegEx) + '\n';
  }
  await editor.edit(builder => {
    builder.replace(new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
    ), newFileText);
  });
  context.workspaceState.update('globalMarks', globalMarks);
} 

module.exports = { init, toggle, clearFile };