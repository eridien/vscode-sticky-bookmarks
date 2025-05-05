const vscode = require('vscode');
const path   = require('path');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log, start, end}  = utils.getLog('text');

const showLineNumbers      = true;
const showBreadCrumbs      = true;
const showCodeWhenCrumbs   = true;
const openSideBarOnNewMark = true;
const maxLinesInCompText   = 6;

let context;
let gutDecLgt1Uri = null, gutDecDrk1Uri = null, gutterDecGen1 = null;
let gutDecLgt2Uri = null, gutDecDrk2Uri = null, gutterDecGen2 = null;

function init(contextIn) {
  context = contextIn;
  for(const [lang, keywords] of Object.entries(utils.keywords())) {
    keywordSetsByLang[lang] = new Set(keywords);
  }
  gutDecLgt1Uri = vscode.Uri.file(path.join( 
                  context.extensionPath, 'images', 'mark-icon-lgt1.svg'));
  gutDecLgt2Uri = vscode.Uri.file(path.join( 
                  context.extensionPath, 'images', 'mark-icon-lgt2.svg'));
  gutDecDrk1Uri = vscode.Uri.file(path.join(
                  context.extensionPath, 'images', 'mark-icon-drk1.svg'));
  gutDecDrk2Uri = vscode.Uri.file(path.join(
                  context.extensionPath, 'images', 'mark-icon-drk2.svg'));
  loadGutterDecs();
}

function tokenRegEx(languageId, eol = true, global = false) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const regxStr = `(${commLft})([\\u200B\\u200C\\u200D\\u2060]+\\.)`+
                   `${eol ? '$' : ''}(${commRgt})`;
  if(global) return new RegExp(regxStr, 'g');
  else       return new RegExp(regxStr);
}

function getGutterDec(gen) {
  return vscode.window.createTextEditorDecorationType({
    gutterIconSize: 'contain',
    light: { gutterIconPath: gen === 1 ? gutDecLgt1Uri : gutDecLgt2Uri },
    dark:  { gutterIconPath: gen === 1 ? gutDecDrk1Uri : gutDecDrk2Uri }
  });
};

function loadGutterDecs() {
  gutterDecGen1 = getGutterDec(1);
  gutterDecGen2 = getGutterDec(2);
}

vscode.window.onDidChangeActiveColorTheme((event) => {
  if(gutterDecGen1) {
    gutterDecGen1.dispose();
    gutterDecGen2.dispose();
  }
  loadGutterDecs();
});

const keywordSetsByLang = {};

function updateGutter() {
  // start('updateGutter');
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const fsPath = editor.document.uri.fsPath;
  const gen1DecRanges = [];
  const gen2DecRanges = [];
  const marksInFile   = marks.getMarksInFile(fsPath);
  for(const mark of marksInFile) {
    const {gen, lineNumber} = mark;
    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
    switch(gen) {
      case 1: gen1DecRanges.push({range}); break;
      case 2: gen2DecRanges.push({range}); break;
    }
  }
  editor.setDecorations(gutterDecGen1, gen1DecRanges);
  editor.setDecorations(gutterDecGen2, gen2DecRanges);
}

function isKeyWord(languageId, word) {
  if(!keywordSetsByLang[languageId]) return false;
  return keywordSetsByLang[languageId].has(word);
}

