const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DONT_LOAD_MARKS_ON_START = true;
const DONT_LOAD_MARKS_ON_START = false;

const VERIFY_MARKS_IN_DUMP = true;
// const VERIFY_MARKS_IN_DUMP = false;

let globalMarks = {};

let context;
let initFinished = false;

// marksByLoc holds all global marks
let marksByLoc      = new Map(); 
let markSetByToken  = new Map();
let markSetByFsPath = new Map();

async function deleteAllMarks() {
  marksByLoc     .clear();
  markSetByToken .clear();
  markSetByFsPath.clear();
  await saveMarkStorage();
}

async function deleteAllMarksFromFile(document) {
  const fileMarks = getMarksForFile(document.uri.fsPath);
  for (const mark of fileMarks)
    await deleteMark(mark, false, false);
  await saveMarkStorage();
  utils.updateSide(); 
}

async function addMarkToStorage(mark, save = true) {
  marksByLoc.set(mark.loc, mark);
  let tokenMarkSet = markSetByToken.get(mark.token);
  if (!tokenMarkSet) {
    tokenMarkSet = new Set();
    markSetByToken.set(mark.token, tokenMarkSet);
  }
  tokenMarkSet.add(mark);
  let fileMarkSet = markSetByFsPath.get(mark.fileFsPath);
  if (!fileMarkSet) {
    fileMarkSet = new Set();
    markSetByFsPath.set(mark.document.uri.fsPath, fileMarkSet);
  }
  fileMarkSet.add(mark);
  if(save) await saveMarkStorage();
}

async function loadMarkStorage() {
  if(DONT_LOAD_MARKS_ON_START) {
    await saveMarkStorage()
    return;
  }
  const marks = context.workspaceState.get('marks', []);
  for (const mark of marks) {
    const uri     = vscode.Uri.file(mark.document.uri.fsPath);
    mark.document = await vscode.workspace.openTextDocument(uri);
    await addMarkToStorage(mark, false);
  }
} 

async function saveMarkStorage() {
  // log('saveMarkStorage', [...marksByLoc.values()]);
  await context.workspaceState.update('marks', [...marksByLoc.values()]);
}

function getMarksForFile(fileFsPath) {
  const fileMarkSet = markSetByFsPath.get(fileFsPath);
  if (fileMarkSet) return Array.from(fileMarkSet);
  return [];  
}

function getAllMarks() { 
  return [...marksByLoc.values()]; 
}

function deleteMarkFromFileSet(mark) {
  let fileMarkSet = markSetByFsPath.get(mark.fileFsPath);
  if (fileMarkSet) {
    fileMarkSet.delete(mark);
    if (fileMarkSet.size === 0) markSetByFsPath.delete(mark.fileFsPath);
  }
}

function deleteMarkFromTokenSet(mark) {
  if(mark.gen === 1) return;
  let tokenMarkSet = markSetByToken.get(mark.token);
  if (tokenMarkSet) {
    tokenMarkSet.delete(mark);
    if (tokenMarkSet.size === 0) markSetByToken.delete(mark.token);
  }
}

async function removeTokenFromMark(mark, save = true) {  
  deleteMarkFromTokenSet(mark);
  delete mark.token;
  if (save) await saveMarkStorage();
}

async function deleteMark(mark, save = true, update = true) {
  marksByLoc.delete(mark.loc);
  await deleteMarkFromFileSet(mark);  
  await deleteMarkFromTokenSet(mark);  
  const [fileFsPath, lineNumber] = mark.loc.split('\x00');
  await utils.deleteMarkFromText(fileFsPath, +lineNumber);
  if(save)   await saveMarkStorage();
  if(update) utils.updateSide(); 
  dumpMarks('deleteMark');
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
  await utils.refreshFile();
  await dumpMarks('marks init');
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

function getMarkForLine(document, lineNumber) {
  const loc = document.uri.fsPath + '\x00' + 
              lineNumber.toString().padStart(6, '0');
  return marksByLoc.get(loc);
}

function delMarkForLine(document, lineNumber) {
  const mark = getMarkForLine(document, lineNumber);
  if(mark) delete globalMarks[mark.token];
}

function getMarkTokenRange(mark) {
  const document   = mark.document;
  const lineNumber = mark.lineNumber;
  const line       = document.lineAt(lineNumber).text;
  const tokenOfs   = line.indexOf(mark.token);
  if (tokenOfs === -1) {
    log('err', 'getMarkTokenRange, token missing in line', 
                     mark.fileRelUriPath, lineNumber, mark.token);
    return null;
  }
  return new vscode.Range(lineNumber, tokenOfs, 
                          lineNumber, tokenOfs + mark.token.length);
}

function verifyMark(mark) {
  if(!mark) return false;
  const document   = mark.document;
  const lineNumber = mark.lineNumber;
  if(getMarkForLine(document, lineNumber) === undefined) {
    log('err', 'verifyMark, mark missing', mark.fileRelUriPath, lineNumber);
    return false;
  }
  if(mark.gen === 1) return true;
  let line;
  try { line = document.lineAt(lineNumber).text }
  catch (_) {
    log('err', 'verifyMark, document.lineAt() err:', 
                mark.fileRelUriPath, lineNumber);
    return false;
  }
  const idx = line.indexOf(mark.token);
  if(idx === -1) {
    log('verifyMark, token missing', mark.fileRelUriPath, lineNumber);
    return false;
  }
  return true;
}

async function saveGlobalMarks() {
  await context.workspaceState.update('globalMarks', globalMarks);
  utils.updateSide();
  dumpMarks('saveGlobalMarks');
}

function dumpMarks(caller, list, dump) {
  caller = caller + ' marks: ';
  let marks = Array.from(marksByLoc.values());
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
      if(VERIFY_MARKS_IN_DUMP) verifyMark(mark);
      str += `${utils.tokenToStr(token)} -> ${mark.fileRelUriPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(const mark of marks) {
      if(VERIFY_MARKS_IN_DUMP) verifyMark(mark);
      str += mark.lineNumber.toString().padStart(3, ' ') + 
             utils.tokenToStr(mark.token) +  ' ';
    }
    log(caller, str);
  }
}

let uniqueTokenNum = 0;

function getToken(document, zero = true) {
  const [commLft, commRgt] = utils.commentsByLang(document.languageId);
  return commLft + utils.numberToInvBase4(zero ? 0 : ++uniqueTokenNum) + '.'
       + commRgt;
}

async function newMark(document, lineNumber, gen, token, zero = true, save = true) {
  const mark         = {document, lineNumber, gen};
  if(gen == 2) {
    token ??= getToken(document, zero);
    mark.token = token;
  }
  mark.loc = document.uri.fsPath + '\x00' + 
             lineNumber.toString().padStart(6, '0');
  const wsFolder      = vscode.workspace.getWorkspaceFolder(document.uri);
  mark.folderIndex    = wsFolder.index;
  mark.folderUriPath  = wsFolder?.uri.path;
  mark.folderFsPath   = wsFolder?.uri.fsPath;
  mark.fileFsPath     = document.uri.fsPath;
  mark.fileRelUriPath = await utils.getfileRelUriPath(document);
  await addMarkToStorage(mark, save);
  return mark;
}


module.exports = {init, waitForInit, dumpMarks, getAllMarks, verifyMark,
                  getMarkForLine, getMarksForFile, saveGlobalMarks,
                  delMarkForLine, deleteMark, deleteAllMarks,
                  getGlobalMark,  putGlobalMark, saveMarkStorage,
                  newMark, removeTokenFromMark, getMarkTokenRange,
                  deleteAllMarksFromFile};



