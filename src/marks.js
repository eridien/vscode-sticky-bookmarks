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

function addGlobalMark(data) {
  data.token = getRandomToken();
  globalMarks[data.token] = data;
  context.workspaceState.update('globalMarks', globalMarks);
  return data.token;
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
    let addedSymMark = false;
    if(symName !== lastSymName) {
      cleanLastSym();
      lastSymName = symName;
      const linenumber = mark.label.symLineNum;
      if(mark.lineNumber !== linenumber) {
        const symMark = Object.assign({}, mark, {linenumber});
        syms.push([symName, symMark]);
        addedSymMark = true;
      }
      marksInSym = [];
      syms.push([symName, marksInSym]);
    }
    if(!addedSymMark) marksInSym.push(mark);
  }
  cleanLastSym();
  return folders;
}

module.exports = {init, dumpGlobalMarks, getMarksTree,
                  addGlobalMark, delGlobalMark, delGlobalMarksForFile}

