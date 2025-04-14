const vscode = require('vscode');
const marks  = require('./marks.js');
const labelm = require('./label.js');
const utils  = require('./utils.js');
const log    = utils.getLog('side');

let glblFuncs, provider, itemTree;

const closedFolders = new Set(); 

async function init(contextIn, glblFuncsIn, providerIn) {
  glblFuncs = glblFuncsIn;
  provider  = providerIn;
  log('sidebar initialized');
  return {updateSidebar};
}

async function getNewItem(mark) {
  const label = await labelm.getLabel(mark);
  const {id, type, document, lineNumber, languageId,
         folderPath, folderName, filePath, 
         fileRelPath, fileFsPath, children} = mark;
  let item;
  if (children) {
    item = new vscode.TreeItem(label, 
               vscode.TreeItemCollapsibleState.Expanded);
    item.children = children;
  }
  else 
    item = new vscode.TreeItem(label, 
            vscode.TreeItemCollapsibleState.None);
  if (type == 'folder') {
    if(closedFolders.has(folderPath)) 
      item.iconPath = new vscode.ThemeIcon("chevron-right");
    else 
      item.iconPath = new vscode.ThemeIcon("chevron-down");
  }
  Object.assign(item, {id, type, document, languageId, lineNumber, 
                       folderPath, folderName});
  if (type !== 'folder' && fileRelPath) {
    item.filePath    = filePath;
    item.fileRelPath = fileRelPath;
    item.fileFsPath  = fileFsPath;
  }
  item.command = {
    command: 'sticky-bookmarks.itemClick',
    title:   'Item Clicked',
    arguments: [{document, lineNumber, type, id}],
  }
  return item;
};

async function getItemTree() {
  log('getItemTree', marks.getGlobalMarks());
  const rootItems = [];
  const marksArray = Object.values(marks.getGlobalMarks());
  if(marksArray.length == 0) return [];
  marksArray.sort((a, b) => {
    if(a.folderIdx > b.folderIdx) return +1;
    if(a.folderIdx < b.folderIdx) return -1;
    if(a.folderPath .toLowerCase() > 
       b.folderPath .toLowerCase()) return +1;
    if(a.folderPath .toLowerCase() < 
       b.folderPath .toLowerCase()) return -1;
    if(a.fileRelPath.toLowerCase() > 
       b.fileRelPath.toLowerCase()) return +1;
    if(a.fileRelPath.toLowerCase() <
       b.fileRelPath.toLowerCase()) return -1;
    return (a.lineNumber - b.lineNumber);
  });
  let bookmarks;
  let lastFolderPath = null, lastFileRelPath;
  for(const mark of marksArray) {
    if(mark.folderPath !== lastFolderPath) {
      const {folderPath, document, languageId} = mark;
      lastFolderPath = folderPath;
      const id = utils.fnv1aHash(folderPath);
      const folderName = folderPath.split('/').pop();
      rootItems.push(await getNewItem(
                 {type:'folder', document, languageId,
                  folderPath, folderName, id}));
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      const {document, languageId, 
             folderPath, filePath, 
             fileRelPath, fileFsPath} = mark;
      lastFileRelPath = fileRelPath;
      const id = utils.fnv1aHash(fileFsPath);
      bookmarks = [];
      if(closedFolders.has(folderPath)) continue;
      rootItems.push(await getNewItem({ 
            type:'file', document, languageId,
            folderPath, filePath, fileRelPath, fileFsPath,
            children:bookmarks, id}));
    }
    mark.id = mark.token;
    bookmarks.push(await getNewItem(mark));
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document         = editor.document;
    const editorFilePath   = document.uri.path;
    const editorLine       = editor.selection.active.line;
    for(const item of rootItems) {
      if(item.type === 'file' && 
         item.filePath === editorFilePath &&
         !closedFolders.has(item.folderPath)) {
        item.children.forEach(bookmarkItem => {
          const markLine = bookmarkItem.lineNumber;
          if(markLine === editorLine) 
            bookmarkItem.iconPath = new vscode.ThemeIcon("triangle-right");
          else if(markLine > editorLine) 
            bookmarkItem.iconPath = new vscode.ThemeIcon("triangle-up");
          else if(markLine < editorLine)
            bookmarkItem.iconPath = new vscode.ThemeIcon("triangle-down");
        });
      }
    }
  }
  itemTree = rootItems;
  return rootItems;
}

class SidebarProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData  = this._onDidChangeTreeData.event;
  }
  getTreeItem(item) {
    return item;
  }

  async getChildren(item) {
    if(!item) {
      await marks.waitForInit();
      return await getItemTree();
    }
    return item.children ?? [];
  }
}

async function itemClick(item) {
  log('itemClick');
  if(item.type === 'folder') {
    const folderItem = itemTree.find(rootItem => rootItem.id === item.id);
    if(folderItem) {
      if(closedFolders.has(folderItem.folderPath)) 
         closedFolders.delete(folderItem.folderPath);
      else 
         closedFolders.add(folderItem.folderPath);
      updateSidebar();
    }
    return;
  }
  if(item.type === 'bookmark') {
    const doc        = await vscode.workspace.openTextDocument(item.document.uri);
    const editor     = await vscode.window.showTextDocument(doc, {preview: false});
    const lineRange  = doc.lineAt(item.lineNumber).range;
    // editor.selection = new vscode.Selection(lineRange.start, lineRange.start);
    editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    const decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'), 
      // or use a custom color like 'rgba(255, 200, 0, 0.2)'
      isWholeLine: true,
    });
    editor.setDecorations(decorationType, [lineRange]);
    const disposable = vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor === editor) {
        editor.setDecorations(decorationType, []);
        decorationType.dispose();
        disposable.dispose(); 
      }
    });
    const clearDecoration = () => {
      editor.setDecorations(decorationType, []);
      decorationType.dispose();
      selectionListener.dispose();
      focusListener.dispose();
    };
    const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor === editor) clearDecoration();
    });
    const focusListener = vscode.window.onDidChangeActiveTextEditor(activeEditor => {
      if (activeEditor !== editor) clearDecoration();
    }); 
    return;
  }
} 

async function deleteMark(item) {
  log('deleteMark command');
  const document = item.document;
  switch (item.type) {
    case 'folder':     glblFuncs.clearAllFiles(item.folderPath); break;
    case 'file':       glblFuncs.clearFile(document);            break;
    default: {
      const line = document.lineAt(item.lineNumber);
      await glblFuncs.delMark(document, line, item.languageId);
      updateSidebar();
    } 
  }
} 

function updateSidebar(item) {
  provider._onDidChangeTreeData.fire(item);
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
                   itemClick, deleteMark };
