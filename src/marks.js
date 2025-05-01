const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const DONT_LOAD_MARKS_ON_START = true;
const DONT_LOAD_MARKS_ON_START = false;

let globalMarks = {};

let context;
let initFinished = false;

// marksByLoc holds all global marks
let marksByLoc      = new Map(); 
let markSetByToken  = new Map();
let markSetByFsPath = new Map();

async function addMarkToStorage(mark, save = true) {
  marksByLoc.set(mark.loc, mark);
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
  await context.workspaceState.update('marks', [...marksByLoc.values()]);
}

function getMarksForFile(fileFsPath) {
  const fileMarkSet = markSetByFsPath.get(fileFsPath);
  if (fileMarkSet) {
    return Array.from(fileMarkSet);
  }
  return [];  
}

function deleteMarkFromFileSet(mark) {
  let fileMarkSet = markSetByFsPath.get(mark.fsPath);
  if (fileMarkSet) {
    fileMarkSet.delete(mark);
    if (fileMarkSet.size === 0) markSetByFsPath.delete(mark.fsPath);
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
  utils.deleteMarkFromText(fileFsPath, +lineNumber);
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
function getGlobalMarks()     {return globalMarks}

function getMarkForLine(document, lineNumber) {
  const fileFsPath = document.uri.fsPath;
  const loc = document.uri.fsPath + '\x00' + 
              lineNumber.toString().padStart(6, '0');
  return marksByLoc.get(loc);
}

function delMarkForLine(document, lineNumber) {
  const mark = getMarkForLine(document, lineNumber);
  if(mark) delete globalMarks[mark.token];
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
      str += `${utils.tokenToStr(token)} -> ${mark.fileRelUriPath} ` +
             `${mark.lineNumber.toString().padStart(3, ' ')} `+
             `${mark.languageId}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(const mark of marks) {
      str += mark.lineNumber.toString().padStart(3, ' ') + ' ' +
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

async function newMark(document, lineNumber, gen, token, save = true) {
  token ??= getToken(document);
  const mark = {document, lineNumber, gen, token};
  mark.loc = document.uri.fsPath + '\x00' + 
             lineNumber.toString().padStart(6, '0');
  mark.fsPath         = document.uri.fsPath;
  mark.fileRelUriPath = await utils.getfileRelUriPath(document);
  await addMarkToStorage(mark, save);
  return mark;
}


module.exports = {init, waitForInit, dumpMarks, 
                  getMarksForFile, saveGlobalMarks, saveMarkStorage,
                  getGlobalMarks, getMarkForLine, delMarkForLine,
                  getGlobalMark,  putGlobalMark, deleteMark,
                  newMark, removeTokenFromMark};



