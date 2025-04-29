const vscode = require('vscode');
const path   = require('path');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log, start, end}  = utils.getLog('file');

const showLineNumbers      = true;
const showBreadCrumbs      = true;
const showCodeWhenCrumbs   = true;
const openSideBarOnNewMark = true;
const maxLinesInCompText   = 6;

let context, gutterDecoration = null;

function init(contextIn) {
  context = contextIn;
  for(const [lang, keywords] of Object.entries(utils.keywords())) {
    keywordSetsByLang[lang] = new Set(keywords);
  }
  gutterDecoration = vscode.window.createTextEditorDecorationType({ 
    gutterIconPath: vscode.Uri.file(path.join(
                       context.extensionPath, 'images', 'bookmark.svg')),
    gutterIconSize: 'contain',
  });
}

const crumbSepLft     = '● ';
const crumbSepRgt     = '●';
const lineSep         = '\x00';

const keywordSetsByLang = {};

//:7e3a;
function tokenRegEx(languageId, eol = true, global = false) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const regxStr = `${commLft}([\\u200B\\u200C\\u200D\\u2060]+\\.`+
                  `${eol ? '$' : ''})${commRgt}`;
  if(global) return new RegExp(regxStr, 'g');
  else       return new RegExp(regxStr);
}

function updateGutter() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const filePath = editor.document.uri.fsPath;
  const globalMarks = marks.getMarksForFile(filePath);
  const decorations = globalMarks.map(globalMark => ({range: new vscode.Range(
                      globalMark.lineNumber, 0, globalMark.lineNumber, 0)}));
  editor.setDecorations(gutterDecoration, decorations);
}

function isKeyWord(languageId, word) {
  if(!keywordSetsByLang[languageId]) return false;
  return keywordSetsByLang[languageId].has(word);
}

//:kcp7;
async function getCompText(mark) {
  let   {document, lineNumber, languageId} = mark;
  const tokenRegx = tokenRegEx(languageId);
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const regxEmptyComm = (commRgt !== '') 
             ? new RegExp(`\\s*${commLft}\\s*?${commRgt}\\s*`, 'g')
             : new RegExp(`\\s*${commLft}\\s*?$`,              'g');
  // go through lines until we have enough text
  let compText = '';
  let lineCount = 0;
  do {
    let lineText = document.lineAt(lineNumber).text;
    // remove token
    lineText = lineText.replace(tokenRegx, '');
    // shrink long runs of the same char
    lineText = lineText.replace(/(.)\1{3,}/g, (_, char) => char.repeat(3));
    // remove keywords
    const matches = lineText.matchAll(/\b\w+?\b/g);
    const matchArr = [...matches];
    matchArr.reverse();
    for(const match of matchArr) {
      const word = match[0];
      if(isKeyWord(languageId, word)) {
        const strtIdx = match.index;
        const endIdx  = strtIdx + word.length;
        lineText = lineText.slice(0, strtIdx) +
                    lineText.slice(endIdx);
      }
    }
    // remove whitespace not separating words
    lineText = lineText.replaceAll(/\B\s+?|\s+?\B/g, '');
    // remove empty comments
    let lastLen;
    do {
      lastLen = lineText.length;
      lineText = lineText.replaceAll(regxEmptyComm, ' ');
    } while(lineText.length != lastLen);
    // add cleaned line to comptext with line sep
    // but only if not empty
    if(lineText.length == 0) continue
    compText += ' ' + lineText + lineSep;
  }
  while(compText.length < 60 && 
        ++lineNumber < document.lineCount &&
        ++lineCount  < maxLinesInCompText);
  return compText.slice(0, -1).replaceAll(/\s+/g, ' ').trim()
                              .replaceAll('\x00', '\\n');
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
      for(const sym of symbols) {
        crumbStr = `${sym.name} > ${crumbStr}`;
      }
      crumbStr = crumbStr.slice(0, -2);
      crumbStr = crumbSepLft +  crumbStr + crumbSepRgt;
      crumbStr = labelWithLineNum(lineNumber, crumbStr);
    }
    if(showCodeWhenCrumbs && crumbStr.length > 0) return crumbStr + compText;
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
  setTimeout(() => {justDecorated = false}, 300);
  const doc = await vscode.workspace.openTextDocument(document.uri);
  tgtEditor = await vscode.window.showTextDocument(doc, {preview: false});
  // const ranges = tgtEditor.visibleRanges;
  const lineRange  = doc.lineAt(lineNumber).range;
  tgtEditor.selection = new vscode.Selection(lineRange.start, lineRange.start);
  tgtEditor.revealRange(lineRange, 
                        vscode.TextEditorRevealType.InCenterIfOutsideViewport);
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
};

