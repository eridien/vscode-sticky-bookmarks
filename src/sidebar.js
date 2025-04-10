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
  const iconLabel = `$(${codicon}) ${label}`;
  const item = new vscode.TreeItem(
          iconLabel, vscode.TreeItemCollapsibleState.Expanded);
  item.iconPath = undefined;
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title: 'Item Clicked',
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

class SideBarItem extends vscode.TreeItem {
  constructor(label, id, children = []) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded 
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

function update() {
  const marksTree = marks.getMarksTree();
  log(marksTree);
}

function itemClick(item) {
  update();
} 

const kindToCodicon= {
     1: "file",         2: "module",      3: "namespace",  4: "package", 
     5: "class",        6: "method",      7: "property",   8: "field", 
     9: "constructor", 10: "enum",       11: "interface", 12: "function", 
    13: "variable",    14: "constant",   15: "string",    16: "number", 
    17: "boolean",     18: "array",      19: "object",    20: "key",
    21: "null",        22: "enummember", 23: "struct",    24: "event", 
    25: "operator",    26: "typeparameter"}
;

function getItem(kindOrCodicon, label) {
  let codicon;
  if(typeof kindOrCodicon === 'string')
    codicon = kindOrCodicon;
  else {
    const kind = kindOrCodicon;
    codicon = (kind === null) 
        ? codiconIn : kindToCodicon[kind+1] || 'question';
  }
  const iconLabel = `$(${codicon}) ${label}`;
  const item = new vscode.TreeItem(iconLabel);
  item.iconPath = undefined;
  return item;
};

/*
      folders.push([mark.folderPath, files]);
        files.push([mark.fileRelPath, {document, languageId, syms}]);
          syms.push([null, mark]);
          syms.push([symName, marksInSym]);
            marksInSym.push(mark);
          syms.push([symName, symMark]);

  const {symName, symLineNum, compText}     
                    = getLabel(document, languageId, line);
  getItem(document, languageId, line, kind, treeMark)
*/
for(folderIdx = 0; folderIdx < treeMark.length; folderIdx++) {
  const folderName = 
          treeMark[folderIdx][0].split('/').pop().toUpperCase();
  const files = treeMark[folderIdx][1];
  for(fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const fileRelPath                  = files[fileIdx][0];
    const {document, languageId, syms} = files[fileIdx][1];

    const fileRelPath = files[fileIdx][0];
    const syms        = files[fileIdx][1];
    const {symNameIn, symLineNumIn compTextIn} = 
                        getLabel(document, languageId, line);
    
    for(symIdx = 0; symIdx < syms.length; symIdx++) {
      const symName = syms[symIdx][0];
      if(symName === null) {
        const globalCompText 
      }
      const symMark = syms[symIdx][1];
      if(symMark.lineNumber === line.lineNumber) {
        return getItem(document, languageId, line, 
                       symMark.kind, treeMark);
      }
    }
  }

const symName = getLabel(document, languageId, line);

  if(symName === null) return null;

  const {symName, symLineNum, compText}     
                    = getLabel(document, languageId, line);

  if(treeMark[0] === null) {
    if(treeMark[1] === null)
  }
  else {

  }

  if(symName === null) return null;


  const label = symName 
                ? `${symName} (${compText.trim()})`
                : `Line ${line.lineNumber + 1}`;


module.exports = { init, SidebarProvider, update, itemClick };
