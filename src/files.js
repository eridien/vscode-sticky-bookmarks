const vscode = require('vscode');
const utils  = require('./utils.js');
const {log} = utils.getLog('cmds');

async function init() {
  const keywordsIn = utils.keywords();
  for(const [lang, keywords] of Object.entries(keywordsIn)) {
    const set = new Set(keywords);
    keywordSetsByLang[lang] = set;
  }
  return {};
}

const showLineNumbers    = true;
const showBreadCrumbs    = true;
const showCodeWhenCrumbs = true;

const crumbSepLft     = '● ';
const crumbSepRgt     = ' ● ';
const lineSep         = ' ••';

const keywordSetsByLang = {};

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

async function getCompText(document, languageId, lineNumber) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  let regxEmptyComm;
  if(commRgt !== '') regxEmptyComm = new RegExp(
        `\\s*${commLft}\\s*?${commRgt}\\s*`, 'g');
  else regxEmptyComm = new RegExp(
        `\\s*${commLft}\\s*?$`, 'g');
  let compText = '';
  do {
    let lineText = document.lineAt(lineNumber).text
                           .trim().replaceAll(/\s+/g, ' ');
    const matches = lineText.matchAll(/\b\w+?\b/g);
    if(matches.length != 0) {
      for(const match of matches) {
        const word = match[0];
        if(isKeyWord(languageId, word)) {
          lineText = lineText.replaceAll(word, '')
                             .replaceAll(/\s+/g, ' ').trim();
        }
        lineText = lineText.replaceAll(/\B\s+\B/g, '');
      }
    }
    lineText = lineText.replaceAll(/\B\s+?|\s+?\B/g, '')
                       .replaceAll(/:[0-9a-z]{4};/g, '');
    let lastLen;
    do {
      lastLen = lineText.length;
      lineText = lineText.replaceAll(regxEmptyComm, ' ')
                        .replaceAll(/\s+/g, ' ').trim();
    }
    while(lineText.length != lastLen);

    compText += ' ' + lineText + lineSep;
    lineNumber++;
  }
  while(compText.length < 60 && lineNumber < document.lineCount);
  compText = compText.slice(0, -1); // remove last newline
  return compText.trim().replace(/(\w)(\W)|(\W)(\w)/g, '$1$3 $2$4');
}

function getSymbols(pos, symbols) {
  const parent = symbols[symbols.length - 1];
  for(const child of parent.children) {
    if(utils.rangeContainsPos(child.range, pos)) {
      symbols.push(child);
      return getSymbols(pos, symbols);
    }
  }
}

async function getLabel(mark) {                                                  //
  try {
    const {document, languageId, lineNumber, type} = mark;
    if(type == 'folder')
      return '📂 ' + mark.folderName;
    if(type == 'file')
      return '📄 ' + mark.fileRelPath;
    const compText = await getCompText(document, languageId, lineNumber);
    let label = compText;
    const topSymbols = await vscode.commands.executeCommand(
                      'vscode.executeDocumentSymbolProvider', document.uri);
    if (!topSymbols || !topSymbols.length) {
      log('getLabel, No topSymbols found.');
      if(showLineNumbers)
        label = `${(lineNumber+1).toString().padStart(3, ' ')}  `+
                `${label}`;
      return label;
    }
    let crumbStr = '';
    if(showBreadCrumbs) {
      const symbols = [{children: topSymbols}];
      const lineLen = document.lineAt(lineNumber).text.length;
      const pos = new vscode.Position(
                        lineNumber, Math.max(lineLen-1, 0));
      getSymbols(pos, symbols);
      symbols.shift();
      if (!symbols.length) {
        // log('getLabel, No symbol found', document.uri.path);
        if(showLineNumbers)
          label = `${(lineNumber+1).toString().padStart(3, ' ')}  `+
                  `${label}`;
        return label;
      }
      symbols.reverse();
      // remove dupes?  todo
      for(const sym of symbols) {
        crumbStr = `${sym.name} > ${crumbStr}`;
      }
      crumbStr = crumbStr.slice(0, -2);
      crumbStr = crumbSepLft +  crumbStr + crumbSepRgt;
      if(showLineNumbers)
        crumbStr = `${(lineNumber+1).toString().padStart(3, ' ')}  `+
                    `${crumbStr}`;
    }
    if(showCodeWhenCrumbs && crumbStr.length > 0)
       return crumbStr + compText;
    return crumbStr;
  }
  catch (error) {
    log('err', 'getLabel error:', error.message);
  }
}

const clearDecoration = () => {                                                  //:pf5u;
  if(!decEditor) return;
  decEditor.setDecorations(decDecorationType, []);
  decDecorationType.dispose();
  decFocusListener.dispose();
  decEditor = null;
  updateSidebar();
};

async function delMark(document, line, languageId) {
  let lineText = line.text;
  tokenRegExG.index = 0;
  for(const tokenMatch of lineText.matchAll(tokenRegExG)) {
    const token = tokenMatch[0];
    lineText = lineText.replace(token, '');
    await marks.delGlobalMark(token)
  }
  const regx = commRegExG(languageId);
  lineText = lineText.replace(regx, '').trimEnd();

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, lineText);
  await vscode.workspace.applyEdit(edit);
  return lineText;
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

async function getTokensInLine(lineText) {                                         //
  tokenRegExG.index = 0;
  return [...lineText.matchAll(tokenRegExG)];
}

async function toggle() {
  log('togglecmd command called');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active editor'); return; }
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  const languageId = document.languageId;
  if(tokenRegEx.test(lineText)) {
    await delMark(document, line, languageId);  }
  else {
    const token = await marks.newGlobalMark(document, lineNumber);
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks('togglecmd');
}

async function scrollToPrevNext(fwd) {
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
    let lineText = line.text;
    if(tokenRegEx.test(lineText)) {
      for(const tokenMatch of lineText.matchAll(tokenRegExG)) {
        const token = tokenMatch[0];
        lineText = lineText.replace(token, '');
      }
      const begPos = new vscode.Position(lineNumber, 0);
      const endPos = new vscode.Position(lineNumber, lineText.length);
      editor.selection = new vscode.Selection(begPos, endPos);
      editor.revealRange(editor.selection);
      const range = new vscode.Range(begPos, endPos);
      break;
    }
    lineNumber = fwd ? ((lineNumber == lineCnt-1) ? 0 : lineNumber+1)
                     : ((lineNumber == 0) ? lineCnt-1 : lineNumber-1);
  }
}

async function clearFile(document) {
  const uri = document.uri;
  await marks.delGlobalMarksForFile(uri.path);
  if(!tokenRegEx.test(document.getText())) return;
  const languageId = document.languageId;
  let newFileText  = '';
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    newFileText += await delMark(document, line, languageId) + '\n';
  }
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.lineCount, 0)
  ), newFileText);
  await vscode.workspace.applyEdit(edit);
  marks.dumpGlobalMarks('clearFileCmd');
}

async function cleanFile(document) {
  await marks.delGlobalMarksForFile(document.uri.path);
  if(!tokenRegEx.test(document.getText())) return;
  const languageId = document.languageId;
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if(!tokenRegEx.test(line.text)) continue;
    const token = await marks.newGlobalMark(document, line.lineNumber);
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks('cleanFileCmd');
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
}

