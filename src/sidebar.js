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

function getItem(params) {
  let {id, index, type, codicon, label, path,
       token, children, mark} = params;
  if(type == 'noSym' || type == 'symChild') codicon = 'bookmark';
  else codicon = 'symbol-' + codicon;
  if(codicon == 'function') label = `\u0192 ${label}`;
  const item = new vscode.TreeItem(label, 
          (children?.length)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.none);
  const returnObj = {id, index, codicon,
                     type, path, token, mark, children};
  if(codicon != 'folder' && codicon != 'function') {
    returnObj.iconPath = new vscode.ThemeIcon(codicon);
  }
  Object.assign(item, returnObj);
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [{id, index, codicon,
                  type, path, token, mark, children}],
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
        const {codicon, type, path, children, id} = items;
        const label = path.split('/').pop().toUpperCase();
        return getItem({id, type, index, codicon, label, 
                        path, children});
      });
    }
    else {
      const {codicon, type, path, children, mark, id} = item;
      if(children) {
        return children.map((items, index) => {
          const {codicon, type, path, mark, children, id} = items;
          let label;
          switch (type) {
            case 'file':       label = mark.fileRelPath;    break;
            case 'symWrapper':
            case 'symHead':    label = mark.label.symName;  break;
            case 'noSym':
            case 'symChild':   label = mark.label.compText; break;

          }
          return getItem({id, type, index, codicon, label, 
                           path, token:mark.token, mark, children});
        });
      }
      else {
        const label = mark.label.compText
        return [getItem({id, type, codicon, label, path, 
                         token:mark.token, mark})];
      }
    }
  }
}

function itemClick(item) {
  log('itemClick', item);
} 

function cleanItem(item) {
  log('cleanItem', item);
} 

function closeItem(item) {
  log('closeItem', item);
} 

function updateSidebar() {
  provider._onDidChangeTreeData.fire();
  log('updateSidebar');
}

let sideBarIsVisible = false;

function visibleChange(visible) {
  log('visibleChange', visible);
  if(visible && !sideBarIsVisible) updateSidebar();
  sideBarIsVisible = visible;
}

module.exports = { init, SidebarProvider, visibleChange, 
                   itemClick, cleanItem, closeItem };
