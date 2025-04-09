const vscode = require('vscode');
const token     = require('./token.js');

class SidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    return Promise.resolve([
      this.createItem('file 1'),
      this.createItem('file 2')
    ]);
  }

  createItem(label) {
    return {
      label,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'sticky-bookmarks.itemClick',
        title: 'Item Clicked',
        arguments: [{ label, arg2:{arg21:'arg21'} }]
      }
    };
  }
}

class sideBarItem extends vscode.TreeItem {
  constructor(label, id, children = []) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Collapsed 
                                 : vscode.TreeItemCollapsibleState.None);
    this.id = id;
    this.children = children;
    this.command = {
      command: 'myExtension.onClick',
      title: 'On Click',
      arguments: [this.id]  // Pass the item's ID to the command
    };
  }
}

// folderPath, fileRelPath, lineNumber, languageId, label
// label: symName, symOfs, compText

const delChar = String.fromCharCode(127);

function sortMarksIntoTree() {
  const marksArray = token.getGlobalMarksAsArray();
  marksArray.sort((a, b) => {
    const aKey = a.folderPath   .toLowerCase() + delChar +
                 a.fileRelPath  .toLowerCase() + delChar +
                 a.label.symName.toLowerCase() + delChar +
                 a.lineNumber   .toString().padStart(6, '0');
    const bKey = b.folderPath   .toLowerCase() + delChar +
                 b.fileRelPath  .toLowerCase() + delChar +
                 b.label.symName.toLowerCase() + delChar +
                 b.lineNumber   .toString().padStart(6, '0');
    if (aKey === bKey) return 0;
    return (aKey > bKey) ? 1 : -1;
  });

  const folders = []
  let files, symbols, marks
  let lastFolderPath = null;
  let lastFileRelPath, lastSymbolName;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      files = [];
      markTree.push([mark.folderPath, files]);
      lastFileRelPath = null;
      lastFolderPath = mark.folderPath;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      symbols = [];
      files.push([mark.fileRelPath, symbols]);
      lastSymbolName = null;
      lastFilePath = mark.fileRelPath;
    }
    if(mark.label.symName !== lastSymbolName) {
      marks = [];
      symbols.push([mark.label.symName, marks]);
      lastSymbolName = mark.label.symName;
    }
    marks.push(mark);
  }



    const parentItem = markTree[markTree.length - 1];

  }

    mark.label = `${mark.folderPath} - ${mark.fileRelPath} 
                  (${mark.lineNumber})`;
  }
  


  const folders = marksArray.reduce((acc, mark) => {
    acc[mark.folderPath] ?? [];
    acc[mark.folderPath].push(mark);
    return acc;
  }



}

module.exports = { SidebarProvider };
