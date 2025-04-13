const vscode  = require('vscode');
const path    = require('path');
const utils   = require('./utils.js');
const log     = utils.getLog('mark');

let globalMarks;
let context, glblFuncs;

async function init(contextIn, glblFuncsIn) { 
  context = contextIn;
  glblFuncs = glblFuncsIn;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    globalMarks = {};
    await context.workspaceState.update('globalMarks', globalMarks);
    log('no workspace folders found');
    return {};
  }
  // clear globalMarks for testing
  // this fails but gets the job done
  // await context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  for(const [token, mark] of Object.entries(globalMarks)) {
    mark.fileFsPath = mark.document.fileName;
    mark.document   = await vscode.workspace.openTextDocument(mark.fileFsPath);
    if(!mark.document) { 
      delete globalMarks[token];
      continue;
    }
    const markUri = vscode.Uri.file(path.resolve(mark.fileFsPath)); 
    const folder  = vscode.workspace.getWorkspaceFolder(markUri);
    if(!folder) { 
      delete globalMarks[token];
      continue;
    }
    mark.folderIdx  = folder.index;
    mark.folderName = folder.name;
  }
  await context.workspaceState.update('globalMarks', globalMarks);
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
/*

function getProjectIdx(document) {
  return 0;
}
*/
async function newGlobalMark(document, lineNumber) {
  const token = getRandomToken();
  const mark  = {token, document, lineNumber, type:'bookmark'};
  mark.folderPath  = vscode.workspace
                       .getWorkspaceFolder(document.uri).uri.path;
  mark.fileRelPath = vscode.workspace.asRelativePath(document.uri);
  mark.languageId  = document.languageId;
  mark.fileFsPath  = document.fileName;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  let folder;
  for (let i = 0; i < workspaceFolders.length; i++) {
    folder = workspaceFolders[i];
    if (document.uri.fsPath.startsWith(folder.uri.fsPath)) {
      mark.folderIdx = i;
      break;
    }
  }
  mark.folderName = folder.name;
  globalMarks[token] = mark;
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return token;
}

async function delGlobalMark(token) {
  delete globalMarks[token];
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return '';
}

async function delGlobalMarksForFile(fileRelPath) {
  for(const [token, val] of Object.entries(globalMarks)) {
    if(val.fileRelPath === fileRelPath) delete globalMarks[token];
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  log('delGlobalMarksForFile:', fileRelPath);
}

function rootItems() {
  log('rootItems');
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
      folders.push({type:'folder', folderPath, id});
      lastFileRelPath = null;

      // item.iconPath = new vscode.ThemeIcon('chevron-right');
      // delete item.children;

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

module.exports = {init, dumpGlobalMarks, rootItems, 
                  newGlobalMark, delGlobalMark, delGlobalMarksForFile}

