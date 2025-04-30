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
let markSetByToken  = new Map();
let markSetByFsPath = new Map();

async function addMarkToStorage(mark, save = true) {
  markByLoc.set(mark.loc, mark);
  let tokenMarkSet = markSetByToken.get(mark.token);
  if (!tokenMarkSet) {
    tokenMarkSet = new Set();
    markSetByToken.set(mark.token, tokenMarkSet);
  }
  tokenMarkSet.add(mark);
  let fileMarkSet = markSetByFsPath.get(mark.fsPath);
  if (!fileMarkSet) {
    fileMarkSet = new Set();
    markSetByFsPath.set(mark.document.uri.fsPath, fileMarkSet);
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

async function deleteMark(mark, save = true, update = true) {
  markByLoc.delete(mark.loc);
  await deleteMarkFromFileSet(mark);  
  await deleteMarkFromTokenSet(mark);  
  const [fsPath, lineNumber] = mark.loc.split('\x00');
  utils.deleteMarkFromText(fsPath, +lineNumber);
  if(save)   await saveMarkStorage();
  if(update) utils.updateSide(); 
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
  await loadMarkStorage();
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
  const loc = document.uri.fsPath + '\x00' + 
              lineNumber.toString().padStart(6, '0');
  return markByLoc.get(loc);
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
  let marks = Array.from(markByLoc.values());
  if(marks.length === 0) {
    log(caller, '<no marks>');
    return;
  }
  if(dump) log(caller, 'all marks', marks);
  else if(list) {
    marks.sort((a, b) => ( 
      a[1].fileRelUriPath.localeCompare(b[1].fileRelUriPath) ||
      a[1].lineNumber - b[1].lineNumber));
    let str = "\n";
    for(let [token, mark] of marks) {
      str += `${utils.tokenToStr(token)} -> ${mark.fileRelUriPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(const mark of marks) {
      str += utils.tokenToStr(mark.token) + ' ';
    }
    log(caller, str);
  }
}

async function newMark(document, lineNumber, gen, token) {
  token ??= utils.getUniqueToken(document);
  const mark = {document, lineNumber, gen, token};
  mark.loc = document.uri.fsPath + '\x00' + 
             lineNumber.toString().padStart(6, '0');
  mark.fileRelUriPath = await utils.getfileRelUriPath(document);
  await addMarkToStorage(mark);
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



