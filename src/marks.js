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

// folderPath, fileRelPath, lineNumber, languageId, label
// label: symName, symOfs, compText

const delChar  = String.fromCharCode(127);
const nullChar = String.fromCharCode(1);

function getMarksArrayTree() {
  const marksArray = Object.values(globalMarks);

  marksArray.sort((a, b) => {
    const aSymName = a.label.symName ?? nullChar;
    const bSymName = b.label.symName ?? nullChar;
    const aKey = a.folderPath   .toLowerCase() + delChar +
                 a.fileRelPath  .toLowerCase() + delChar +
                 aSymName       .toLowerCase() + delChar +
                 a.lineNumber   .toString().padStart(6, '0');
    const bKey = b.folderPath   .toLowerCase() + delChar +
                 b.fileRelPath  .toLowerCase() + delChar +
                 bSymName       .toLowerCase() + delChar +
                 b.lineNumber   .toString().padStart(6, '0');
    if (aKey === bKey) return 0;
    return (aKey > bKey) ? 1 : -1;
  });

  const rootFolders = [];
  let files, symbols, marksSorted;
  let lastFolderPath = null;
  let lastFileRelPath, lastSymbolName;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      files = [];
      rootFolders.push([mark.folderPath, files]);
      lastFileRelPath = null;
      lastFolderPath = mark.folderPath;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      symbols = [];
      files.push([mark.fileRelPath, symbols]);
      lastSymbolName = null;
      lastFileRelPath = mark.fileRelPath;
    }
    const symName = mark.label.symName ?? nullChar;
    if(symName !== lastSymbolName) {
      marksSorted = [];
      symbols.push([symName, marksSorted]);
      lastSymbolName = symName;
    }
    marksSorted.push(mark);
  }
  return rootFolders;
}

module.exports = {init, dumpGlobalMarks, getMarksArrayTree,
                  addGlobalMark, delGlobalMark, delGlobalMarksForFile}

