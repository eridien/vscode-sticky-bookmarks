const vscode = require('vscode');
const utils  = require('./utils.js');
const {log, start, end} = utils.getLog('mark');

// const LOAD_MARKS_ON_START = true;
const LOAD_MARKS_ON_START = false;

const VERIFY_MARKS_IN_DUMP = true;
// const VERIFY_MARKS_IN_DUMP = false;

let context;
let initFinished = false;

async function init(contextIn) {
  start('init marks');
  context = contextIn;
  await loadMarkStorage();
  initFinished = true;
  await utils.refreshFile();
  await dumpMarks('marks init');
  end('init marks');
}

const fileKeys   = ["uri", "fileUri", "fsPath", "fileFsPath", 
                    "doc", "document", "location", "loc"];
const posKeys    = ["range", "location", "loc", "position", "pos"];
const lineKeys   = posKeys.concat("lineNumber", "linNum", "line");
const lftChrKeys = posKeys.concat("lftChrPos");
const rgtChrKeys = posKeys.concat("rgtChrPos");

class Mark {
  constructor(params) {
    if (typeof params === 'string' && params.startsWith('{') && params.endsWith('}')) {
      const str = params.slice(1, -1).trim();
      const parts = str.split(',').map(s => s.trim());
      const obj = {};
      for (const part of parts) {
        const [k, v] = part.split(':').map(s => s.trim());
        // Remove possible quotes from value
        let val = v;
        if (val && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (k === 'lineNumber' || k === 'lftChrOfs' || k === 'rgtChrOfs' || k === 'gen') {
          obj[k] = Number(val);
        } else {
          obj[k] = val === 'undefined' ? undefined : val;
        }
      }
      params = obj;
    }
    const obj = {};
    if(params.gen === undefined)
      throw new Error('Mark constructor: missing gen');
    obj._gen = params.gen;
    if(params._gen == 2 && params.token === undefined)
      throw new Error('Mark constructor: missing token');
    obj._token = params.token;
    const haveFile = fileKeys.some(
                    key => Object.prototype.hasOwnProperty.call(params, key));
    const haveLine = lineKeys.some(
                    key => Object.prototype.hasOwnProperty.call(params, key));
    const haveLftChr = lftChrKeys.some(
                    key => Object.prototype.hasOwnProperty.call(params, key));
    const haveRgtChr = rgtChrKeys.some(
                    key => Object.prototype.hasOwnProperty.call(params, key)) 
                              || (haveLftChr && (params.token !== undefined));
    if(!haveFile || !haveLine || 
                    (params.gen == 2 ? (!haveLftChr || !haveRgtChr) : false)) {
      throw new Error('Mark constructor: missing params');
    }//Activating extension 'eridien.sticky-bookmarks' failed: Invalid arguments.
    const position  = params.pos ?? params.position ?? params.range?.start ?? 
                      params.location?.range?.start ?? params.loc?.range?.start;
    obj._fileFsPath = params.fsPath ?? params.document?.uri?.fsPath ?? params.doc?.uri?.fsPath ?? 
                      params.fileFsPath ?? params.uri?.fsPath ?? params.fileUri?.fsPath ??
                      params.location?.uri?.fsPath ?? params.loc?.uri?.fsPath;
    obj._lineNumber = params.lineNumber ?? params.linNum ?? params.line ?? position?.line;
    if(obj._gen == 2) {
      obj._lftChrOfs = params.lftChrOfs ?? position?.character;
      obj._rgtChrOfs = params.rgtChrOfs ?? obj._lftChrOfs + (params.token?.length ?? 0);
    }
    else {
      obj._lftChrOfs = 0;
      obj._rgtChrOfs = 0;
    }
    Object.assign(this, obj);
  }
  fileFsPath()     { return this._fileFsPath }
  lineNumber()     { return this._lineNumber }
  lftChrOfs()      { return this._lftChrOfs  }
  rgtChrOfs()      { return this._rgtChrOfs  }
  token()          { return this._token      }
  gen()            { return this._gen        }

  range()          {return this._range ??=
                            new vscode.range(this._lineNumber, this._lftChrOfs,
                                             this._lineNumber, this._rgtChrOfs) }
  fileUri()        { return this._fileUri ??= 
                         vscode.Uri.file(this._fileFsPath) };
  fileFsPath()     { return this._fileFsPath  ??= this.fileUri().fsPath }
  fileUriPath()    { return this._fileUriPath ??= this.fileUri().path }

  wsFolder()       { return this._wsFolder ??= 
                        vscode.workspace.getWorkspaceFolder(this.fileUri()) }
  folderIdx()      { return this._folderIdx ??=  this.wsFolder().index  }
  folderUri()      { return this._folderUri ??= 
                                vscode.Uri.file(this.wsFolder().uri)   }
  folderFsPath()   { return this._folderFsPath ??= 
                              vscode.Uri.file(this.folderUri().fsPath) }
  folderUriPath()  { return this._folderUriPath ??= 
                               vscode.Uri.file(this.folderUri().path)  }
  folderName()     { return this._folderName ??= this.wsFolder().name; }

  fileRelUriPath() { return this._fileRelUriPath ??= 
                      this.fileUriPath().slice(this.folderUriPath().length+1) }
  languageId()     { return this._languageId ??=
                             vscode.workspace.getLanguageMode(this.fileUri()) }
  locStr()         { return  this._locStr ??= 
                             getLocStr(this._fileFsPath, this._lineNumber, 
                                       this._lftChrOfs,  this._rgtChrOfs ) }
  locStrLc()       { return this._locStrLc ??= this.locStr().toLowerCase() }

  toString() {
    return `{ fileFsPath: ${this._fileFsPath}, lineNumber: ${this._lineNumber}, lftChrOfs: ${this._lftChrOfs}, rgtChrOfs: ${this._rgtChrOfs}, token: ${this._token}, gen: ${this._gen} }`;
  }
}

function getLocStr(fileFsPath, lineNumber, lftChrOfs, rgtChrOfs) {
  return fileFsPath + '\x00' + lineNumber.toString().padStart(6, '0') + 
                      '\x00' + lftChrOfs .toString().padStart(6, '0') + 
                      '\x00' + rgtChrOfs .toString().padStart(6, '0');
}

async function getDocument(mark) { 
  return await vscode.workspace.openTextDocument(mark.fileUri());
}

let marksByLocStr       = new Map(); 
let markSetByToken      = new Map();
let markSetByFileFsPath = new Map();

async function addMarkToStorage(mark, save = true) {
  marksByLocStr.set(mark.locStr(), mark);
  let tokenMarkSet = markSetByToken.get(mark.token());
  if (!tokenMarkSet) {
    tokenMarkSet = new Set();
    markSetByToken.set(mark.token(), tokenMarkSet);
  }
  tokenMarkSet.add(mark);
  let fileMarkSet = markSetByFileFsPath.get(mark.fileFsPath());
  if (!fileMarkSet) {
    fileMarkSet = new Set();
    markSetByFileFsPath.set(mark.fileFsPath(), fileMarkSet);
  }
  fileMarkSet.add(mark);
  if(save) await saveMarkStorage();
}

async function loadMarkStorage() {
  if(!LOAD_MARKS_ON_START) {
    await saveMarkStorage();
    return;
  }
  const marks = context.workspaceState.get('marks', []);
  for (const mark of marks) {
    const mark = new Mark(mark);
    await addMarkToStorage(mark, false);
  }
}

async function saveMarkStorage() {
  const markStrings =  [...marksByLocStr.values()]
                          .map(mark => mark.toString());
  await context.workspaceState.update('marks', markStrings);
}

async function getMarkByTokenRange(document, range) {
  const fileFsPath = document.uri.fsPath;
  const lineNumber = range.start.line;
  const lftChrOfs  = range.start.character;
  const rgtChrOfs  = range.end.character;
  const markSet = markSetByFileFsPath.get(fileFsPath);
  if (!markSet) return null;
  for (const mark of markSet) {
    if (mark.lineNumber() !== lineNumber) continue;
    if (mark.lftChrOfs()  !== lftChrOfs)  continue;
    if (mark.rgtChrOfs()  !== rgtChrOfs)  continue;
    return mark;
  }
  return null;
}

function getMarksInFile(fileFsPath) {
  const fileMarkSet = markSetByFileFsPath.get(fileFsPath);
  if (fileMarkSet) return Array.from(fileMarkSet);
  return [];  
}

function getAllMarks() { 
  return [...marksByLocStr.values()]; 
}

function deleteMarkFromFileSet(mark) {
  let fileMarkSet = markSetByFileFsPath.get(mark.fileFsPath());
  if (fileMarkSet) {
    fileMarkSet.delete(mark);
    if(fileMarkSet.size === 0) markSetByFileFsPath.delete(mark.fileFsPath());
  }
}

function deleteMarkFromTokenSet(mark) {
  if(mark.gen() === 1) return;
  let tokenMarkSet = markSetByToken.get(mark.token());
  if (tokenMarkSet) {
    tokenMarkSet.delete(mark);
    if (tokenMarkSet.size === 0) markSetByToken.delete(mark.token());
  }
}

async function deleteMark(mark, save = true, update = true) {
  marksByLocStr.delete(mark.locStr());
  await deleteMarkFromFileSet(mark);  
  await deleteMarkFromTokenSet(mark);  
  await utils.deleteTokenFromLine(mark);
  if(save) await saveMarkStorage();
  if(update) utils.updateSide(); 
  // dumpMarks('deleteMark');
}

async function deleteAllMarksFromFile(document, update = true) {
  const fileMarks = getMarksInFile(document.uri.fsPath);
  if(fileMarks.length === 0) return;
  log('deleteAllMarksFromFile', utils.getFileRelUriPath(document));
  for (const mark of fileMarks) await deleteMark(mark, false, false);
  await saveMarkStorage();
  if(update) utils.updateSide();
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

function getMarksFromLine(document, lineNumber, sort = false) {
  const fileMarks = getMarksInFile(document.uri.fsPath);
  if(fileMarks.length === 0) return [];
  const lineMarks = fileMarks.filter(mark => mark.lineNumber() === lineNumber);
  if (sort) {
    lineMarks.sort((a, b) => {
      if (a.locStrLc() > b.locStrLc()) return +1;
      if (a.locStrLc() < b.locStrLc()) return -1;
      return 0;
    });
  }
  return lineMarks;
}

function verifyMark(mark) {
  if(!mark) return false;
  const document   = mark.document();
  const lineNumber = mark.lineNumber();
  const numLines   = document.lineCount;
  if(lineNumber < 0 || lineNumber >= numLines) {
    log('err', 'verifyMark, line number out of range',
                mark.fileRelUriPath(), lineNumber);
    return false;
  }
  if(mark.gen() === 1) return true;
  if(document.getText(mark.range()) != mark.token()) {
    log('err', 'verifyMark, token missing from line',
                mark.fileRelUriPath(), lineNumber);
    return false; 
  }
  return true;
}

function dumpMarks(caller, list, dump) {
  caller = caller + ' marks: ';
  let marks = Array.from(marksByLocStr.values());
  if(marks.length === 0) {
    log(caller, '<no marks>');
    return;
  }
  if(dump) log(caller, 'all marks', marks);
  else if(list) {
    marks.sort((a, b) => ( 
      a.locStrLc() > b.locStrLc() ? +1 :
      a.locStrLc() < b.locStrLc() ? -1 : 0));
    let str = "\n";
    for(const mark of marks) {
      if(VERIFY_MARKS_IN_DUMP) verifyMark(mark);
      str += `${utils.tokenToStr(mark.token())} -> ${mark.fileRelUriPath()} ` +
             `${mark.lineNumber().toString().padStart(3, ' ')} `+
             `${mark.languageId()}\n`;
    }
    log(caller, str.slice(0,-1));
  }
  else {
    let str = "";
    for(const mark of marks) {
      if(VERIFY_MARKS_IN_DUMP) verifyMark(mark);
      str += mark.lineNumber().toString().padStart(3, ' ') + 
             utils.tokenToStr(mark.token()) +  ' ';
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

async function addGen2MarkToLine(document, lineNumber, token, save = true) {
  token ??= getToken(document);
  let lineText = document.lineAt(lineNumber).text;
  const mark   = new Mark({gen:2, document, lineNumber, token,
                                lftChrOfs: lineText.length,
                                rgtChrOfs: lineText.length + token.length});
  await utils.replaceLine(document, lineNumber, lineText + token);
  await addMarkToStorage(mark);
  if(save) await saveMarkStorage();
}

async function addGen2MarkForToken(document, position, token, save = true) {
  const mark = new Mark({gen:2, document, position, token});
  await addMarkToStorage(mark);
  if(save) await saveMarkStorage();
}

module.exports = {init, Mark, waitForInit, dumpMarks, getAllMarks, verifyMark,
                  getMarksFromLine, getMarksInFile, deleteAllMarksFromFile,
                  deleteMark, saveMarkStorage, addMarkToStorage, 
                  getToken, addGen2MarkToLine, addGen2MarkForToken };



