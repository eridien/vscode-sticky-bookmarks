const vscode   = require('vscode');
const keyWords = require('./keywords.js');
const utils    = require('./utils.js');
const log      = utils.getLog('LABL');

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
    const symbols = [{children: topSymbols}];
    const lineLen = document.lineAt(lineNumber).text.length;
    const pos = new vscode.Position(
                      lineNumber, Math.max(lineLen-1, 0));
    getSymbols(pos, symbols);
    symbols.shift();
    if (!symbols.length) {
      log('getSurroundingSymbol, No symbol found', uri.path);
      return null;
    }
    if(symbols.length > 1 && 
      (symbols[symbols.length-1].name === 
       symbols[symbols.length-2].name)) {
      symbols.pop();
    }
    return symbols[symbols.length-1];
  }
  catch (error) {
    log('err', 'getSurroundingSymbol error:', error.message);
    return null;
  }
}

const nullChar = String.fromCharCode(1);

async function getLabel(document, languageId, line) {
  let lineNumber = line.lineNumber;
  const symbol   = await getSurroundingSymbol(document, lineNumber);
  let symName, symOfs;
  if(symbol) {
    symName = symbol.name;
    symOfs = lineNumber - symbol.location.range.start.line;
  }
  else {
    symName = nullChar;
    symOfs  = 0;
  }
  let compText = '';
  while(compText.length < 60 && 
        lineNumber < document.lineCount - 1) {
    let lineText = document.lineAt(lineNumber)
                   .text.trim().replaceAll(/\s+/g, ' ');
    const matches = lineText.matchAll(/\b\w+?\b/g);
    if(matches.length == 0) {
      compText = lineText;
      break;
    }
    for(const match of matches) {
      const word = match[0];
      if(keyWords.isKeyWord(languageId, word)) {
        lineText = lineText.replaceAll(word, '')
                           .replaceAll(/\s+/g, ' ').trim();
      }
      lineText = lineText.replaceAll(/\B\s+\B/g, '');
    }
    compText += ' ' + lineText;
    lineNumber++;
  }
  compText = compText.replaceAll(/\B\s+?|\s+?\B/g, '')
                     .replaceAll(/:[0-9a-z]{4};/g, '')
                     .replaceAll(/\/\/\s*?\/\//g, '\/\/');
  return {symName, symOfs, compText};
}

module.exports = { getLabel };
