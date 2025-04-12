const vscode = require('vscode');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const log    = utils.getLog('side');

// https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
  
let context, glblFuncs, provider;

function init(contextIn, glblFuncsIn, providerIn) {
  context   = contextIn;
  glblFuncs = glblFuncsIn;
  provider  = providerIn;
  log('sidebar initialized');
  return {updateSidebar};
}

// 📄 🔖 ƒ 📂 ✏️ 📦 ❔ ⬚ ⌀ …


function getItem(items) {
  let {type, codicon, label, children} = items;
  if(type == 'noSym' || type == 'symChild') 
       codicon = 'bookmark';
  else codicon = 'symbol-' + codicon;
  items.codicon = codicon;
  if(codicon == 'symbol-function') label = `ƒ  ${label}`;
  items.label = label;
  const item = new vscode.TreeItem(label, 
          (children?.length)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.none);
  if(codicon != 'folder' && codicon != 'symbol-function') {
    items.iconPath = new vscode.ThemeIcon(codicon);
  }
  Object.assign(item, items);
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [{...items}],
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
