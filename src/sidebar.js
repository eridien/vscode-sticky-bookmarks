const vscode = require('vscode');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const log    = utils.getlog('side');

// https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

function getItem(index, codicon, label, children, type, mark) {
  let iconLabel;
  if(type == 'noSym' || type == 'symChild') 
        iconLabel = `$(bookmark)   ${mark.label.compText}`;
  else  iconLabel = `$(${codicon}) ${label}`;
  const item = new vscode.TreeItem(iconLabel, 
          (children?.length)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.none);
  item.iconPath = undefined;
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [{codicon, index, label, children}],
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
        const {folderPath, files} = folderItems;
        const folderName =
              folderPath.split('/').pop().toUpperCase();
        return getItem(index, 'folder', folderName, files);
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

} 

let sideBarIsVisible = false;

function visibleChange(provider, visible) {
  log('visibleChange', visible);
  if(visible && !sideBarIsVisible) provider.refresh();
  sideBarIsVisible = visible;
}
module.exports = { SidebarProvider, visibleChange, itemClick };
