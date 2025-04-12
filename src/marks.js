const vscode  = require('vscode');
const labels  = require('./labels.js');
const utils   = require('./utils.js');
const log     = utils.getLog('mark');

let globalMarks;
let context, glblFuncs;

async function init(contextIn, glblFuncsIn) { 
  context = contextIn;
  glblFuncs = glblFuncsIn;
  // this lets update sidebar to run which fails
  // await context.workspaceState.update('globalMarks', {});   // DEBUG
  globalMarks = context.workspaceState.get('globalMarks', {});
  log('marks initialized'); 
  return {};
}

function dumpGlobalMarks() {
  log('globalMarks', Object.keys(globalMarks));
}

function getRandomToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}

async function addGlobalMark(
                document, fileRelPath, line, lineNumber, languageId) {
  const folderPath = vscode.workspace
                           .getWorkspaceFolder(document.uri).uri.path;
  const label = await labels.getLabel(document, languageId, line);
  const token = getRandomToken();
  globalMarks[token] = {
              token, folderPath, fileRelPath, lineNumber, languageId, label};
  context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return token;
}

function delGlobalMark(token) {
  delete globalMarks[token];
  context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return '';
}

function delGlobalMarksForFile(relPath) {
  for(const [token, val] of Object.entries(globalMarks)) {
    if(val.fileRelPath === relPath) delete globalMarks[token];
  }
  context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  log('delGlobalMarksForFile:', relPath);
}

function kindToCodicon(kind) { 
  return {
     1: "file",         2: "module",      3: "namespace",  4: "package", 
     5: "class",        6: "method",      7: "property",   8: "field", 
     9: "constructor", 10: "enum",       11: "interface", 12: "function", 
    13: "variable",    14: "constant",   15: "string",    16: "number", 
    17: "boolean",     18: "array",      19: "object",    20: "key",
    21: "null",        22: "enummember", 23: "struct",    24: "event", 
    25: "operator",    26: "typeparameter"}[kind] || 'question';
}

const unicodeIcons = {
  folder: "📁",        // U+1F4C1
  file: "📄",          // U+1F4C4
  function: "ƒ",        // U+0192 (Latin Small Letter F with Hook)
  method: "🛠️",        // U+1F6E0
  variable: "📝",      // U+1F4DD
  module: "📦",        // U+1F4E6
  package: "📦",       // U+1F4E6
  class: "🧱",         // U+1F9F1
  constructor: "🏗️",   // U+1F3D7
  constant: "🔒",      // U+1F512
  string: "🔤",        // U+1F524
  number: "🔢",        // U+1F522
  boolean: "🔘",       // U+1F518
  array: "📚",         // U+1F4DA
  object: "🧩",        // U+1F9E9
  key: "🔑",           // U+1F511
  null: "␀",           // U+2400
  event: "📅",         // U+1F4C5
  operator: "➕",      // U+2795 (use ➖ ✖️ ➗ as needed)
  question: "❓"       // U+2753
};

function getMarksTree() {
  log('getMarksTree');
  const marksArray = Object.values(globalMarks);
  marksArray.sort((a, b) => {
    if(a.folderPath .toLowerCase() > 
       b.folderPath .toLowerCase()) return +1;
    if(a.folderPath .toLowerCase() < 
       b.folderPath .toLowerCase()) return -1;
    if(a.fileRelPath.toLowerCase() > 
       b.fileRelPath.toLowerCase()) return +1;
    if(a.fileRelPath.toLowerCase() <
       b.fileRelPath.toLowerCase()) return -1;
    return (a.lineNumber - b.lineNumber);
  });
  let folders=[], files=[], bookmarks=[], bookmarksInSym=[];
  function clearEmptyHead() {
    if(bookmarks.length > 0) {
      const lastBookmark = bookmarks.slice(-1)[0];
      if(lastBookmark.type == 'symHead' && 
             bookmarksInSym.length === 0)
        delete lastBookmark.bookmarksInSym;
    }
  }
  let lastFolderPath = null;
  let lastFileRelPath, lastSymName;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      const {folderPath} = mark;
      lastFolderPath = folderPath;
      clearEmptyHead();
      const id = utils.fnv1aHash(folderPath);
      files=[], bookmarks=[], bookmarksInSym=[];
      folders.push({codicon:'folder', type:'folder',
                    folderPath, children:files, id});
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      const {folderPath, fileRelPath} = mark;
      lastFileRelPath = fileRelPath;
      clearEmptyHead();
      const id = utils.fnv1aHash(folderPath + '/' + fileRelPath);
      bookmarks=[], bookmarksInSym=[];
      files.push({codicon:'file',  type:'file',
                  folderPath, fileRelPath, mark, children:bookmarks, id});
      lastSymName = null;
    }
    const {symName, symKind, symHash, compText} = mark.label;
    if(symName === null) {
      clearEmptyHead();
      lastSymName = null;
      bookmarks.push({codicon:'bookmark', type:'noSym', mark, 
                      compText, id:mark.token});
      continue;
    }
    if(symName !== lastSymName) {
      clearEmptyHead();
      lastSymName = symName;
      const symLineNum = mark.label.symLineNum;
      bookmarksInSym = [];
      const codicon = kindToCodicon(symKind);
      if(mark.lineNumber == symLineNum) {
        bookmarks.push({codicon, type:'symHead', 
                        symName, symLineNum, compText,
                        children:bookmarksInSym, id:mark.token});
        continue;
      }
      else bookmarks.push({codicon, type:'symWrapper', 
                           symName, symLineNum, compText, 
                           children:bookmarksInSym, id:symHash});
    }
    bookmarksInSym.push({codicon:'bookmark', type:'symChild',  
                         mark, compText, id:mark.token});
  }
  clearEmptyHead();
  return folders;
}

module.exports = {init, dumpGlobalMarks, getMarksTree, 
                  addGlobalMark, delGlobalMark, delGlobalMarksForFile}

