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

let context, gutDecLgt1Uri = null, gutDecLgt2Uri = null,
             gutDecDrk1Uri = null, gutDecDrk2Uri = null;

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
}

function getGutterDec(gen) {
  return vscode.window.createTextEditorDecorationType({
    gutterIconSize: 'contain',
    light: { gutterIconPath: gen === 1 ? gutDecLgt1Uri : gutDecLgt2Uri },
    dark:  { gutterIconPath: gen === 1 ? gutDecDrk1Uri : gutDecDrk2Uri }
  });
};

const keywordSetsByLang = {};

function tokenRegEx(languageId, eol = true, global = false) {
  const [commLft, commRgt] = utils.commentsByLang(languageId);
  const regxStr = `${commLft}([\\u200B\\u200C\\u200D\\u2060]+\\.`+
                  `${eol ? '$' : ''})${commRgt}`;
  if(global) return new RegExp(regxStr, 'g');
  else       return new RegExp(regxStr);
}

function updateGutter() {
  const gutterDecGen1 = getGutterDec(1);
  const gutterDecGen2 = getGutterDec(2);
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const fsPath = editor.document.uri.fsPath;
  const gen1DecRanges = [];
  const gen2DecRanges = [];
  const marksForFile  = marks.getMarksForFile(fsPath);
  for(const mark of marksForFile) {
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
      crumbStr = '● ' +  crumbStr + '●';
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
    marks.deleteMark[mark];
    await marks.saveGlobalMarks();
  }
  else {
    while(tokenMatches.length > 1 && tokenMatches[0][0] !== mark.token) {
      const foundToken = tokenMatches[0][0];
      marks.deleteMark[foundToken];
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

async function addTokenToLine(document, lineNumber, token) {
  if (lineNumber < 0 || lineNumber >= document.lineCount) return;
  const line      = document.lineAt(lineNumber);
  const lineText  = line.text;
  const edit      = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, lineText + token);
  await vscode.workspace.applyEdit(edit);
}

async function delMarkFromLineAndGlobal(document, lineNumber, lineText) {
  const languageId = document.languageId;
  const line       = document.lineAt(lineNumber);
  if(line) {
    lineText ??= line.text;
    const tokenMatches = tokenRegEx(languageId, false).exec(lineText);
    if(tokenMatches) {
      const token      = tokenMatches[0];
      const end        = line.range.end;
      const newEndPos  = end.translate(0, -token.length);
      const tokenRange = new vscode.Range(newEndPos, end);
      const edit       = new vscode.WorkspaceEdit();
      edit.delete(document.uri, tokenRange);
      await vscode.workspace.applyEdit(edit);
    }
  }
  marks.delMarkForLine(document, lineNumber);
}

async function toggle(gen) {
  const editor = vscode.window.activeTextEditor;
  if(!editor) {log('info', 'No active editor.'); return;}
  const document = editor.document;
  if(document.lineCount == 0) return;
  const lineNumber = editor.selection.active.line;
  let mark = marks.getMarkForLine(document, lineNumber);
  if(mark) {
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
  // let haveDel = false;
  // await runOnAllTokensInDoc(document, true, false, async (params) => {
  //   const {position} = params;
  //   await delMarkFromLineAndGlobal(document, position.line, false);
  //   haveDel = true;
  // });
  // if(haveDel && saveMarks) await marks.saveGlobalMarks();
}

function getTokensInFile(document) {
  const docText  = document.getText();
  const regexG   = tokenRegEx(document.languageId, false, true);
  const matches  = [...docText.matchAll(regexG)];
  if(matches.length == 0) return [];
  const tokens = [];
  for (const match of matches) {
    const offset     = match.index;
    const position   = document.positionAt(offset); 
    const lineNumber = position.line;
    const token      = match[0];
    tokens.push({lineNumber, token});
  }
  return tokens;
}

async function refreshMenu() {
  log('refreshMenu');
  start('refreshMenu');
  await utils.runOnAllFolders(null, refreshFile);
  end('refreshMenu');
}

async function runOnAllMarksInFile(document, markFunc) {
  const docText  = document.getText();
  const regexG   = tokenRegEx(document.languageId, false, true);
  const matches  = [...docText.matchAll(regexG)];
  if(matches.length == 0) return;
  matches.reverse();
  const funcRes = [];
  for (const match of matches) {
    const offset     = match.index;
    const position   = document.positionAt(offset); 
    const lineNumber = position.line;
    const lineText   = document.lineAt(lineNumber);
    const token      = match[0];
    funcRes.push(await markFunc({document, lineNumber, lineText, token}));
  }
  return funcRes;
}

async function deleteMarkFromText(fsPath, lineNumber) {
  const document = await vscode.workspace.openTextDocument(fsPath);
  if(!document || lineNumber >= document.lineCount) return;
  const line       = document.lineAt(lineNumber);
  const lineText   = line.text;
  const languageId = document.languageId;
  const tokenRegx  = tokenRegEx(languageId, true);
  const matches    = tokenRegx.exec(lineText);
  if(matches) {
    const token = matches[0];
    const newText = lineText.slice(0, -token.length);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, line.range, newText);
    await vscode.workspace.applyEdit(edit);
  }
}

async function refreshFile(document) {
  log('refreshFile');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    document = editor.document;
  }
  const tokens     = getTokensInFile(document);
  const fileMarks  = marks.getMarksForFile(document.uri.fsPath);
  if(tokens.length == 0 && fileMarks.length == 0) return;
  fileMarks.sort((a, b) => a.lineNumber - b.lineNumber);
  // scan file from bottom to top
  let tokenObj = tokens   .pop();
  let mark     = fileMarks.pop();
  while(tokenObj || mark) {
    const tokenLineNum = tokenObj?.lineNumber ?? -1;
    const markLineNum  = mark    ?.lineNumber ?? -1;
    if(tokenLineNum == markLineNum) {
      // mark points to token
      mark.gen   = 2;
      mark.token = tokenObj.token;
      tokenObj   = tokens   .pop();
      mark       = fileMarks.pop();
      continue;
    }
    if(tokenLineNum < markLineNum) {
      // have mark with no token in line
      mark.gen = 1;
      await marks.removeTokenFromMark(mark, false);
      mark = fileMarks.pop();
      continue;
    }
    // have token in line with no mark
    await marks.newMark(document, tokenLineNum, 2, tokenObj.token, false);
    tokenObj = tokens.pop();
  }
  await marks.saveMarkStorage();
  await utils.updateSide();
}

module.exports = {init, getLabel, bookmarkClick, refreshMenu,
                  clearDecoration, justDecorated, updateGutter,
                  toggle, scrollToPrevNext, delMarkFromLineAndGlobal,    
                  clearFile, refreshFile, deleteMarkFromText, runOnAllMarksInFile
                  };


