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
    Object.assign(this, params);
    const haveFile = fileKeys.some(
                     key => Object.prototype.hasOwnProperty.call(params, key));
    const haveLine = lineKeys.some(
                     key => Object.prototype.hasOwnProperty.call(params, key));
    const haveLftChr = lftChrKeys.some(
                     key => Object.prototype.hasOwnProperty.call(params, key));
    const haveRgtChr = rgtChrKeys.some(
                     key => Object.prototype.hasOwnProperty.call(params, key)) ||
                           (haveLftChr && (params.token !== undefined));
    if(!haveFile || !haveLine || !haveLftChr || !haveRgtChr || params.token === undefined) {
      throw new Error('Mark constructor: missing params');
    }
    const position  = params.pos ?? params.position ?? params.range?.start ?? 
                      params.location?.range?.start ?? params.loc?.range?.start;
    this.fileFsPath = params.fsPath ?? params.document?.uri?.fsPath ?? params.doc?.uri?.fsPath ?? 
                      params.fileFsPath ?? params.uri?.fsPath ?? params.fileUri?.fsPath ??
                      params.location?.uri?.fsPath ?? params.loc?.uri?.fsPath;
    this.lineNumber = params.lineNumber ?? params.linNum ?? params.line ?? position?.line;
    this.lftChrOfs  = params.lftChrOfs ?? position?.character;
    this.rgtChrOfs  = params.rgtChrOfs ?? this.lftChrPos + (params.token.length);
    this.token      = params.token;
  }
  fileFsPath()     { return this.fileFsPath }
  lineNumber()     { return this.lineNumber }
  lftChrOfs()      { return this.lftChrOfs  }
  rgtChrOfs()      { return this.rgtChrOfs  }
  token()          { return this.token      }

  fileUri()        { return this.fileUri ??= 
                         vscode.Uri.file(this.fileFsPath) };
  fileFsPath()     { return this.fileFsPath  ??= this.fileUri().fsPath }
  fileUriPath()    { return this.fileUriPath ??= this.fileUri().path }

  wsFolder()       { return this.wsFolder ??= 
                          vscode.workspace.getWorkspaceFolder(this.fileUri()) }
  folderIdx()      { return this.folderIdx ??= this.wsFolder().index; }
  folderUri()      { return this.folderUri ??= 
                          vscode.Uri.file(this.wsFolder().uri) }
  folderFsPath()   { return this.folderFsPath ??= 
                         vscode.Uri.file(this.folderUri().fsPath) }
  folderUriPath()  { return this.folderUriPath ??= 
                         vscode.Uri.file(this.folderUri().path) }

  fileRelUriPath() { return this.fileRelUriPath ??= 
                      this.fileUriPath().slice(this.folderUriPath().length+1) }

  locStr()         { return this.locStr ??= this.fileFsPath() + 
                      '\x00' + this.lineNumber.padStart(6, '0') + 
                      '\x00' + this.lftChrOfs .padStart(6, '0') + 
                      '\x00' + this.rgtChrOfs .padStart(6, '0')};
  locStrLc()       { return this.locStrLc ??= this.locStr().toLowerCase() }
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
    await saveMarkStorage()
    return;
  }
  const marks = context.workspaceState.get('marks', []);
  for (const mark of marks) {
    mark.document = await vscode.workspace.openTextDocument(mark.uri());
    await addMarkToStorage(mark, false);
  }
} 

async function saveMarkStorage() {
  await context.workspaceState.update('marks', [...marksByLocStr.values()]);
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
    if (fileMarkSet.size === 0) markSetByFileFsPath.delete(mark.fileFsPath());
  }
}

function deleteMarkFromTokenSet(mark) {
  if(mark.gen === 1) return;
  let tokenMarkSet = markSetByToken.get(mark.token());
  if (tokenMarkSet) {
    tokenMarkSet.delete(mark);
    if (tokenMarkSet.size === 0) markSetByToken.delete(mark.token());
  }
}

