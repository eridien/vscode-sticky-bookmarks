const vscode = require('vscode');
const labels = require('./labels.js');
const utils  = require('./utils.js');
const log    = utils.getLog('TOKE');

let context, globalMarks;
const maxLineLenByPath = {}; 

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

function addGlobalMark(data, token = getRandomToken()) {
  globalMarks[token] = data;
  context.workspaceState.update('globalMarks', globalMarks);
  return token;
}

function delGlobalMark(token) {
  delete globalMarks[token];
  context.workspaceState.update('globalMarks', globalMarks);
  return '';
}

const tokenRegEx  = new RegExp('\\:[0-9a-z]{4};');
const tokenRegExG = new RegExp('\\:[0-9a-z]{4};', 'g');

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

async function setGlobalMark(document, relPath, 
                             line, lineNumber, languageId, token) {
  const uri          = document.uri;
  const symbol       = await labels.getSurroundingSymbol(uri, line.range);
  const symName      = symbol?.name;
  const symRange     = symbol?.location.range; 
  const label        = await labels.getLabel(document, symName, symRange, lineNumber);
  return addGlobalMark( {uri, relPath, lineNumber, languageId, label} , token);
}

function getMaxLineLen(document, relPath, commentRegEx, update = false) {
  if(update || maxLineLenByPath[relPath] === undefined) {
    let maxLineLen = 0;
    for(let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const testLine = document.lineAt(lineNum);
      const testStripLn = testLine.text
            .replaceAll(tokenRegExG, '').replaceAll(commentRegEx, '');
      maxLineLen = Math.max(maxLineLen, testStripLn.length);
    }
    maxLineLenByPath[relPath] = maxLineLen;
  }
  return maxLineLenByPath[relPath];
}

async function addTokenToLine(document, relPath, line, lineNumber, languageId, 
                              commentRegEx, token) {
  const maxLineLen   = getMaxLineLen(document, relPath, commentRegEx);
  const strippedLine = cleanLine(line, commentRegEx);
  const padLen = maxLineLen - strippedLine.length;
  const [commLft, commRgt] = utils.commentStr(languageId);
  const newLine = strippedLine +
            `${' '.repeat(padLen)} ${commLft}${token} ${commRgt}`;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, newLine);
  await vscode.workspace.applyEdit(edit);
}

async function updateDocument(document) {

}

function cleanLine(line, commentRegEx) {
  let lineText = line.text.trimEnd();
  lineText = lineText.replace(tokenRegExG, 
    (token) => delGlobalMark(token));
  let lineLen;
  do {
    lineLen  = lineText.length;
    lineText = lineText.replaceAll(commentRegEx, '');
  } while(lineText.length < lineLen);
  return lineText.trimEnd();
}

async function toggle() {
  log('toggle command called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active editor'); return; }
  const document     = editor.document;
  const lineNumber   = editor.selection.active.line;
  const line         = document.lineAt(lineNumber);
  const lineText     = line.text.trimEnd();
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  if(tokenRegEx.test(lineText)) {
    const newLine = cleanLine(line, commentRegEx);
    await editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else {
    const relPath = vscode.workspace.asRelativePath(document.uri);
    const token = await setGlobalMark(
      document, relPath, line, lineNumber, languageId);
    await addTokenToLine(
      document, relPath, line, lineNumber, languageId, commentRegEx, token);
  }
  log('globalMarks', Object.keys(globalMarks));
}

async function clearFile(document) {
  if(!document) {
    log('clearFile command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  let newFileText = '';
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    newFileText += await cleanLine(line, commentRegEx) + '\n';
  }
  const uri  = document.uri;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
  ), newFileText);
  await vscode.workspace.applyEdit(edit);
  context.workspaceState.update('globalMarks', globalMarks);
  log('globalMarks', Object.keys(globalMarks));
}     

async function clearAllFiles() {
  log('clearAllFiles command called');
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
      if(tokenRegEx.test(document.getText())) {
        await clearFile(document); 
      }
    }
    catch(e) {if(e){}};
  }
  log('globalMarks', Object.keys(globalMarks));
} 

module.exports = { init, toggle, clearFile, clearAllFiles };