const vscode = require('vscode');
const marks  = require('./marks.js');
const sett   = require('./settings.js');
const utils  = require('./utils.js');
const log    = utils.getLog('TOKE');

let context;

const maxLineLenByPath = {}; 

function init(contextIn) { 
  context = contextIn;
  log('token initialized'); 
}

const tokenRegEx  = new RegExp('\\:[0-9a-z]{4};');
const tokenRegExG = new RegExp('\\:[0-9a-z]{4};', 'g');

function commRegExG(languageId) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  if(commRgt !== '') {
    return new RegExp(
      `\\s*${commLft}\\s*${commRgt}\\s*?$`, 'g');
  }
  else {
    return new RegExp(`\\s*${commLft}\\s*?$`, 'g');
  }
}

async function addTokenToLine(document, line, languageId, token) {
  const lineText = line.text.trimEnd(); 
  const padLen = Math.max(sett.getMinCharPos() - lineText.length, 0);
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const newLine = lineText +
                    `${' '.repeat(padLen)} ${commLft}${token}${commRgt}`;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, newLine);
  await vscode.workspace.applyEdit(edit);
}

function stripLine(line, languageId) {
  let lineText = line.text.trimEnd();
  lineText = lineText.replaceAll(tokenRegExG, 
               (token) => marks.delGlobalMark(token));
  const regx = commRegExG(languageId);
  lineText = lineText.replace(regx, '');
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
  if(tokenRegEx.test(lineText)) {
    const newLine = stripLine(line, languageId);
    await editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else {
    const relPath = vscode.workspace.asRelativePath(document.uri);
    const token = await marks.addGlobalMark(
            document, relPath, line, lineNumber, languageId);
    await addTokenToLine( document, line, languageId, token);
  }
  marks.dumpGlobalMarks();
}

async function clearFile(document) {
  if(!document) {
    log('clearFile command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  if(!tokenRegEx.test(document.getText())) return;
  const languageId = document.languageId;
  let newFileText  = '';
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    newFileText += await stripLine(line, languageId) + '\n';
  }
  const uri  = document.uri;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
  ), newFileText);
  await vscode.workspace.applyEdit(edit);
  const relPath = vscode.workspace.asRelativePath(uri);
  marks.delGlobalMarksForFile(relPath);
  marks.dumpGlobalMarks();
}     

async function cleanFile(document) {
  if(!document) {
    log('cleanFile command called');
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    document = editor.document;
  }
  if(!tokenRegEx.test(document.getText())) return;
  const languageId   = document.languageId;
  const commentRegEx = commentRegExp(languageId);
  const relPath = vscode.workspace.asRelativePath(document.uri);
  marks.delGlobalMarksForFile(relPath);
  getMaxLineLen(document, relPath, commentRegEx, true)
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if(!tokenRegEx.test(line.text)) continue;
    const token = await marks.addGlobalMark(
        document, relPath, line, i, languageId);
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks();
  log(marks.getMarksTree());
}

async function runOnAllFiles(func) {
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
      await func(document); 
    }
    catch(e) {if(e){}};
  }
  marks.dumpGlobalMarks();
} 

async function clearAllFiles() {
  log('clearAllFiles command called');
  await runOnAllFiles(clearFile);
}

async function cleanAllFiles() {
  log('cleanAllFiles command called');
  await runOnAllFiles(cleanFile);
}

module.exports = { init, toggle, clearFile, clearAllFiles, cleanFile, cleanAllFiles };