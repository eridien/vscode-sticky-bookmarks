const vscode   = require('vscode');
const utils    = require('./utils.js');
const {log} = utils.getLog('labl');

const keywordSetsByLang = {};

async function init() {
  const text = await utils.readTxt(true, 'keywords.json');
  const json = JSON.parse(text);
  for(const [lang, keywords] of Object.entries(json)) {
    const set = new Set(keywords);
    keywordSetsByLang[lang] = set;
  }
  return {};
}

function isKeyWord(languageId, word) {
  if(!keywordSetsByLang[languageId]) return false;
  return keywordSetsByLang[languageId].has(word);
}

function getSymbols(pos, symbols) {
  const parent = symbols[symbols.length - 1];
  for(const child of parent.children) {
    if(utils.rangeContainsPos(child.range, pos)) {
      symbols.push(child);
      return getSymbols(pos, symbols);
    }
  }
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

    compText += ' ' + lineText;
    lineNumber++;
  }
  while(compText.length < 60 && lineNumber < document.lineCount);

  return compText.trim().replace(/(\w)(\W)|(\W)(\w)/g, '$1$3 $2$4');
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
      return label;
    }
    const symbols = [{children: topSymbols}];
    const lineLen = document.lineAt(lineNumber).text.length;
    const pos = new vscode.Position(
                      lineNumber, Math.max(lineLen-1, 0));
    getSymbols(pos, symbols);
    symbols.shift();
    if (!symbols.length) {
      // log('getLabel, No symbol found', document.uri.path);
      return label;
    }
    symbols.reverse();
    // remove dupes?  todo
    let symStr = '';
    for(const sym of symbols) {
      symStr = `${sym.name}/${symStr}`;
    }
    symStr = symStr.slice(0, -1) + ' ● ' +  compText;
    return symStr;
  }
  catch (error) {
    log('err', 'getLabel error:', error.message);
  }
}

module.exports = { init, getLabel };

/*
settings: workbench.colorTheme   auto-detect color scheme
https://code.visualstudio.com/api/references/icons-in-labels
"https://github.com/microsoft/vscode-codicons/tree/main/src/icons"
"https://tabler.io/icons"
"https://lucide.dev/icons/"
"https://fontawesome.com/icons"

item.iconPath = new vscode.ThemeIcon("symbol-function"); // or...
item.iconPath = vscode.Uri.file("/path/to/icon.svg");    // or...
item.iconPath = { light: lightUri, dark: darkUri };

📄 🔖 ƒ 📂 ✏️ 📦 ❔ ⬚ ⌀ … ❓

/*
// const codicons = { 
//      1: "file",         2: "module",      3: "namespace",  4: "package", 
//      5: "class",        6: "method",      7: "property",   8: "field", 
//      9: "constructor", 10: "enum",       11: "interface", 12: "function", 
//     13: "variable",    14: "constant",   15: "string",    16: "number", 
//     17: "boolean",     18: "array",      19: "object",    20: "key",
//     21: "null",        22: "enummember", 23: "struct",    24: "event", 
//     25: "operator",    26: "typeparameter"
// }
//
// const unicodeIcons = {
//   file: "📄",          // U+1F4C4
//   function: "ƒ ",      // U+0192
//   method: "🛠️",        // U+1F6E0
//   variable: "📝",      // U+1F4DD
//   module: "📦",        // U+1F4E6
//   package: "📦",       // U+1F4E6
//   class: "🧱",         // U+1F9F1
//   constructor: "🏗️",   // U+1F3D7
//   constant: "🔒",      // U+1F512
//   string: "🔤",        // U+1F524
//   number: "🔢",        // U+1F522
//   boolean: "🔘",       // U+1F518
//   array: "📚",         // U+1F4DA
//   object: "🧩",        // U+1F9E9
//   key: "🔑",           // U+1F511
//   null: "␀",           // U+2400
//   event: "📅",         // U+1F4C5
//   operator: "➕",      // U+2795   ➖ ✖️ ➗
// };

// function getIconForKind(kind) {
//   const codicon = codicons[kind];
//   if(!codicon) return '  ';
//   const char = unicodeIcons[codicon];
//   log('getIconForKind', codicon, char);
//   // return char ?? new vscode.ThemeIcon(codicon);
//   return char ?? '  ';
// };

⚙ U+2699  Gear
⌘ U+2318  Place of Interest Sign (Command)
∞ U+221E  Infinity
✳ U+2733  Eight Spoked Asterisk
☯ U+262F  Yin Yang
⊕ U+2295  Circled Plus
⋆ U+22C6  Star Operator
⎈ U+2388  Helm Symbol

If you're using SVGs as iconPath, color is respected unless overridden by the theme.
But if you're using a ThemeIcon, 
     VS Code handles the coloring and ignores any color in the SVG, 
     since ThemeIcons are meant to match the theme's foreground color.
For TreeItems, SVGs with color will show as-is, unless you're trying to theme them.

codicons:
  triangle-down triangle-up triangle-right triangle-left
  chevron-right play send debug-hint debug-stackframe debug-start star star-full
  circle-large-outline pass-filled globe circle-filled circle-large-filled
  close-dirty debug-step-into debug-step-out export 
  fold-down fold-up grabber layout-panel

*/

