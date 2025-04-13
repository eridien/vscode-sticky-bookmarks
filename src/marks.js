const vscode = require('vscode');
const path   = require('path');
const labelm = require('./label.js');
const utils  = require('./utils.js');
const log    = utils.getLog('mark');

let globalMarks;
let context, glblFuncs;

async function init(contextIn, glblFuncsIn) { 
  context = contextIn;
  glblFuncs = glblFuncsIn;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    globalMarks = {};
    await context.workspaceState.update('globalMarks', globalMarks);
    log('no workspace folders found');
    return {};
  }
  // clear globalMarks for testing
  // this fails but gets the job done
  // await context.workspaceState.update('globalMarks', {});   // DEBUG

  globalMarks = context.workspaceState.get('globalMarks', {});
  for(const [token, mark] of Object.entries(globalMarks)) {
    const fileFsPath = mark.document.fileName;
    const markUri = vscode.Uri.file(path.resolve(fileFsPath)); 
    const folder  = vscode.workspace.getWorkspaceFolder(markUri);
    if(!folder) { 
      delete globalMarks[token];
      continue;
    }
    mark.folderIdx  = folder.index;
    mark.folderName = folder.name;
    mark.fileFsPath = fileFsPath;
    const document = 
            await vscode.workspace.openTextDocument(markUri);
    if(!document) { 
      delete globalMarks[token];
      continue;
    }
    mark.document   = document;
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  log('marks initialized'); 
  dumpGlobalMarks(true);
  return {};
}

function dumpGlobalMarks(all = false) {
  if(all) log('globalMarks', globalMarks);
  else    log('globalMarks', Object.keys(globalMarks));
}

function getRandomToken() {
  const hashDigit = () => Math.floor(Math.random()*36).toString(36);
  let randHash;
  do {  randHash = ''; for(let i = 0; i < 4; i++) randHash += hashDigit()}
  while(randHash in globalMarks);
  return `:${randHash};`;
}
/*

function getProjectIdx(document) {
  return 0;
}
*/
async function newGlobalMark(document, lineNumber) {
  const token = getRandomToken();
  const mark  = {token, document, lineNumber, type:'bookmark'};
  mark.folderPath  = vscode.workspace
                       .getWorkspaceFolder(document.uri).uri.path;
  mark.fileRelPath = vscode.workspace.asRelativePath(document.uri);
  mark.languageId  = document.languageId;
  mark.fileFsPath  = document.fileName;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  let folder;
  for (let i = 0; i < workspaceFolders.length; i++) {
    folder = workspaceFolders[i];
    if (document.uri.fsPath.startsWith(folder.uri.fsPath)) {
      mark.folderIdx = i;
      break;
    }
  }
  mark.folderName = folder.name;
  globalMarks[token] = mark;
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return token;
}

async function delGlobalMark(token) {
  delete globalMarks[token];
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  return '';
}

async function delGlobalMarksForFile(fileRelPath) {
  for(const [token, mark] of Object.entries(globalMarks)) {
    if(mark.fileRelPath === fileRelPath) delete globalMarks[token];
  }
  await context.workspaceState.update('globalMarks', globalMarks);
  glblFuncs.updateSidebar();
  log('delGlobalMarksForFile:', fileRelPath);
}

async function getItem(mark) {
  const [codicon, label] = await labelm.getLabel(mark);
  const {id, type, folderPath, 
         fileRelPath, fileFsPath, children} = mark;
  let item;
  if (children) {
    item = new vscode.TreeItem(label, 
               vscode.TreeItemCollapsibleState.Expanded);
    item.children = children;
  }
  else 
    item = new vscode.TreeItem(label, 
            vscode.TreeItemCollapsibleState.None);
  if (codicon) item.iconPath = new vscode.ThemeIcon(codicon);
  Object.assign(item, {id, type, folderPath});
  if (fileRelPath) {
    item.fileRelPath = fileRelPath;
    item.fileFsPath  = fileFsPath;
  }
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [mark],
  }
  return item;
};

async function getRootItems() {
  log('getRootItems');
  const rootItems = [];
  const marksArray = Object.values(globalMarks);
  if(marksArray.length == 0) return [];
  marksArray.sort((a, b) => {
    if(a.folderIdx > b.folderIdx) return +1;
    if(a.folderIdx < b.folderIdx) return -1;
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
  let bookmarks;
  let lastFolderPath = null, lastFileRelPath;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      const {folderPath} = mark;
      lastFolderPath = folderPath;
      const id = utils.fnv1aHash(folderPath);
      rootItems.push(await getItem({type:'folder', folderPath, id}));
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      const {document, folderPath, fileRelPath, fileFsPath} = mark;
      lastFileRelPath = fileRelPath;
      const id = utils.fnv1aHash(fileFsPath);
      bookmarks = [];
      rootItems.push(await getItem({document, type:'file', 
                              folderPath, fileRelPath, fileFsPath,
                              children:bookmarks, id}));
    }
    mark.id = mark.token;
    bookmarks.push(await getItem(mark));
  }
  return rootItems;
}

module.exports = {init, dumpGlobalMarks, getRootItems, 
                  newGlobalMark, delGlobalMark, delGlobalMarksForFile}

