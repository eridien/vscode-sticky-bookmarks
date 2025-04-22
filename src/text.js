const vscode = require('vscode');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log, start, end}  = utils.getLog('file');

const showLineNumbers    = true;
const showBreadCrumbs    = true;
const showCodeWhenCrumbs = true;

function init() {
  for(const [lang, keywords] of Object.entries(utils.keywords())) {
    keywordSetsByLang[lang] = new Set(keywords);
  }
}

const crumbSepLft     = '● ';
const crumbSepRgt     = '●';
const lineSep         = '\x00';

const keywordSetsByLang = {};

const tokenRegEx  = new RegExp('\\:[0-9a-z]{4};');
const tokenRegExG = new RegExp('\\:[0-9a-z]{4};', 'g');
const indentRegEx = /^(\s*)\S/;

function lineRegEx(languageId) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  if(commRgt !== '') {
    return new RegExp(
      `^(.*?)${commLft}(.*?)`+
      `((bookmark)?\\:[0-9a-z]{4};)(.*?)${commRgt}(.*)$`);
  }
  else {
    return new RegExp(
          `^(.*?)${commLft}(.*?)((bookmark)?\\:[0-9a-z]{4};)(.*)$`);
  }
}

function getJunkAndBookmarkToken(lineText, languageId) {
  const lineRegX      = lineRegEx(languageId);
  const match         = lineRegX.exec(lineText);
  if(!match) return {junk:'', bookmarkToken:'', noMatch:true};
  const junk1         = (match[1] ?? '').replaceAll(/\s/g, '');
  const junk2         = (match[2] ?? '').replaceAll(/\s/g, '');
  const junk5         = (match[5] ?? '').replaceAll(/\s/g, '');
  const junk6         = (match[6] ?? '').replaceAll(/\s/g, '');
  const junk          = junk1 + junk2 + junk5 + junk6;
  const bookmarkToken = (match[3] ?? '')
  return {junk, bookmarkToken};
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
    let lineText = document.lineAt(lineNumber).text;
    const {junk, bookmarkToken, noMatch} = 
                    getJunkAndBookmarkToken(lineText, languageId)
    if(noMatch || junk !== '') {
      if(bookmarkToken !== '') 
        lineText = lineText.replace(bookmarkToken, '');
      const matches = lineText.matchAll(/\b\w+?\b/g);
      for(const match of matches) {
        const word = match[0];
        if(isKeyWord(languageId, word)) {
          const strtIdx = match.index;
          const endIdx  = strtIdx + word.length;
          lineText = lineText.slice(0, strtIdx) +
                     lineText.slice(endIdx);
        }
      }
      lineText = lineText.replaceAll(/\B\s+?|\s+?\B/g, '');
      let lastLen;
      do {
        lastLen = lineText.length;
        lineText = lineText.replaceAll(regxEmptyComm, ' ');
      }
      while(lineText.length != lastLen);
      compText += ' ' + lineText + lineSep;
    }
    lineNumber++;
  }
  while(compText.length < 60 && lineNumber < document.lineCount);
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
  setTimeout(() => {justDecorated = false}, 300);
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
    marks.delGlobalMark[mark.token];
    await marks.saveGlobalMarks();
  }
  else {
    while(tokenMatches.length > 1 && tokenMatches[0][0] !== mark.token) {
      const foundToken = tokenMatches[0][0];

      // remove token from line also

      marks.delGlobalMark[foundToken];
      await marks.saveGlobalMarks();
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

function getNewTokenLine(indentLen, token, languageId) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  return ' '.repeat(indentLen) + commLft + 'bookmark' + token + commRgt;
}

async function replaceLineInDocument(document, lineNumber, newText) {
  if (lineNumber < 0 || lineNumber >= document.lineCount) return;
  const uri = document.uri;
  const edit = new vscode.WorkspaceEdit();
  const line = document.lineAt(lineNumber);
  edit.replace(uri, line.range, newText);
  await vscode.workspace.applyEdit(edit);
}

async function addTokenAtLine(mark) {
  let   lineNumber = mark.lineNumber; 
  const line       = mark.document.lineAt(lineNumber);
  let   indentLen  = 0;
  let   lineText   = line.text;
  const lineRegx   = lineRegEx(mark.languageId);
  let   match      = lineRegx.exec(lineText);
  if(match) {
    log('err', `addTokenAtLine, line ${lineNumber} already has token`);
    return null;
  }
  match = indentRegEx.exec(lineText);
  if(!match) {
    log('addTokenAtLine, blank line, checking next line');
    lineNumber = lineNumber + 1;
    if(lineNumber >= mark.document.lineCount) {
      lineNumber = mark.lineNumber;
      log('addTokenAtLine, no more lines in document');
    }
    else {
      const nextLineText = mark.document.lineAt(lineNumber).text;
      match = indentRegEx.exec(nextLineText);
      if(!match) {
        log('addTokenAtLine, next line is blank');
        lineNumber = mark.lineNumber;
      }
      else {
        indentLen = match[1].length;
      }
    }
  }
  else 
    indentLen = match[1].length;
  lineText = getNewTokenLine(indentLen, mark.token, mark.languageId);
  await utils.insertLine(mark.document, lineNumber, lineText);
  return lineNumber;
}

async function getTokensInLine(lineText) {
  tokenRegExG.index = 0;
  return [...lineText.matchAll(tokenRegExG)];
}

async function delMarkFromLineAndGlobal(document, lineNumber, save = true) {
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  const languageId = document.languageId;
  const tokenMatch = tokenRegEx.exec(lineText);
  if(tokenMatch) {
    const token = tokenMatch[0];
    const {junk, bookmarkToken} = 
                     getJunkAndBookmarkToken(lineText, languageId);
    if(junk.length > 0) {
      log('delMarkFromLineAndGlobal, line has token and junk, '+
          'removing only token', document.uri.path, lineNumber, token);
      const newLineText = lineText.replace(bookmarkToken, '');
      await utils.replaceLine(document, lineNumber, newLineText);
    }
    else {
      log('delMarkFromLineAndGlobal, line has token and no junk, '+
          'removing line', document.uri.path, lineNumber, token);
      await utils.deleteLine(document, lineNumber);
    }
    marks.delGlobalMark(token);
    if(save) await marks.saveGlobalMarks();
    return true;
  }
  else return false;
}

async function toggle() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'Toggle, no active editor'); return; }
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text.trimEnd();
  if(tokenRegEx.test(lineText)) 
                  await delMarkFromLineAndGlobal(document, lineNumber);
  else {
    const mark = await marks.newGlobalMark(document, lineNumber);
    if(!mark) return;
    const tokenLineNumber = await addTokenAtLine(mark);
    const position   = new vscode.Position(tokenLineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), 
            vscode.TextEditorRevealType.InCenterIfOutsideViewport);
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