async function bookmarkClick(item) {
  const mark         = item.mark;
  const lineRange    = await gotoAndDecorate(mark.document, mark.lineNumber);
  const lineSel      = new vscode.Selection(lineRange.start, lineRange.end);
  const lineText     = tgtEditor.document.getText(lineSel);
  // const tokenMatches = await getTokensInLine(lineText);
  const tokenMatches = [];
  if(tokenMatches.length === 0) {
    log('bookmarkClick, no token in line', mark.lineNumber,
        'of', mark.fileName, ', removing GlobalMark', mark.token);
    marks.delGlobalMark[mark.token];
    await marks.saveGlobalMarks();
  }
  else {
    while(tokenMatches.length > 1 && tokenMatches[0][0] !== mark.token) {
      const foundToken = tokenMatches[0][0];
      marks.delGlobalMark[foundToken];
      await marks.saveGlobalMarks();
      tokenMatches.shift();
    }
    const foundToken = tokenMatches[0][0];
    if(foundToken !== mark.token) {
      log(`bookmarkClick, wrong token found in line ${mark.lineNumber} `+
      `of ${mark.fileName}, found: ${foundToken}, expected: ${mark.token}, `+
      `fixing GlobalMark`);
      await marks.replaceGlobalMark(mark.token, foundToken);
    }
  }
  return;
}

async function replaceLineInDocument(document, lineNumber, newText) {
  if (lineNumber < 0 || lineNumber >= document.lineCount) return;
  const uri  = document.uri;
  const edit = new vscode.WorkspaceEdit();
  const line = document.lineAt(lineNumber);
  edit.replace(uri, line.range, newText);
  await vscode.workspace.applyEdit(edit);
}

//:433b;
async function delMarkFromLineAndGlobal(document, lineNumber) {
  const languageId   = document.languageId;
  const line         = document.lineAt(lineNumber);
  const lineText     = line.text;
  const tokenMatches = tokenRegEx(languageId, false).exec(lineText);
  if(!tokenMatches) return;
  const token = tokenMatches[0];
  if (token.length > lineText.length) return;
  const end       = line.range.end;
  const newEndPos = end.translate(0, -token.length);
  const edit      = new vscode.WorkspaceEdit();
  edit.delete(document.uri, new vscode.Range(newEndPos, end));
  await vscode.workspace.applyEdit(edit);
  marks.delGlobalMark(token);
}

//:892c;
async function toggle() {
  const editor   = vscode.window.activeTextEditor;
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  const line       = document.lineAt(lineNumber);
  let   lineText   = line.text;
  const regex      = tokenRegEx(document.languageId, false);
  log('toggle, lineText.length', lineText.length);
  if(regex.test(lineText))
    await delMarkFromLineAndGlobal(document, lineNumber);
  else {
    const mark = await marks.newGlobalMark(document, lineNumber);
    if(!mark) return;
    lineText += mark.token;
    await utils.replaceLine(document, lineNumber, lineText);
    const position   = new vscode.Position(lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), 
            vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    if(openSideBarOnNewMark)  {
      await vscode.commands.executeCommand(
                           'workbench.view.extension.stickyBookmarks');
      await utils.sleep(100);
      await vscode.commands.executeCommand(
                            'workbench.action.focusActiveEditorGroup');
    }
  }
  marks.dumpGlobalMarks('toggle');
}

