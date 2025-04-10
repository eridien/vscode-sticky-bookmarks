const vscode = require('vscode');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const log    = utils.getLog('SIDE');

// https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

let context;

function init(contextIn) { 
  context = contextIn;
}

function getItem(index, kindOrCodicon, label, children, mark) {
  let codicon;
  if(typeof kindOrCodicon === 'string')
    codicon = kindOrCodicon;
  else {
    const kind = kindOrCodicon;
    codicon = (kind === null) 
        ? codiconIn : kindToCodicon[kind+1] || 'question';
  }
  let iconLabel;
  if(codicon == 'compText') iconLabel = compText;
  else                      iconLabel = `$(${codicon}) ${label}`;
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

  // called with no element to create or refresh tree
  getChildren(element) {
    if (!element) {
      this.marksTree = marks.getMarksTree();
      return marksTree.map((folderItems, index) => {
        const [folderPath, files] = folderItems;
        const folderName =
              folderPath.split('/').pop().toUpperCase();
        const childrenFiles = folderArr[1];
        return getItem(index, 'folder', label, childrenFiles);
      });
    }
    // else {
    //   return [
    //     new vscode.TreeItem('Leaf', vscode.TreeItemCollapsibleState.None)
    //   ];
    // }
  }
}

function update() {

}

function itemClick(item) {

} 

module.exports = { init, SidebarProvider, update, itemClick };
