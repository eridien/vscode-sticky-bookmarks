const vscode = require('vscode');
const labels = require('./labels.js');
const utils  = require('./utils.js');
const log    = utils.getLog('MARK');

let context, globalMarks;

function init(contextIn) { 
  context = contextIn;

  context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  log('marks initialized'); 
}

function dumpGlobalMarks() {
  log('globalMarks', Object.keys(globalMarks));
}

function getRandomToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}

async function addGlobalMark(
                document, fileRelPath, line, lineNumber, languageId) {
  const folderPath = vscode.workspace
                           .getWorkspaceFolder(document.uri).uri.path;
  const label = await labels.getLabel(document, languageId, line);
  const token = getRandomToken();
  globalMarks[token] = {
                folderPath, fileRelPath, lineNumber, languageId, label};
  context.workspaceState.update('globalMarks', globalMarks);
  return token;
}

function delGlobalMark(token) {
  delete globalMarks[token];
  context.workspaceState.update('globalMarks', globalMarks);
  return '';
}

function delGlobalMarksForFile(relPath) {
  for(const [token, val] of Object.entries(globalMarks)) {
    if(val.fileRelPath === relPath) delete globalMarks[token];
  }
  context.workspaceState.update('globalMarks', globalMarks);
  log('delGlobalMarksForFile:', relPath);
}

function getMarksTree() {
  const marksArray = Object.values(globalMarks);
  marksArray.sort((a, b) => {
    if(a.folderPath .toLowerCase() > 
       b.folderPath .toLowerCase()) return +1;
    if(a.folderPath .toLowerCase() < 
       b.folderPath .toLowerCase()) return -1;
    if(a.fileRelPath.toLowerCase() > 
       b.fileRelPath.toLowerCase()) return +1;
    if(a.fileRelPath.toLowerCase() <
       b.fileRelPath.toLowerCase()) return -1;
    return (a.lineNumber - b.lineNumber);
  });
  let folders=[], files=[], syms=[], marksInSym=[];
  function cleanLastSym() {
    if(syms.length > 0) {
      const lastSym1 = syms[syms.length-1][1];
      if(Array.isArray(lastSym1) && 
          lastSym1.length === 0) syms.pop();
    }
  }
  let lastFolderPath = null;
  let lastFileRelPath, lastSymName;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      lastFolderPath = mark.folderPath;
      cleanLastSym();
      files = [];
      folders.push([mark.folderPath, files]);
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      lastFileRelPath = mark.fileRelPath;
      cleanLastSym();
      syms = [];
      files.push([mark.fileRelPath, syms]);
      lastSymName = null;
    }
    const symName = mark.label.symName;
    if(symName === null) {
      cleanLastSym();
      lastSymName = null;
      syms.push([null, mark]);
      continue;
    }
    if(symName !== lastSymName) {
      cleanLastSym();
      lastSymName = symName;
      const lineNumber = mark.label.symLineNum;
      if(mark.lineNumber !== lineNumber) {
        const symMark = Object.assign({}, mark, 
                           {lineNumber, token:null});
        symMark.label.compText = null;
        syms.push([symName, symMark]);
      }
      else mark.label.compText = null;
      marksInSym = [];
      syms.push([symName, marksInSym]);
    }
    marksInSym.push(mark);
  }
  cleanLastSym();
  return folders;
}

module.exports = {init, dumpGlobalMarks, getMarksTree, 
                  addGlobalMark, delGlobalMark, delGlobalMarksForFile}

