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

function getItem(id, index, codicon, label, children, type) {
  if(type == 'noSym' || type == 'symChild') 
    codicon = 'bookmark';
  const item = new vscode.TreeItem(label, 
          (children?.length)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.none);
  if(type != 'folder')
    item.iconPath = new vscode.ThemeIcon(codicon);
  item.id = id;
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [{id, index, codicon, label, type}],
  }
  return item;
};

class SidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      // called with no element to create or refresh tree
      this.marksTree = marks.getMarksTree();
      return this.marksTree.map((folderItems, index) => {
        const {folderPath, files, id} = folderItems;
        const folderName =
              folderPath.split('/').pop().toUpperCase();
        return getItem(id, index, 'folder', folderName, files, 'folder');
      });
    }
    else return [];
    // else {
    //   return [
    //     new vscode.TreeItem('Leaf', vscode.TreeItemCollapsibleState.None)
    //   ];
    // }
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
  provider.getChildren();
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