async function getCompText(mark) {
  let   {document, lineNumber} = mark;
  const languageId = document.languageId;
  const tokenRegxG = tokenRegEx(languageId,false,true);
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const regxEmptyComm = (commRgt !== '') 
             ? new RegExp(`\\s*${commLft}\\s*?${commRgt}\\s*`, 'g')
             : new RegExp(`\\s*${commLft}\\s*?$`,              'g');
  // go through lines until we have enough text
  let compText = '';
  let lineCount = 0;
  do {
    let lineText = document.lineAt(lineNumber).text;
    // remove tokens
    lineText = lineText.replaceAll(tokenRegxG, '');
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
    compText += ' ' + lineText + '\x00';
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

function prefixLabelWithLineNum(lineNumber, label) {
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
      log('getLabel, No topSymbols found.', document.uri.path);

      debugger;

      return prefixLabelWithLineNum(lineNumber, label);
    }
    let crumbStr = '';
    if(showBreadCrumbs) {
      const symbols = [{children: topSymbols}];
      const lineLen = document.lineAt(lineNumber).text.length;
      const pos = new vscode.Position(lineNumber, Math.max(lineLen-1, 0));
      getSymbols(pos, symbols);
      symbols.shift();
      if (!symbols.length) { return prefixLabelWithLineNum(lineNumber, label); }
      symbols.reverse();
      for(const sym of symbols) { crumbStr = `${sym.name} > ${crumbStr}`; }
      crumbStr = crumbStr.slice(0, -2);
      crumbStr = '● ' +  crumbStr + '●';
      crumbStr = prefixLabelWithLineNum(lineNumber, crumbStr);
    }
    if(showCodeWhenCrumbs && crumbStr.length > 0) return crumbStr + compText;
    return crumbStr;
  }
  catch (error) {
    log('err', 'getLabel error:', error.message);
    return '<...>';
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

async function bookmarkItemClick(item) {
  const mark = item.mark;
  if(!marks.verifyMark(mark)) { log('info', 'Bookmark Missing'); return; }
  await gotoAndDecorate(mark.document, mark.lineNumber);
}

async function toggle(gen) {
  const editor = vscode.window.activeTextEditor;
  if(!editor) {log('info', 'No active editor.'); return;}
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  let mark = marks.getMarkForLine(document, lineNumber);
  if(mark) {
    log('toggle: deleting mark', mark.fileRelUriPath, lineNumber);
    await marks.deleteMark(mark, true, true);
    return;
  }
  mark ??= await marks.newMark(document, lineNumber, gen);
  if(gen == 2) {
    let lineText = document.lineAt(lineNumber).text + mark.token;
    await utils.replaceLine(document, lineNumber, lineText);
  }
  if(openSideBarOnNewMark)  {
    await vscode.commands.executeCommand(
                          'workbench.view.extension.stickyBookmarks');
    await utils.sleep(100);
    await vscode.commands.executeCommand(
                          'workbench.action.focusActiveEditorGroup');
  }
  marks.dumpMarks('toggle');
}

async function scrollToPrevNext(fwd) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {log('scrollToPrevNext, no active editor'); return; }
  const document = editor.document;
  const lineCnt  = document.lineCount;
  if(lineCnt < 2) return;
  let tokenObjs = getTokenObjsInFile(document);
  let fileMarks = marks.getMarksInFile(document.uri.fsPath);
  if(tokenObjs.length == 0 && fileMarks.length == 0) {
    log('scrollToPrevNext, no bookmarks in file'); return;
  }
  const tokenLineNumbers = tokenObjs.map(tokenObj => tokenObj.lineNumber);
  const markLineNumbers  = fileMarks.map(fileMark => fileMark.lineNumber);
  const allLineNumbers   = tokenLineNumbers.concat(markLineNumbers);
  const startLnNum       = editor.selection.active.line;
  let lineNumber;
  if(fwd) lineNumber = (startLnNum == lineCnt-1) ? 0 : startLnNum+1;
  else    lineNumber = (startLnNum == 0) ? lineCnt-1 : startLnNum-1;
  while(lineNumber != startLnNum) {
    if(allLineNumbers.includes(lineNumber)) {
      await gotoAndDecorate(document, lineNumber);
      break;
    }
    lineNumber = fwd ? ((lineNumber == lineCnt-1) ? 0 : lineNumber+1)
                     : ((lineNumber == 0) ? lineCnt-1 : lineNumber-1);
  }
}

function getTokenObjsInFile(document) {
  const docText   = document.getText();
  const regexG    = tokenRegEx(document.languageId, false, true);
  const matches   = [...docText.matchAll(regexG)];
  const tokenObjs = [];
  for (const match of matches) {
    const offset     = match.index;
    const position   = document.positionAt(offset); 
    const lineNumber = position.line;
    const token      = match[0];
    tokenObjs.push({position, lineNumber, token});
  }
  return tokenObjs;
}

async function refreshMenu() {
  start('refreshMenu');
  await utils.runOnAllFolders(null, refreshFile);
  end('refreshMenu');
}

async function deleteTokensFromLineText(regexG, commLft, commRgt, lineText) {
  const matches  = [...lineText.matchAll(regexG)];
  if(matches.length == 0) return null;
  matches.reverse();
  let   newText     = '';
  let   keepComment = false;
  let   lastOfs     = lineText.length;
  for(const match of matches) {
    const token = match[0];
    const lftTokenOfs = match.index;
    const rgtTokenOfs = lftTokenOfs + token.length;
    let   beforeText = lineText.slice(0, lftTokenOfs);
    const afterText  = lineText.slice(rgtTokenOfs, lastOfs);    
    if(afterText.length > 0) {
      keepComment ||= (commRgt === '' && beforeText.indexOf(commLft) === -1);
      newText = afterText + newText;
    }
    lastOfs = lftTokenOfs;
  }
  return lineText.slice(0, lastOfs) + (keepComment ? commLft : '') + newText;
}

async function deleteAllTokensInFile(document) {
  const fsPath     = document.uri.fsPath;
  const docText    = document.getText();
  const groups     = /\r?\n/.exec(docText);
  let lineEnding = null;
  if(groups) lineEnding = groups[0];
  let lines;
  if(!lineEnding) lines = [docText];
  else            lines = docText.split(lineEnding);
  const lastLineNumber = lines.length - 1;
  const docRange = new vscode.Range(
                           0, 0, lastLineNumber, lines[lastLineNumber].length);
  let chgd = false;
  const regexG    = tokenRegEx(document.languageId, false, true);
  const [commLft, commRgt] = utils.commentsByLang(document.languageId);
  for(let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const lineText = lines[lineNumber];
    const newLine = await deleteTokensFromLineText(
                                           regexG, commLft, commRgt, lineText);
    if(newLine !== null) {
      chgd = true;
      lines[lineNumber] = newLine;
    }
  }
  if(!chgd) return;
  const newText = lineEnding ? lines.join(lineEnding) : lines[0];
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, docRange, newText);
  await vscode.workspace.applyEdit(edit);
}

