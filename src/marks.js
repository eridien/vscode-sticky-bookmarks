const vscode  = require('vscode');
const label   = require('./label.js');
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
  const label = await label.getLabel(document, languageId, line);
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
      const codicon = ''
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

