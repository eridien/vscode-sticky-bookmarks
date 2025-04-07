const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('LABL');

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

async function getLabel(document, symName, symRange, lineNumber) {

}

module.exports = { getSurroundingSymbol, getLabel };