const locStrToLocation = (locStr) => {
  const [fileFsPath, lineNumber, leftCharPos, rightCharPos] = locStr.split('\x00');
  const range = new vscode.Range(+lineNumber, +leftCharPos, +lineNumber, +rightCharPos);
  return new vscode.Location(vscode.Uri.file(fileFsPath), range);
}

const locationToLocStr = (location) => {
  const {uri, range:{start:{line:begLine, character:begChar}, 
                       end:{line:endLine, character:endChar}}} = location;
  return `${uri.fsPath}\x00${begLine.padStart(6, '0')}\x00${begChar}\x00${endChar}`;
}

async function deleteMark(mark, save = true, update = true) {
  marksByLocStr.delete(mark.locStr());
  await deleteMarkFromFileSet(mark);  
  await deleteMarkFromTokenSet(mark);  
  const [fileFsPath, lineNumber, charPos] = mark.locStr().split('\x00');
  await utils.deleteOneTokenFromLine(fileFsPath, +lineNumber, charPos, mark.token());
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

function getMarkForLine(document, lineNumber) {
  const location = document.uri.fsPath + '\x00' + 
              lineNumber.toString().padStart(6, '0');
  return marksByLocStr.get(location);
}

function getMarkTokenRange(mark) {
  const document   = mark.document();
  const lineNumber = mark.lineNumber();
  const line       = document.lineAt(lineNumber).text;
  const tokenOfs   = line.indexOf(mark.token());
  if (tokenOfs === -1) {
    log('err', 'getMarkTokenRange, token missing in line', 
                     mark.fileRelUriPath(), lineNumber, mark.token());
    return null;
  }
  // don't include the first and last chars
  return new vscode.Range(lineNumber, tokenOfs+1, 
                          lineNumber, tokenOfs + mark.token().length-1);
}

function verifyMark(mark) {
  if(!mark) return false;
  const document   = mark.document();
  const lineNumber = mark.lineNumber();
  if(getMarkForLine(document, lineNumber) === undefined) {
    log('err', 'verifyMark, mark missing from storage', 
                mark.fileRelUriPath(), lineNumber);
    return false;
  }
  let line;
  try { line = document.lineAt(lineNumber).text }
  catch (_) {
    log('err', 
       'verifyMark, linenumber is out of range or document is not valid',
        mark.fileRelUriPath(), lineNumber);
    return false;
  }
  if(mark.gen === 1) return true;
  const idx = line.indexOf(mark.token());
  if(idx === -1) {
    log('verifyMark, token missing from line', mark.fileRelUriPath(), lineNumber);
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
      a[1].fileRelUriPath.localeCompare(b[1].fileRelUriPath) ||
      a[1].lineNumber - b[1].lineNumber));
    let str = "\n";
    for(let [token, mark] of marks) {
      if(VERIFY_MARKS_IN_DUMP) verifyMark(mark);
      str += `${utils.tokenToStr(token)} -> ${mark.fileRelUriPath()} ` +
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

async function newMark(document, lineNumber, gen, token, 
                                             zero = true, save = true) {
  const mark = new Mark({fileFsPath: document.uri.fsPath, lineNumber, gen});
  if(gen == 2) {
    token ??= getToken(document, zero);
    mark.token = token;
  }
  const wsFolder      = vscode.workspace.getWorkspaceFolder(document.uri);
  mark.folderIndex    = wsFolder.index;
  mark.folderUriPath  = wsFolder?.uri.path;
  mark.folderFsPath   = wsFolder?.uri.fsPath;
  mark.fileFsPath     = document.uri.fsPath;
  mark.fileRelUriPath = await utils.getFileRelUriPath(document);
  await addMarkToStorage(mark, save);
  return mark;
}

module.exports = {init, waitForInit, dumpMarks, getAllMarks, verifyMark,
                  getMarkForLine, getMarksInFile,deleteAllMarksFromFile,
                  deleteMark, saveMarkStorage, newMark, getMarkTokenRange,
                  };



