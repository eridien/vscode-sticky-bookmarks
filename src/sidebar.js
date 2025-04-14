const vscode = require('vscode');
const marks  = require('./marks.js');
const labelm = require('./label.js');
const utils  = require('./utils.js');
const log    = utils.getLog('side');

let glblFuncs, provider;

async function init(contextIn, glblFuncsIn, providerIn) {
  glblFuncs = glblFuncsIn;
  provider  = providerIn;
  log('sidebar initialized');
  return {updateSidebar};
}

async function getItem(mark) {
  const [codicon, label] = await labelm.getLabel(mark);
  const {id, type, folderPath, folderName,
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
  Object.assign(item, {id, type, folderPath, folderName});
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

async function getItemTree() {
  log('getItemTree');
  const rootItems = [];
  const marksArray = Object.values(marks.getGlobalMarks());
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
      const folderName = folderPath.split('/').pop();
      rootItems.push(await getItem(
                 {type:'folder', folderPath, folderName, id}));
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

class SidebarProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData  = this._onDidChangeTreeData.event;
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(item) {
    if(!item) {
      await marks.waitForInit();
      return await getItemTree();
    }
    return item.children ?? [];
  }
}

function itemClick(item) {
  log('itemClick', item);
} 

function closeItem(item) {
  log('closeItem', item);
  switch (item.type) {
    case 'folder':     glblFuncs.clearAllFiles(item.folderPath); break;
    case 'file':       glblFuncs.clearFile(item.document);           break;
    default: {
      const line = item.document.lineAt(item.lineNumber);
      glblFuncs.delMark(line, item.languageId); break;
    } 
  }
} 

function updateSidebar() {
  provider._onDidChangeTreeData.fire();
  log('updateSidebar');
}

let sideBarIsVisible = false;
let firstVisible     = true;

async function visibleChange(visible) {
  log('visibleChange', visible);
  if(visible && !sideBarIsVisible) {
    if(firstVisible) {
      firstVisible = false;  
      await glblFuncs.cleanAllFiles();
    }
    updateSidebar();
  }
  sideBarIsVisible = visible;
}

module.exports = { init, SidebarProvider, visibleChange, 
                   itemClick, closeItem };
