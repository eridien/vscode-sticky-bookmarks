const vscode = require('vscode');
const labels = require('./labels.js');
const utils  = require('./utils.js');
const log    = utils.getlog('mark');

let context, globalMarks;

function init(contextIn) { 
  context = contextIn;

  context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  log('marks initialized'); 
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
  return token;
}

function delGlobalMark(token) {
  delete globalMarks[token];
  context.workspaceState.update('globalMarks', globalMarks);
  return '';
}

function delGlobalMarksForFile(relPath) {
  for(const [token, val] of Object.entries(globalMarks)) {
    if(val.fileRelPath === relPath) delete globalMarks[token];
  }
  context.workspaceState.update('globalMarks', globalMarks);
  log('delGlobalMarksForFile:', relPath);
}

const kindToCodicon= {
     1: "file",         2: "module",      3: "namespace",  4: "package", 
     5: "class",        6: "method",      7: "property",   8: "field", 
     9: "constructor", 10: "enum",       11: "interface", 12: "function", 
    13: "variable",    14: "constant",   15: "string",    16: "number", 
    17: "boolean",     18: "array",      19: "object",    20: "key",
    21: "null",        22: "enummember", 23: "struct",    24: "event", 
    25: "operator",    26: "typeparameter"} ;

function getMarksTree() {
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
  function cleaEmptyHead() {
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
      lastFolderPath = mark.folderPath;
      cleaEmptyHead();
      files=[], bookmarks=[], bookmarksInSym=[];
      folders.push({kind:'folder', type:'folder',
                    folderPath:mark.folderPath, files});
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      lastFileRelPath = mark.fileRelPath;
      cleaEmptyHead();
      bookmarks=[], bookmarksInSym=[];
      files.push({kind:'file',  type:'file',
                  fileRelPath:mark.fileRelPath, bookmarks});
      lastSymName = null;
    }
    const {symName, symKind} = mark.label;
    if(symName === null) {
      cleaEmptyHead();
      lastSymName = null;
      bookmarks.push({kind:'bookmark', type:'noSym', mark});
      continue;
    }
    if(symName !== lastSymName) {
      cleaEmptyHead();
      lastSymName = symName;
      mark.label.compText = null;
      const symLineNum = mark.label.symLineNum;
      bookmarksInSym = [];
      if(mark.lineNumber == symLineNum) {
        bookmarks.push({kind:'bookmark', type:'symHead', 
                        symName, symLineNum, mark, bookmarksInSym});
        continue;
      }
      else bookmarks.push({kind:kindToCodicon[symKind] ?? 'question', 
                           type:'symWrapper', symName, symLineNum, 
                           bookmarksInSym});
    }
    bookmarksInSym.push({kind:'bookmark', type:'symChild',  mark});
  }
  cleaEmptyHead();
  return folders;
}

module.exports = {init, dumpGlobalMarks, getMarksTree, 
                  addGlobalMark, delGlobalMark, delGlobalMarksForFile}

