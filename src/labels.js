const vscode   = require('vscode');
const keyWords = require('./keywords.js');
const utils    = require('./utils.js');
const log      = utils.getLog('labl');

function getSymbols(pos, symbols) {
  const parent = symbols[symbols.length - 1];
  for(const child of parent.children) {
    if(utils.rangeContainsPos(child.range, pos)) {
      symbols.push(child);
      return getSymbols(pos, symbols);
    }
  }
}

async function getSurroundingSymbol(document, lineNumber) {
  try {
    const uri = document.uri;
    const topSymbols = await vscode.commands.executeCommand(
                      'vscode.executeDocumentSymbolProvider', uri);
    if (!topSymbols || !topSymbols.length) {
      log('No topSymbols found.');
      return null;
    }
    for(const sym of topSymbols) {
      const lineNumber = sym.location.range.start.line;
      const lineLen    = document.lineAt(lineNumber).text.length;
      const pos = new vscode.Position(
                         lineNumber, Math.max(lineLen-1, 0));
      if(utils.rangeContainsPos(sym.range, pos))
        return sym;
    }
    return null;
  }
  catch (error) {
    log('err', 'getSurroundingSymbol error:', error.message);
    return null;
  }
}

async function getLabel(document, languageId, line) {
  let lineNumber = line.lineNumber;
  const symbol   = await getSurroundingSymbol(document, lineNumber);
  let symName, symLineNum, symKind;
  if(symbol) {
    symName    = symbol.name;
    symLineNum = symbol.location.range.start.line;
    symKind    = symbol.kind;
  }
  else symName = symLineNum = symKind = null;

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
        if(keyWords.isKeyWord(languageId, word)) {
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

    compText += ' ' + lineText;
    lineNumber++;
  }
  while(compText.length < 60 && lineNumber < document.lineCount);
  compText = compText.trim();

  const symHash = utils.fnv1aHash(
                         `${document.uri.path}:${symName}:${symKind}`);
  
  return {symKind, symName, symLineNum, compText, symHash};
}


module.exports = { getLabel };
