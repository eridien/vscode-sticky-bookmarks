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
    if (!item) {
      this.marksTree = marks.getMarksTree();
      return this.marksTree.map((items, index) => {
        items.index = index;
        items.label = items.folderPath.split('/').pop().toUpperCase();
        return getItem(items);
      });
    }
    else {
      const {children, mark} = item;
      if(children) {
        return children.map((items, index) => {
          const {type, fileRelPath, symName, compText, mark} = items;
          items.index = index;
          items.token = mark?.token;
          switch (type) {
            case 'file':       items.label = fileRelPath; break;
            case 'symWrapper': 
            case 'symHead':    items.label = symName;     break;
            case 'noSym':
            case 'symChild':   items.label = compText;    break;
          }
          return getItem(items);
        });
      }
      else {
        item.label = mark.label.compText
        return [getItem(item)];
      }
    }
  }
}

function itemClick(item) {
  log('itemClick', item);
} 

function closeItem(item) {
  log('closeItem', item);
  switch (item.type) {
    case 'folder':     glblFuncs.clearAllFiles(item.path); break;
    case 'file':       glblFuncs.clearFile(item.path); break;
    case 'symWrapper': glblFuncs.clearFile(item.mark.fileRelPath); break;
    case 'symHead':    glblFuncs.clearFile(item.mark.fileRelPath); break;
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