async function scrollToPrevNext(fwd) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {log('info', 'scrollToPrevNext, no active editor'); return; }
  const document = editor.document;
  if(document.lineCount < 2) return;
  const languageId = document.languageId;
  const regx       = tokenRegEx(languageId);
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
    if(regx.test(lineText)) {
      await gotoAndDecorate(document, lineNumber);
      break;
    }
    lineNumber = fwd ? ((lineNumber == lineCnt-1) ? 0 : lineNumber+1)
                     : ((lineNumber == 0) ? lineCnt-1 : lineNumber-1);
  }
}

async function clearFile(document, saveMarks = true) {
  let haveDel = false;
  await runOnAllTokensInDoc(document, true, false, async (params) => {
    const {position} = params;
    await delMarkFromLineAndGlobal(document, position.line, false);
    haveDel = true;
  });
  if(haveDel && saveMarks) await marks.saveGlobalMarks();
}

async function refreshMark(params) {
  log('refreshMark');
  const {document, position, lineText, token} = params;
  const fileFsPath = document.uri.fsPath;
  const lineNumber = position.line;
  const globalMark = marks.getGlobalMark(token);
  if(globalMark && (globalMark.fileFsPath != fileFsPath || 
                    globalMark.lineNumber != lineNumber)) {
    const newMark     = await marks.newGlobalMark(document, lineNumber);
    const newToken    = newMark.token;
    const newLineText = lineText.replace(token, newToken);
    await replaceLineInDocument(document, lineNumber, newLineText);
    log(`refreshMark, replaced duplicate token, ` + 
        `${utils.tokenToDigits(token)} -> `       +
        `${utils.tokenToDigits(newMark.token)}`);    
    return {position, token:newToken, markChg:true};
  }
  return {position, token, markChg:false};
}

async function refreshFile(document) {
  log('refreshFile');
  const fileFsPath = document.uri.fsPath;
  const fileMarks = await runOnAllBookmarksInFile(
                             refreshMark, fileFsPath, runOnAllBookmarksInFile);
  const globalMarksInFile = marks.getMarksForFile(fileFsPath);
  const tokens = new Set();
  let haveMarkChg = false;
  for(const fileMark of fileMarks) {
    const {position, token, markChg} = fileMark;
    haveMarkChg ||= markChg;
    tokens.add(token);
    if(globalMarksInFile.findIndex(
          (globalMark) => globalMark.token === token) === -1) {
      await marks.newGlobalMark(document, position.line, token);
      haveMarkChg = true;
    }
  }
  for(const globalMark of globalMarksInFile) {
    const token = globalMark.token;
    if(!tokens.has(token)) {
      await marks.delGlobalMark(token);
      haveMarkChg = true;
    }
  }
  if(haveMarkChg) await marks.saveGlobalMarks();
}

async function refreshMenu() {
  log('refreshMenu');
  start('refreshMenu');
  await utils.runOnAllFoldersInWorkspace(refreshFile, true);
  end('refreshMenu');
}

async function runOnAllBookmarksInFile(func, fileFsPath) {
  const uri      = vscode.Uri.file(fileFsPath);
  const document = await vscode.workspace.openTextDocument(uri);
  const docText  = document.getText();
  const regexG   = tokenRegEx(document.languageId, false, true);
  const matches  = [...docText.matchAll(regexG)];
  matches.reverse();
  const funcRes = [];
  for (const match of matches) {
    const offset   = match.index;
    const position = document.positionAt(offset); 
    const lineText = document.lineAt(position.line);
    const token    = match[0];
    funcRes.push(await func({document, docText, position, lineText, token}));
  }
  return funcRes;
}

module.exports = {init, getLabel, bookmarkClick, refreshMenu,
                  clearDecoration, justDecorated, updateGutter,
                  toggle, scrollToPrevNext, delMarkFromLineAndGlobal,    
                  clearFile, refreshFile};


