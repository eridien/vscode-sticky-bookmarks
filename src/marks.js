const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DONT_LOAD_MARKS_ON_START = true;
const DONT_LOAD_MARKS_ON_START = false;

let globalMarks = {};
let context;

let initFinished = false;

async function init(contextIn) {
  start('init marks');
  context = contextIn;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    globalMarks = {};
    await context.workspaceState.update('globalMarks', globalMarks);
    log('no workspace folders found');
    return {};
  }
  if(!DONT_LOAD_MARKS_ON_START)
    globalMarks = context.workspaceState.get('globalMarks', {});

  const docsByFsPath = {};
  const checkedFiles = new Set();
  const badFiles     = new Set();
  for(const [token, mark] of Object.entries(globalMarks)) {
    const fileFsPath = mark.fileFsPath;
    if(badFiles.has(fileFsPath)) {
      delete globalMarks[token];
      continue;
    }
    if(!checkedFiles.has(fileFsPath)) {
      checkedFiles.add(fileFsPath);
      const uri      = vscode.Uri.file(fileFsPath);
      const folder   = vscode.workspace.getWorkspaceFolder(uri);
      const document = await vscode.workspace.openTextDocument(uri);
      if(document) docsByFsPath[fileFsPath] = document;
      if(!folder || !document || !await utils.fileExists(fileFsPath)) {
        log(`folder ${mark.folderName} or file ${mark.fileName} missing`);
        badFiles.add(fileFsPath);
        delete globalMarks[token];
        continue;
      }
    }
    mark.document = docsByFsPath[fileFsPath];
    mark.inWorkspace = true;
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  initFinished = true;
  utils.updateSidebar(); 
  dumpGlobalMarks('init');
  end('init marks');
}

function waitForInit() {
  if (initFinished) return Promise.resolve();
  return new Promise((resolve) => {
    const checkInit = () => {
      if (initFinished) { resolve(); } 
      else { setTimeout(checkInit, 50); }
    };
    checkInit();
  });
}

function putGlobalMark(token) {globalMarks[token] = token}
function delGlobalMark(token) {delete globalMarks[token]}
function getGlobalMark(token) {return globalMarks[token]}
function getGlobalMarks()     {return globalMarks}

function getMarksForFile(fileFsPath) {
  return Object.values(globalMarks).filter(
                mark => mark.fileFsPath === fileFsPath);
}

async function saveGlobalMarks() {
  await context.workspaceState.update('globalMarks', globalMarks);
  utils.updateSidebar();
  dumpGlobalMarks('saveGlobalMarks');
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
       .sort((a, b) => ( 
            a[1].fileRelUriPath.localeCompare(b[1].fileRelUriPath) ||
            a[1].lineNumber - b[1].lineNumber));
    let str = "\n";
    for(let [token, mark] of sortedMarks) {
      str += `${utils.tokenToDigits(token)} -> ${mark.fileRelUriPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(let token of Object.keys(globalMarks)) {
      token = utils.tokenToDigits(token);
      str += token + ' ';
    }
    log(caller, str);
  }
}

async function newGlobalMark(document, lineNumber, token) {
  token ??= utils.getUniqueToken();
  const mark  = {token, document, lineNumber,
                 languageId: document.languageId};
  const filePaths = utils.getPathsFromFileDoc(document); 
  if(!filePaths?.inWorkspace) return null;
  Object.assign(mark, filePaths);
  globalMarks[token] = mark;
  return mark;
}

async function replaceGlobalMark(oldToken, newToken) {
  globalMarks[newToken] = globalMarks[oldToken];
  delete globalMarks[oldToken];
  globalMarks[newToken].token = newToken;
  utils.updateSidebar();
  dumpGlobalMarks('replaceGlobalMark');
}

async function delGlobalMarksForFile(document) {
  const docUriPath = document.uri.path;
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileUriPath.startsWith(docUriPath)) 
        delete globalMarks[token];
  }
  await saveGlobalMarks();
}

module.exports = {init, waitForInit, dumpGlobalMarks, replaceGlobalMark, 
                  getGlobalMarks, getMarksForFile, saveGlobalMarks,
                  getGlobalMark,  putGlobalMark,   delGlobalMark,
                  newGlobalMark,  delGlobalMarksForFile};



