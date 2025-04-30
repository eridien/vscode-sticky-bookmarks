const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DONT_LOAD_MARKS_ON_START = true;
const DONT_LOAD_MARKS_ON_START = false;

let globalMarks = {};

let context;
let initFinished = false;

// markByLoc holds all global marks
let markByLoc       = new Map(); 
// these have a value of a set of marks for entry
let markSetByToken  = new Map();
let markSetByFsPath = new Map();

async function addMarkToStorage(mark, save = true) {
  markByLoc.add(mark.loc, mark);
  let tokenMarkSet = markSetByToken.get(mark.token);
  if (!tokenMarkSet) {
    tokenMarkSet = new Set();
    markSetByToken.set(mark.token, tokenMarkSet);
  }
  tokenMarkSet.add(mark);
  let fileMarkSet = markSetByFsPath.get(mark.fsPath);
  if (!fileMarkSet) {
    fileMarkSet = new Set();
    markSetByFsPath.set(mark.fsPath, fileMarkSet);
  }
  fileMarkSet.add(mark);
  if(save) await saveMarkStorage();
}

async function loadMarkStorage() {
  if(DONT_LOAD_MARKS_ON_START) return;
  const marks = context.workspaceState.get('marks', []);
  for (const mark of marks) {
    const uri     = vscode.Uri.file(mark.fileFsPath);
    mark.document = await vscode.workspace.openTextDocument(uri);
    await addMarkToStorage(mark, false);
  }
} 

async function saveMarkStorage() {
  await context.workspaceState.update('marks', Object.values(markByLoc));
}

async function deleteMarkFromFileSet(mark) {
  let fileMarkSet = markSetByFsPath.get(mark.fsPath);
  if (fileMarkSet) {
    fileMarkSet.delete(mark);
    if (fileMarkSet.size === 0) markSetByFsPath.delete(mark.fsPath);
  }
}

async function deleteMarkFromTokenSet(mark) {
  if(mark.gen === 1) return;
  let tokenMarkSet = markSetByToken.get(mark.token);
  if (tokenMarkSet) {
    tokenMarkSet.delete(mark);
    if (tokenMarkSet.size === 0) markSetByToken.delete(mark.token);
  }
}

async function deleteMark(mark, save = true) {
  markByLoc.delete(mark.loc);
  await deleteMarkFromFileSet(mark);  
  await deleteMarkFromTokenSet(mark);  
  const [fsPath, lineNumber] = mark.loc.split('\x00');
  utils.deleteMarkFromText(fsPath, +lineNumber);
  if(save) await saveMarkStorage();
}

async function deleteMarksFromFile(fsPath) {
  const markSet = markSetByFsPath.get(fsPath);
  if (markSet) {
    for (const mark of markSet) await deleteMark(mark, false);
  }
  await saveMarkStorage();
}

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
  utils.updateSide(); 
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
function getGlobalMark(token) {return globalMarks[token]}
function getGlobalMarks()     {return globalMarks}

function getMarkForLine(document, lineNumber) {
  const fileFsPath = document.uri.fsPath;
  return Object.values(globalMarks).
            find(mark => mark.fileFsPath === fileFsPath &&
                         mark.lineNumber === lineNumber);
}

function delMarkForLine(document, lineNumber) {
  const mark = getMarkForLine(document, lineNumber);
  if(mark) delete globalMarks[mark.token];
}

function getMarksForFile(fileFsPath) {
  return Object.values(globalMarks).filter(
                mark => mark.fileFsPath === fileFsPath);
}

async function saveGlobalMarks() {
  await context.workspaceState.update('globalMarks', globalMarks);
  utils.updateSide();
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
      str += `${utils.tokenToStr(token)} -> ${mark.fileRelUriPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(let token of Object.keys(globalMarks)) {
      token = utils.tokenToStr(token);
      str += token + ' ';
    }
    log(caller, str);
  }
}

async function newMark(document, lineNumber, gen, token) {
  const filePaths = utils.getPathsFromDoc(document); 
  if(!filePaths?.inWorkspace) return null;
  token ??= utils.getUniqueToken(document);
  const mark = {token, document, lineNumber, gen,
                languageId: document.languageId};
  Object.assign(mark, filePaths);
  mark.loc = document.uri.fsPath + '\x00' + 
             lineNumber.toString().padStart(6, '0');
  globalMarks[token] = mark;
  return mark;
}

async function replaceGlobalMark(oldToken, newToken) {
  globalMarks[newToken] = globalMarks[oldToken];
  delete globalMarks[oldToken];
  globalMarks[newToken].token = newToken;
  utils.updateSide();
  dumpGlobalMarks('replaceGlobalMark');
}

async function deleteMarksForFile(document) {
  const docUriPath = document.uri.path;
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileUriPath.startsWith(docUriPath)) 
        delete globalMarks[token];
  }
  await saveGlobalMarks();
}

module.exports = {init, waitForInit, dumpGlobalMarks, replaceGlobalMark, saveGlobalMarks,
                  getGlobalMarks, getMarksForFile, getMarkForLine, delMarkForLine,
                  getGlobalMark,  putGlobalMark,   deleteMark,
                  newMark,  deleteMarksForFile};



