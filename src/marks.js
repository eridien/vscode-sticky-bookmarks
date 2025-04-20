const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

const DEBUG_REMOVE_MARKS_ON_START = true;
// const DEBUG_REMOVE_MARKS_ON_START = false;

let globalMarks;
let context, updateSidebar, addMarksForTokens;
let initFinished = false;

async function init(contextIn, updateSidebarIn, addMarksForTokensIn) {
  start('init marks');
  context           = contextIn;
  updateSidebar     = updateSidebarIn;
  addMarksForTokens = addMarksForTokensIn;
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
  for(const folder of workspaceFolders)
    await utils.runOnAllFilesInFolder(addMarksForTokens, folder.uri.fsPath);
  for(const [token, mark] of Object.entries(globalMarks)) {
    const markUri    = vscode.Uri.file(mark.fileFsPath)
    const folder     = vscode.workspace.getWorkspaceFolder(markUri);
    const document   = await vscode.workspace.openTextDocument(markUri);
    const fileFsPath = mark.fileFsPath;
    if(!folder || !document || 
                  !await utils.fileExists(fileFsPath)) {
      log(`folder ${mark.folderName}, document, `+
          `or file ${mark.fileName} missing, removing ${token}`);
      delete globalMarks[token];
      continue;
    }
    mark.document = document;
    mark.inWorkspace = true;
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  initFinished = true;
  dumpGlobalMarks('init');
  end('init marks');
  return {};
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

function getGlobalMarks() { return globalMarks; }

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
      token = token.replace(/:/g, '').replace(/;/g, '');
      str += `${token} -> ${mark.fileRelUriPath} ` +
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
  const hashDigit = () => 
           Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  
    randHash = ''; 
    for(let i = 0; i < 4; i++) randHash += hashDigit()
  }
  while(randHash in globalMarks);
  return `:${randHash};`;
}

async function newMark(document, lineNumber, token) {                         //:bd5z;
  token ??= getRandomToken();
  const mark  = {token, document, lineNumber,
                 languageId: document.languageId};
  const filePaths = utils.getPathsFromFileDoc(document); 
  if(!filePaths?.inWorkspace) return null;
  Object.assign(mark, filePaths);
  globalMarks[token] = mark;
  await context.workspaceState.update('globalMarks', globalMarks);
  updateSidebar();
  dumpGlobalMarks('newMark');
  return mark;
}

async function addGlobalMarkIfMissing(token, document, lineNumber) {
  if(globalMarks[token]) return;
  await newMark(document, lineNumber, token);
}

//:ho3j;
async function delGlobalMark(token) {
  delete globalMarks[token];
  await context.workspaceState.update('globalMarks', globalMarks);
  updateSidebar();
  dumpGlobalMarks('delGlobalMark');
}

async function replaceGlobalMark(oldToken, newToken) {
  globalMarks[newToken] = globalMarks[oldToken];
  delete globalMarks[oldToken];
  globalMarks[newToken].token = newToken;
  updateSidebar();
  dumpGlobalMarks('replaceGlobalMark');
}

async function delGlobalMarksForFile(document) {
  const docUriPath = document.uri.path;
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileRelUriPath.startsWith(docUriPath)) 
        delete globalMarks[token];
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  updateSidebar();
}

module.exports = {init, waitForInit, getGlobalMarks, dumpGlobalMarks,
                  newMark, delGlobalMark, replaceGlobalMark,
                  delGlobalMarksForFile, addGlobalMarkIfMissing}



