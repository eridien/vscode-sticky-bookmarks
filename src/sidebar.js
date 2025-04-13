const vscode = require('vscode');
const marks  = require('./marks.js');
const labelm = require('./label.js');
const utils  = require('./utils.js');
const log    = utils.getLog('side');

let glblFuncs, provider;

function init(contextIn, glblFuncsIn, providerIn) {
  glblFuncs = glblFuncsIn;
  provider  = providerIn;
  log('sidebar initialized');
  return {updateSidebar};
}

async function getItem(mark) {
  const [codicon, label] = await labelm.getLabel(mark);
  const {id, type, folderPath, fileRelPath, children} = mark;
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
  if (fileRelPath) item.fileRelPath = fileRelPath;
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [mark],
  }
  return item;
};

class SidebarProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(item) {
    const children = (!item) ? marks.sortedMarks() 
                             : item.children;
    return await Promise.all(children.map(
      mark => getItem(mark))
    );
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