async function runOnAllTokensInDoc(document, getPos, getLine, func) {
  const text = document.getText();
  const matches = [...text.matchAll(tokenRegExG)];
  matches.reverse();
  for (const match of matches) {
    const offset = match.index;
    const token  = match[0];
    const res    = {token};
    if(getPos)  res.position = document.positionAt(offset); 
    if(getLine) res.lineText = utils.getLineFromTextAtOffset(text, offset);
    await func(res);
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

//bookmark:51ha;
async function cleanFile(document) {
  start('cleanFile');
  const fileFsPath = document.uri.fsPath;
  let haveMarkChg = false;
  const fileMarksByToken = {};
  await runOnAllTokensInDoc(document, true, true, async (fileMark) => {
    const {position, lineText, token} = fileMark;
    const lineNumber = position.line;
    const globalMark = marks.getGlobalMark(token);
    if(globalMark && (globalMark.fileFsPath != fileFsPath || 
                      globalMark.lineNumber != lineNumber)) {
      const newMark = await marks.newGlobalMark(
                                      document, lineNumber);
      const newToken = newMark.token;
      fileMarksByToken[newToken] = fileMark;
      const newLineText = lineText.replace(token, newToken);
      await replaceLineInDocument(document, lineNumber, newLineText);
      haveMarkChg = true;
      log(`cleanFile, replaced duplicate token, ${token} -> ${newMark.token}`);    
      return;
    }
    fileMarksByToken[fileMark.token] = fileMark;
  });
  const globalMarksByToken = marks.getMarksForFile(document.uri.path);
  for(const [token, fileMark] of Object.entries(fileMarksByToken)) {
    if(!globalMarksByToken[token]) {
      await marks.newGlobalMark(document, fileMark.position.line, token);
      haveMarkChg = true;
    }
  }
  for(const token of Object.keys(globalMarksByToken)) {
    if(!fileMarksByToken[token]) {
      await marks.delGlobalMark(token);
      haveMarkChg = true;
    }
  }
  if(haveMarkChg) await marks.saveGlobalMarks();
  end('cleanFile');
}

module.exports = {init, getLabel, bookmarkClick,
                  clearDecoration, justDecorated,
                  toggle, scrollToPrevNext, delMarkFromLineAndGlobal,    
                  clearFile, cleanFile};


