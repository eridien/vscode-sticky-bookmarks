const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DONT_LOAD_MARKS_ON_START = true;
const DONT_LOAD_MARKS_ON_START = false;

let globalMarks = {};

let context;
// a loc is {File, lineNumber};
// markByLoc holds all global marks
// there can only be one mark per loc
// so loc is unique in mark
let markByLoc      = new Map(); 
// markSetByToken has a value of a weakSet of marks
let markSetByToken = new Map();
let initFinished   = false;

function cleanupWeakMap(weakMap) {
  for (let [loc, markSet] of Array.from(weakMap.entries())) {
    let isEmpty = true;
    for (let obj of loc.references || []) {
      if (markSet.has(obj)) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) { weakMap.delete(loc); }
  }
}
function cleanupMap(markSetByToken) {
  for (let [token, markSet] of markSetByToken.entries()) {
    let isEmpty = true;
    // Check if any tracked references still exist in the markSet
    for (let obj of key.references || []) {
      if (markSet.has(obj)) {
        isEmpty = false;
        break;
      }
    }

    // If the markSet is empty, remove it from the markSetByToken
    if (isEmpty) {
      markSetByToken.delete(key);
    }
  }
}

console.log("After cleanup:", map.has(objKey)); // Might be false after GC
async function addMarkToMarkSetByToken(mark) {
  let markSet = markSetByToken.get(mark.token);
  if(!markSet) {
    markSet = new WeakSet();
    markSetByToken.add(mark.token, markSet);
  }
  markSet.add(mark);
}

// Example Usage
let map = new Map();
let objKey = { references: [] }; // Track references manually
let weakSetValue = new WeakSet();

let trackedObj = { name: "Temporary" };
objKey.references.push(trackedObj);
weakSetValue.add(trackedObj);

map.set(objKey, weakSetValue);

console.log("Before cleanup:", map.has(objKey)); // true

// Simulate garbage collection by removing the last reference
trackedObj = null;

// Cleanup process
cleanupMap(map);



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
function delGlobalMark(token) {delete globalMarks[token]}
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

async function delGlobalMarksForFile(document) {
  const docUriPath = document.uri.path;
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileUriPath.startsWith(docUriPath)) 
        delete globalMarks[token];
  }
  await saveGlobalMarks();
}

module.exports = {init, waitForInit, dumpGlobalMarks, replaceGlobalMark, saveGlobalMarks,
                  getGlobalMarks, getMarksForFile, getMarkForLine, delMarkForLine,
                  getGlobalMark,  putGlobalMark,   delGlobalMark,
                  newMark,  delGlobalMarksForFile};



