const vscode = require('vscode');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log}  = utils.getLog('file');

function getMinCharPos() { return 70; }
const showLineNumbers    = true;
const showBreadCrumbs    = true;
const showCodeWhenCrumbs = true;

let glblFuncs;

async function init(glblFuncsIn) {
  glblFuncs = glblFuncsIn;
  for(const [lang, keywords] of Object.entries(utils.keywords())) {
    const set = new Set(keywords);
    keywordSetsByLang[lang] = set;
  }
  return {};
}

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

function isKeyWord(languageId, word) {
  if(!keywordSetsByLang[languageId]) return false;
  return keywordSetsByLang[languageId].has(word);
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
    if(child.range.contains(pos)) {
      symbols.push(child);
      return getSymbols(pos, symbols);
    }
  }
}

async function getLabel(mark) {
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

let tgtEditor         = null;
let tgtDecorationType = null;
let tgtFocusListener  = null;
let justDecorated     = false;

async function gotoAndDecorate(document, lineNumber) {
  clearDecoration();
  justDecorated = true;
  setTimeout(() => {justDecorated = false}, 100);
  const doc = await vscode.workspace.openTextDocument(document.uri);
  tgtEditor = await vscode.window.showTextDocument(doc, {preview: false});
  // const ranges = tgtEditor.visibleRanges;
  const lineRange  = doc.lineAt(lineNumber).range;
  tgtEditor.selection = new vscode.Selection(lineRange.start, lineRange.start);
  tgtEditor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
  tgtDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'),
    // or use a custom color like 'rgba(255, 200, 0, 0.2)'
    isWholeLine: true,
  });
  tgtEditor.setDecorations(tgtDecorationType, [lineRange]);
  tgtFocusListener = vscode.window.onDidChangeActiveTextEditor(activeEditor => {
    if (activeEditor !== tgtEditor) clearDecoration();
  });
  return lineRange;
}

const clearDecoration = () => {
  if(!tgtEditor || justDecorated) return;
  tgtEditor.setDecorations(tgtDecorationType, []);
  tgtDecorationType.dispose();
  tgtFocusListener.dispose();
  tgtEditor = null;
  glblFuncs.updateSidebar();
};

async function bookmarkClick(item) {
    const lineRange = await gotoAndDecorate(item.document, item.lineNumber);
    const lineSel = new vscode.Selection(lineRange.start, lineRange.end);
    const lineText = tgtEditor.document.getText(lineSel);
    const tokenMatches = await getTokensInLine(lineText);
    if(tokenMatches.length === 0) {
      log('itemClickCmd, no token in line', item.lineNumber,
          'of', item.document.uri.path, ', removing GlobalMark', item.token);
      await marks.delGlobalMark(item.token);
    }
    else {
      while(tokenMatches.length > 1 && tokenMatches[0][0] !== item.token) {
        const foundToken = tokenMatches[0][0];

        // remove token from line also

        await marks.delGlobalMark(foundToken);
        tokenMatches.shift();
      }
      const foundToken = tokenMatches[0][0];
      if(foundToken !== item.token) {
        log(`wrong token found in line ${item.lineNumber} of ${item.document.uri.path}, `+
            `found: ${foundToken}, expected: ${item.token}, fixing GlobalMark`);
        await marks.replaceGlobalMark(item.token, foundToken);
      }
    }
    return;
}

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
  const padLen = Math.max(getMinCharPos() - lineText.length, 0);
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const newLine = lineText +
                    `${' '.repeat(padLen)} ${commLft}${token}${commRgt}`;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, newLine);
  await vscode.workspace.applyEdit(edit);
}

async function getTokensInLine(lineText) {
  tokenRegExG.index = 0;
  return [...lineText.matchAll(tokenRegExG)];
}

async function toggle() {
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
    if(!token) return;
    await addTokenToLine(document, line, languageId, token);
  }
  marks.dumpGlobalMarks('toggle');
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
      await gotoAndDecorate(document, lineNumber);
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
  marks.dumpGlobalMarks('clearFile');
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

module.exports = {init, getLabel, bookmarkClick,
                  clearDecoration, justDecorated,
                  toggle, scrollToPrevNext,
                  clearFile, cleanFile, runOnAllFiles};


