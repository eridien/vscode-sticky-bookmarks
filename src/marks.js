const vscode  = require('vscode');
const utils   = require('./utils.js');
const log     = utils.getLog('mark');

let globalMarks;
let context, glblFuncs;

async function init(contextIn, glblFuncsIn) { 
  context = contextIn;
  glblFuncs = glblFuncsIn;

  // clear globalMarks for testing
  // this fails but gets the job done
  // await context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  log('marks initialized'); 
  dumpGlobalMarks(true);
  return {};
}

function dumpGlobalMarks(all = false) {
  if(all) log('globalMarks', globalMarks);
  else    log('globalMarks', Object.keys(globalMarks));
}

function getRandomToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}

async function newGlobalMark(document, lineNumber) {
  const token = getRandomToken();
  const mark  = {token, document, lineNumber, type:'bookmark'};
  mark.folderPath  = vscode.workspace
                       .getWorkspaceFolder(document.uri).uri.path;
  mark.fileRelPath = vscode.workspace.asRelativePath(document.uri);
  mark.fsPath      = document.uri.fsPath;
  mark.languageId  = document.languageId;
  globalMarks[token] = mark;
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

function delGlobalMarksForFile(fileRelPath) {
  for(const [token, val] of Object.entries(globalMarks)) {
    if(val.fileRelPath === fileRelPath) delete globalMarks[token];
  }
  context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  log('delGlobalMarksForFile:', fileRelPath);
}

function sortedMarks() {
  log('sortedMarks');
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
  let folders=[], files=[], bookmarks=[];
  let lastFolderPath = null, lastFileRelPath;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      const {folderPath} = mark;
      lastFolderPath = folderPath;
      const id = utils.fnv1aHash(folderPath);
      files=[], bookmarks=[];
      folders.push({type:'folder', folderPath, children:files, id});
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      const {document, folderPath, fileRelPath} = mark;
      lastFileRelPath = fileRelPath;
      const id = utils.fnv1aHash(folderPath + '/' + fileRelPath);
      bookmarks=[];
      files.push({document, type:'file', folderPath, fileRelPath, 
                  children:bookmarks, id});
    }
    bookmarks.push(mark);
  }
  return folders;
}

module.exports = {init, dumpGlobalMarks, sortedMarks, 
                  newGlobalMark, delGlobalMark, delGlobalMarksForFile}