async function refreshFile(document) {
  // log('refreshFile');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('refreshFile, no active editor'); return; }
    document = editor.document;
  }
  const tokenObjs = getTokenObjsInFile(document);
  const fileMarks = marks.getMarksInFile(document.uri.fsPath);
  if(tokenObjs.length == 0 && fileMarks.length == 0) return;
  fileMarks.sort((a, b) => a.lineNumber - b.lineNumber);
  // scan file from bottom to top
  let tokenObj = tokenObjs.pop();
  let mark     = fileMarks.pop();
  while(tokenObj || mark) {
    const tokenLineNum = tokenObj?.lineNumber ?? -1;
    const markLineNum  = mark    ?.lineNumber ?? -1;
    if(tokenLineNum == markLineNum) {
      // mark points to token
      if(mark.gen == 1) {
        log('refreshFile, gen1 mark has token, changing to gen2', markLineNum);
         mark.gen = 2;
      }
      if(mark.token !== tokenObj.token) {
        log('refreshFile, mark has wrong token, fixing mark', markLineNum);
        mark.token = tokenObj.token;
      }
      tokenObj = tokenObjs.pop();
      mark     = fileMarks.pop();
      continue;
    }
    if(tokenLineNum < markLineNum) {
      // have mark with no token in line
      if(mark.gen == 2) {
        log('refreshFile, gen2 mark with no token, deleting mark', markLineNum);
        await marks.deleteMark(mark, false, false);
      }
      mark = fileMarks.pop();
      continue;
    }
    // have token in line with no mark
    log('refreshFile, token with no mark, adding mark', tokenLineNum);
    await marks.newMark(document, tokenLineNum, 2, tokenObj.token, false);
    tokenObj = tokenObjs.pop();
  }
  await marks.saveMarkStorage();
  await utils.updateSide();
  await marks.dumpMarks('refreshFile');
}

async function runOnAllMarksInFile(document, markFunc) {
  const docText  = document.getText();
  const regexG   = tokenRegEx(document.languageId, false, true);
  const matches  = [...docText.matchAll(regexG)];
  matches.reverse();
  for (const match of matches) {
    const offset     = match.index;
    const position   = document.positionAt(offset); 
    const lineNumber = position.line;
    const lineText   = document.lineAt(lineNumber);
    const token      = match[0];
    await markFunc({document, lineNumber, lineText, token});
  }
}

module.exports = {init, getLabel, bookmarkItemClick, refreshMenu,
                  clearDecoration, justDecorated, updateGutter,
                  toggle, scrollToPrevNext,    
                  refreshFile, runOnAllMarksInFile, deleteAllTokensInFile
                  };


