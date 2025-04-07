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

function clrLine(line, commentRegEx) {
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
  if (!editor) { log('info', 'No active editor'); return; }
  const document     = editor.document;
  const lineNumber   = editor.selection.active.line;
  const line         = document.lineAt(lineNumber);
  const lineText     = line.text.trimEnd();
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  if(tokenRegExp.test(lineText)) {
    const newLine = clrLine(line, commentRegEx);
    await editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else 
    await addToLine(editor, lineNumber, 
                    line, lineText, commentRegEx);
}

async function clearFile(document) {
  log('clearFile called');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  let newFileText = '';
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    newFileText += await clrLine(line, commentRegEx) + '\n';
  }
  const uri  = document.uri;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
  ), newFileText);
  await vscode.workspace.applyEdit(edit);
  context.workspaceState.update('globalMarks', globalMarks);
}     

async function clearAllFiles() {
  log('clearAllFiles called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active editor'); return; }
  const document = editor.document;
  const folder   = vscode.workspace.getWorkspaceFolder(document.uri);
  const pattern  = new vscode.RelativePattern(folder, '**/*');
  const uris     = await vscode.workspace.findFiles(
                               pattern, '**/node_modules/**');
  for (const uri of uris) {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const fullText = document.getText();
      if(tokenRegExp.test(fullText)) {
        await clearFile(document); 
      }
    }
    catch(e) {if(e){}};
  }
} 

module.exports = { init, toggle, clearFile, clearAllFiles };