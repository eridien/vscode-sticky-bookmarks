const vscode = require('vscode');
const path   = require('path');
const utils  = require('./utils.js');
const log    = utils.getLog('mark');

let globalMarks;
let context, glblFuncs;
let initFinished = false;

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
    const fileFsPath = mark.document.fileName;
    const markUri = vscode.Uri.file(path.resolve(fileFsPath)); 
    const folder  = vscode.workspace.getWorkspaceFolder(markUri);
    if(!folder) { 
      delete globalMarks[token];
      continue;
    }
    mark.folderIdx  = folder.index;
    mark.folderName = folder.name;
    mark.fileFsPath = fileFsPath;
    const document = 
            await vscode.workspace.openTextDocument(markUri);
    if(!document) { 
      delete globalMarks[token];
      continue;
    }
    mark.document   = document;
    log('init token:', token);;
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  log('marks initialized'); 
  initFinished = true;
  dumpGlobalMarks('init');
  return {};
}

function waitForInit() {
  return new Promise((resolve) => {
    const checkInit = () => {
      if (initFinished) {
        resolve();
      } else {
        setTimeout(checkInit, 100);
      }
    };
    checkInit();
  });
}

function getGlobalMarks() {
  return globalMarks;
}

function dumpGlobalMarks(caller, all = false) {
  if(all) log(caller, 'globalMarks', globalMarks);
  else    log(caller, 'globalMarks', Object.keys(globalMarks));
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
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileRelPath === fileRelPath) delete globalMarks[token];
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  log('delGlobalMarksForFile:', fileRelPath);
}

module.exports = {init, waitForInit, getGlobalMarks, dumpGlobalMarks, 
                  newGlobalMark, delGlobalMark, delGlobalMarksForFile}

