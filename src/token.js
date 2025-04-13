const vscode = require('vscode');
const marks  = require('./marks.js');
const sett   = require('./settings.js');
const utils  = require('./utils.js');
const log    = utils.getLog('toke');

function init() {
  log('token initialized');
  return {delMark, clearFile, clearAllFiles, cleanFile, cleanAllFiles};
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

function delMark(line, languageId) {
  let lineText = line.text.trimEnd();
  lineText = lineText.replaceAll(tokenRegExG, 
               async (token) => await marks.delGlobalMark(token));
  const regx = commRegExG(languageId);
  lineText = lineText.replace(regx, '');
  return lineText.trimEnd();
}

async function toggle() {
  log('toggle command called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active editor'); return; }
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  const languageId = document.languageId;
  if(tokenRegEx.test(lineText)) {
    const newLine = delMark(line, languageId);
    await editor.edit(builder => {
      builder.replace(line.range, newLine);
    });
  }
  else {
    const token = await marks.newGlobalMark(document, lineNumber);
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks();
}

function flashLine(editor, range) {
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.5)'
  });
  editor.setDecorations(decorationType, [range]);
  setTimeout(() => {
    decorationType.dispose();
  }, 100);
}

async function prevNext(fwd) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active editor'); return; }
  const document = editor.document;
  if(document.lineCount < 2) return;
  const lineCnt    = document.lineCount;
  const startLnNum = editor.selection.active.line;
  let lineNumber;
  if(fwd) lineNumber = (startLnNum == lineCnt-1) ? 0
                                      : startLnNum+1;
  else    lineNumber = (startLnNum == 0) ? lineCnt-1
                                      : startLnNum-1;
  while(lineNumber != startLnNum) {
    let line = document.lineAt(lineNumber);
    if(tokenRegEx.test(line.text)) {
      const languageId = document.languageId;
      let lineText = delMark(line, languageId)
      const begPos = new vscode.Position(lineNumber, 0);
      const endPos = new vscode.Position(lineNumber, lineText.length);
      editor.selection = new vscode.Selection(begPos, endPos);
      editor.revealRange(editor.selection);
      const range = new vscode.Range(begPos, endPos);
      flashLine(editor, range);
      break;
    }
    lineNumber = fwd ? ((lineNumber == lineCnt-1) ? 0 : lineNumber+1)
                     : ((lineNumber == 0) ? lineCnt-1 : lineNumber-1);
  }
}

async function prev() {
  log('prev command called');
  await prevNext(false);
}

async function next() {
  log('next command called');
  await prevNext(true);
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
    newFileText += await delMark(line, languageId) + '\n';
  }
  const uri  = document.uri;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
  ), newFileText);
  await vscode.workspace.applyEdit(edit);
  const fileRelPath = vscode.workspace.asRelativePath(uri);
  await marks.delGlobalMarksForFile(fileRelPath);
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
  const fileRelPath = vscode.workspace.asRelativePath(document.uri);
  await marks.delGlobalMarksForFile(fileRelPath);
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if(!tokenRegEx.test(line.text)) continue;
    const token = await marks.newGlobalMark(document, line.lineNumber);
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks();
}

async function runOnAllFiles(func, folderPath) {
  let folder;
  if(!folderPath) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'No active editor'); return; }
    const document = editor.document;
    folder = vscode.workspace.getWorkspaceFolder(document.uri);
  }
  else {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { log('info', 'No folders in workspace'); return; }
    folder = folders.find(folder => folder.uri.path === folderPath);
    if(!folder) { log('info', 'Folder not found in workspace'); return; } 
  }
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

async function clearAllFiles(folderPath) {
  log('clearAllFiles command called');
  await runOnAllFiles(clearFile, folderPath);
}

async function cleanAllFiles(folderPath) {
  log('cleanAllFiles command called');
  await runOnAllFiles(cleanFile, folderPath);
}

module.exports = { init, toggle, prev, next,
                   clearFile, clearAllFiles, 
                   cleanFile, cleanAllFiles };