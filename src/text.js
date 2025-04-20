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
  return {delMark, addMarksForTokens};
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

async function getCompText(mark) {
  let   {document, lineNumber, languageId} = mark;
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
    for(const match of matches) {
      const word = match[0];
      if(isKeyWord(languageId, word)) {
        lineText = lineText.replaceAll(word, '')
                            .replaceAll(/\s+/g, ' ').trim();
      }
      lineText = lineText.replaceAll(/\B\s+\B/g, '');
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

function labelWithLineNum(lineNumber, label) {
  if(showLineNumbers) 
    return `${(lineNumber + 1).toString().padStart(3, ' ')}  ${label}`;
  return label;
}

async function getLabel(mark) {
  try {
    const {document, lineNumber} = mark;
    const compText = await getCompText(mark);
    let label = compText;
    const topSymbols = await vscode.commands.executeCommand(
               'vscode.executeDocumentSymbolProvider', document.uri);
    if (!topSymbols || topSymbols.length == 0) {
      log('getLabel, No topSymbols found.');
      return labelWithLineNum(lineNumber, label);
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
        return labelWithLineNum(lineNumber, label);
      }
      symbols.reverse();
      // remove dupes?  todo
      for(const sym of symbols) {
        crumbStr = `${sym.name} > ${crumbStr}`;
      }
      crumbStr = crumbStr.slice(0, -2);
      crumbStr = crumbSepLft +  crumbStr + crumbSepRgt;
      crumbStr = labelWithLineNum(lineNumber, crumbStr);
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
  const mark = item.mark;
  const lineRange = await gotoAndDecorate(mark.document, mark.lineNumber);
  const lineSel      = new vscode.Selection(lineRange.start, lineRange.end);
  const lineText     = tgtEditor.document.getText(lineSel);
  const tokenMatches = await getTokensInLine(lineText);
  if(tokenMatches.length === 0) {
    log('itemClickCmd, no token in line', mark.lineNumber,
        'of', mark.fileName, ', removing GlobalMark', mark.token);
    await marks.delGlobalMark(mark.token);
  }
  else {
    while(tokenMatches.length > 1 && tokenMatches[0][0] !== mark.token) {
      const foundToken = tokenMatches[0][0];

      // remove token from line also

      await marks.delGlobalMark(foundToken);
      tokenMatches.shift();
    }
    const foundToken = tokenMatches[0][0];
    if(foundToken !== mark.token) {
      log(`wrong token found in line ${mark.lineNumber} of ${mark.fileName}, `+
          `found: ${foundToken}, expected: ${mark.token}, fixing GlobalMark`);
      await marks.replaceGlobalMark(mark.token, foundToken);
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

async function addTokenToLine(mark) {
  const line     = mark.document.lineAt(mark.lineNumber);
  const lineText = line.text.trimEnd();
  const padLen   = Math.max(getMinCharPos() - lineText.length, 0);
  const [commLft, commRgt] = utils.commentsByLang(mark.languageId);
  const newLine = lineText +
         `${' '.repeat(padLen)} ${commLft}${mark.token}${commRgt}`;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(mark.document.uri, line.range, newLine);
  await vscode.workspace.applyEdit(edit);
}

async function getTokensInLine(lineText) {
  tokenRegExG.index = 0;
  return [...lineText.matchAll(tokenRegExG)];
}

async function toggle() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'Toggle, no active editor'); return; }
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  const languageId = document.languageId;
  if(tokenRegEx.test(lineText)) {
    await delMark(document, line, languageId);  }
  else {
    const mark = await marks.newMark(document, lineNumber);
    if(!mark) return;
    await addTokenToLine(mark);
  }
  marks.dumpGlobalMarks('toggle');
}

async function scrollToPrevNext(fwd) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {log('info', 'scrollToPrevNext, no active editor'); return; }
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
      await gotoAndDecorate(document, lineNumber);
      break;
    }
    lineNumber = fwd ? ((lineNumber == lineCnt-1) ? 0 : lineNumber+1)
                     : ((lineNumber == 0) ? lineCnt-1 : lineNumber-1);
  }
}

async function addMarksForTokens(document) {
  const text = document.getText();
  const matches = [...text.matchAll(tokenRegEx)];
  for (const match of matches) {
    const matchedText = match[0];
    const startPos    = document.positionAt(match.index);
    await marks.addGlobalMarkIfMissing(matchedText, document, startPos.line);
  }
}

async function clearFile(document) {
  const uri = document.uri;
  await marks.delGlobalMarksForFile(document);
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
  for(let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if(!tokenRegEx.test(line.text)) continue;
    const mark = await marks.newMark(document, line.lineNumber);
    await addTokenToLine(mark);
  }
  marks.dumpGlobalMarks('cleanFileCmd');
}

module.exports = {init, getLabel, bookmarkClick,
                  clearDecoration, justDecorated,
                  toggle, scrollToPrevNext,
                  clearFile, cleanFile};


