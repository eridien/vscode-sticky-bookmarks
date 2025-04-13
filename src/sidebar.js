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
  const label = await labelm.getLabel(mark);
  const {children} = mark;
  let item;
  if (children) {
    item = new vscode.TreeItem(label, 
            vscode.TreeItemCollapsibleState.Expanded);
    item.children = children;
  }
  else 
    item = new vscode.TreeItem(label, 
            vscode.TreeItemCollapsibleState.None);
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Bookmark Clicked',
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

  getChildren(item) {
    if (!item) return marks.sortedMarks().map(mark => getItem(mark));
    else       return [getItem(item)];
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
