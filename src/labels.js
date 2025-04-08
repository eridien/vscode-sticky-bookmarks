const vscode   = require('vscode');
const keyWords = require('./keywords.js');
const utils    = require('./utils.js');
const log      = utils.getLog('LABL');

function getSymbols(range, symbols) {
  const parent = symbols[symbols.length - 1];
  for(const child of parent.children) {
    if(utils.containsRange(child.range, range)) {
      symbols.push(child);
      return getSymbols(range, symbols);
    }
  }
}

async function getSurroundingSymbol(uri, range) {
  try {
    const topSymbols = await vscode.commands.executeCommand(
                      'vscode.executeDocumentSymbolProvider', uri);
    if (!topSymbols || !topSymbols.length) {
      log('err', 'No topSymbols found.');
      return null;
    }
    const symbols = [{children: topSymbols}];
    getSymbols(range, symbols);
    symbols.shift();
    if (!symbols.length) {
      log('getSurroundingSymbol, No symbol found', {uri, range});
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

async function getLabel(document, languageId, line) {
  let  lineNumber = line.lineNumber;
  const uri        = document.uri;
  const relPath    = vscode.workspace.asRelativePath(uri);
  const symbol     = await getSurroundingSymbol(uri, line.range);
  let symName, symOfs;
  if(symbol) {
    symName  = symbol.name;
    const symRange = symbol.location.range; 
    symOfs   = lineNumber - symRange.start.line;
  }
  else symName, symOfs = null;
  let compText = '';
  while(compText.length < 30 && 
        lineNumber < document.lineCount - 1) {
    // const addFunc  =  async function add(xFunc yFunc) {
    //   return (await xFunc() + await yFunc());
    // };
    let lineText = document.lineAt(lineNumber)
                   .text.trim().replaceAll(/\s+/g, ' ');
    // const addFunc = async function add(xFunc yFunc) {
    // return (await xFunc() + await yFunc());
    // };
    const matches = lineText.matchAll(/\b.*?\b/g);
    for(const match of matches) {
      const word = match[0];
      // 'const'  'addFunc' 'async' 'function' 'add' 'xFunc' 'yFunc'
      if(word in keyWords.keywords[languageId]) {
        lineText = lineText.replaceAll(word, '')
                           .replaceAll(/\s+/g, ' ').trim();
      }
      // addFunc = add(xFunc yFunc) {
      // ( xFunc() + yFunc());
      // };
      // lineText = lineText.replaceAll( /(?!\b\s+\b)\s+/g, '');
      lineText = lineText.replaceAll(/\B\s+\B/g, '');
      // addFunc=add(xFunc yFunc){
      // (xFunc()+yFunc());
      // };
    }
    compText += ' ' + lineText;
    // addFunc=add(xFunc yFunc){ (xFunc()+yFunc()); };
    lineNumber++;
  }
  compText = compText.replaceAll(/\B\s+\B/g, '')
  // addFunc=add(xFunc yFunc){(xFunc()+yFunc());};
  // addFunc=add(xFunc yFunc){(xFun
  return {relPath, symName, symOfs, compText};
}

module.exports = { getSurroundingSymbol, getLabel };
