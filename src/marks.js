const vscode = require('vscode');
const path   = require('path');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DEBUG_REMOVE_MARKS_ON_START = true;
const DEBUG_REMOVE_MARKS_ON_START = false;

let globalMarks;
let context, glblFuncs;
let initFinished = false;

async function init(contextIn, glblFuncsIn) {
  start('init marks');
  context = contextIn;
  glblFuncs = glblFuncsIn;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    globalMarks = {};
    await context.workspaceState.update('globalMarks', globalMarks);
    log('no workspace folders found');
    return {};
  }
  if(DEBUG_REMOVE_MARKS_ON_START)
      await context.workspaceState.update('globalMarks', {});

  globalMarks = context.workspaceState.get('globalMarks', {});
  for(const [token, mark] of Object.entries(globalMarks)) {
    const fileFsPath = mark.document.fileName;
    if(!await utils.fileExists(fileFsPath)) {                          //:5l5l;
      log(`file ${fileFsPath} does not exist, removing ${token}`);
      delete globalMarks[token];
      continue;
    }
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
    // log('init token:', token);
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  initFinished = true;
  end('init marks');
  dumpGlobalMarks('init');
  return {};
}

function waitForInit() {
  if (initFinished) return Promise.resolve();
  return new Promise((resolve) => {
    const checkInit = () => {
      if (initFinished) {
        resolve();
      } else {
        setTimeout(checkInit, 50);
      }
    };
    checkInit();
  });
}

function getGlobalMarks() {
  return globalMarks;
}

function dumpGlobalMarks(caller, list, dump) {
  caller = caller + ' marks: ';
  if(Object.keys(globalMarks).length === 0) {
    log(caller, '<no globalMarks>');
    return;
  }
  if(dump) log(caller, 'globalMarks', globalMarks);
  else if(list) {
    let sortedMarks = Object.entries(globalMarks)
       .sort((a, b) => ( a[1].fileRelPath.localeCompare(b[1].fileRelPath) ||
                         a[1].lineNumber - b[1].lineNumber));
    let str = "\n";
    for(let [token, mark] of sortedMarks) {
      token = token.replace(/:/g, '').replace(/;/g, '');
      str += `${token} -> ${mark.fileRelPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId.slice(0,3)}\n`;
    }
    log(caller, str);
  }
  else {
    let str = "";
    for(let token of Object.keys(globalMarks)) {
      token = token.replace(/:/g, '').replace(/;/g, '');
      str += token + ' ';;
    }
    log(caller, str);
  }
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

const doc = vscode.window.activeTextEditor.document;
const uri = doc.uri;

// Full path (platform-specific)
const fsPath = uri.fsPath;

// URI-style path
const uriPath = uri.path;

// File name (just the base name)
const fileName = path.basename(fsPath);

// Folder (just the directory path)
const folder = path.dirname(fsPath);

console.log('fsPath:', fsPath);
console.log('path:', uriPath);
console.log('file name:', fileName);
console.log('folder:', folder);


*/
async function newGlobalMark(document, lineNumber) {
  const token = getRandomToken();
  const mark  = {token, document, lineNumber, type:'bookmark'};
  mark.folderPath  = vscode.workspace
                       .getWorkspaceFolder(document.uri).uri.path;
  mark.filePath   = document.uri.path;
  mark.fileRelPath =
       mark.filePath.slice( mark.folderPath.length + 1);
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

async function delGlobalMark(token) {                                  //:qun7;
  delete globalMarks[token];
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  dumpGlobalMarks('delGlobalMark');
}

async function replaceGlobalMark(oldToken, newToken) {
  globalMarks[newToken] = globalMarks[oldToken];
  delete globalMarks[oldToken];
  globalMarks[newToken].token = newToken;
  glblFuncs.updateSidebar();
  dumpGlobalMarks('delGlobalMark');
}

async function delGlobalMarksForFile(folderPath) {
  for(const [token, mark] of Object.entries(globalMarks)) {
    const fileRelPath =
               folderPath.slice( mark.folderPath.length + 1);
    if(mark.fileRelPath === fileRelPath) delete globalMarks[token];
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
}

module.exports = {init, waitForInit, getGlobalMarks, dumpGlobalMarks,
                  newGlobalMark, delGlobalMark, replaceGlobalMark,
                  delGlobalMarksForFile}



