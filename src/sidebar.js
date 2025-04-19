const vscode = require('vscode');
const text   = require('./text.js');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log}  = utils.getLog('side');

const showPointers = true;

let glblFuncs, provider, treeView, itemTree;

const closedFolders = new Set();

async function init(glblFuncsIn, providerIn, treeViewIn) {
  glblFuncs = glblFuncsIn;
  provider  = providerIn;
  treeView  = treeViewIn;
  return {updateSidebar};
}

async function getNewFolderItem(mark) {
  const {folderIndex, folderName, folderFsPath, folderUriPath} = mark;
  const id = utils.fnv1aHash(folderUriPath);
  const item = {id, type:'folder', label: '📂 ' + folderName,
                folderIndex, folderName, folderFsPath, folderUriPath};
  item.command = {
    command:   'sticky-bookmarks.itemClickCmd',
    title:     'Item Clicked',
    arguments: [item],
  }
  return item;
}

async function getNewFileItem(mark, children) { 
  const label =  '📄 ' + mark.fileRelUriPath;
  const {folderIndex, folderName, folderFsPath, folderUriPath, 
         document, fileName, fileFsPath, fileUriPath, fileRelUriPath} = mark;
  const item = new vscode.TreeItem(label,
                   vscode.TreeItemCollapsibleState.Expanded);
  item.id = utils.fnv1aHash(fileUriPath);
  Object.assign(item, {type:'file', document, children, 
                       folderIndex, folderName, folderFsPath, folderUriPath,
                       fileName,    fileFsPath, fileUriPath,  fileRelUriPath});
  item.command = {
    command:   'sticky-bookmarks.itemClickCmd',
    title:     'Item Clicked',
    arguments: [item],
  }
  return item;
};

async function getNewMarkItem(mark) {
  const label = await text.getLabel(mark);
  const item  = new vscode.TreeItem(label,
                    vscode.TreeItemCollapsibleState.None);
  Object.assign(item, {id:mark.token, type:'bookmark', mark});
  item.command = {
    command: 'sticky-bookmarks.itemClickCmd',
    title:   'Item Clicked',
    arguments: [item],
  }
  return item;
};

let itemTreeLogCount = 0;

async function getItemTree() {                                         //:tuzz;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    log('No folders in workspace');
    return [];
  }
  for(const folder of folders) {
    utils.getPathsFromWorkspaceFolder(folder)  
  }
  log('getItemTree', ++itemTreeLogCount);
  const rootItems = [];
  const marksArray = Object.values(marks.getGlobalMarks());
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
  let bookmarks;                                                       //:khs2;
  let lastFolderPath = null, lastFileRelPath;
  for(const mark of marksArray) {
    const folderPath = mark.folderPath;
    // if(!await utils.fileExists(mark.folderFsPath)) {
    //   log('Folder does not exist, deleting globalMark:', 
    //                               mark.token, folderPath);
    //   marks.deleteGlobalMark(mark.token);
    //   continue;
    // }
    if(folderPath !== lastFolderPath) {
      lastFolderPath = folderPath;
      let folder = folders[0];
      if(!folder || folder.uri.path !== folderPath) {
        log('skipping folder not found:', folderPath);
        continue;
      }
      while(folder && folder.uri.path !== folderPath) {
        await addFolderItem(rootItems, folder.uri.path, folder.name);
        folder = folders.shift();
      }
      await addFolderItem(rootItems, folderPath, folder.name);         //:jnz4;
      folders.shift();
      lastFileRelPath = null;
    }
    if(mark.fileRelPath !== lastFileRelPath) {
      const {document, languageId,
             folderPath, filePath,
             fileRelPath, fileFsPath} = mark;
      utils.getPathsFromFileDoc(document);
      lastFileRelPath = fileRelPath;
      const id = utils.fnv1aHash(fileFsPath);
      bookmarks = [];
      if(closedFolders.has(folderPath)) continue;
      rootItems.push(await getNewItem(
           {type:'file', mark, children:bookmarks, id}));
    }
    mark.id = mark.token;
    bookmarks.push(await getNewItem({type:'bookmark', mark}));
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document         = editor.document;
    const editorFilePath   = document.uri.path;
    const editorLine       = editor.selection.active.line;
    if(showPointers) {
      let haveDown  = null;
      let haveExact = null;
      let haveUp    = null;
      for(const item of rootItems) {
        if(item.type === 'file' &&
          item.filePath === editorFilePath &&
          item.children && item.children.length > 0 &&
          !closedFolders.has(item.folderPath)) {
          for (const bookmarkItem of item.children) {
            const markLine = bookmarkItem.lineNumber;
            if(editorLine === markLine) {
              haveExact = bookmarkItem;
              break;
            }
            else if(editorLine < markLine)  {
              haveUp = bookmarkItem;
              break;
            }
            else if(editorLine > markLine) {
              haveDown = bookmarkItem;
            }
          }
        }
      }
      if(haveExact)
        haveExact.iconPath = new vscode.ThemeIcon("triangle-right");
      else {
        if(haveUp)
          haveUp.iconPath = new vscode.ThemeIcon("triangle-up");
        if(haveDown)
          haveDown.iconPath = new vscode.ThemeIcon("triangle-down");
      }
    }
  }
  let folder = folders.shift();
  while(folder) {
    await addFolderItem(rootItems, folder.uri.path, folder.name);                      //
    folder = folders.shift();
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

async function itemClickCmd(item) {
  // log('itemClickCmd');
  text.clearDecoration();
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
    await text.bookmarkClick(item);
  }
}

function updateSidebar(item) {
  provider._onDidChangeTreeData.fire(item);
}

let sideBarIsVisible = false;
let firstVisible     = true;

async function sidebarVisibleChange(visible) {
  // log('sidebarVisibleChange', visible);
  if(visible && !sideBarIsVisible) {
    if(firstVisible) {
      firstVisible = false;
      await glblFuncs.cleanAllFilesCmd();                              //:rn54;
    }
    updateSidebar();
  }
  sideBarIsVisible = visible;
}

async function changeDocument() {
  // log('changeDocument', document.uri.path);
  updateSidebar();
}

async function changeEditor(editor) {
  if(!editor || !editor.document) {
    log('changeEditor, no active editor');
    return;
  }
  // log('changeEditor', editor.document.uri.path);
  updateSidebar();
}
async function changeVisEditors() {
  // log('changeVisEditors', editors.length);
  updateSidebar();
}

async function changeSelection() {
  // log('changeSelection');
  // const uri      = editor.document.uri;
  // const position = editor.selection.active;
  // log('changeSelection', uri, position.line);
  updateSidebar();
  text.clearDecoration();
  treeView.selection = []; // doesn't work
}

module.exports = { init, SidebarProvider, itemClickCmd,
                   sidebarVisibleChange, changeDocument,
                   changeEditor, changeVisEditors, changeSelection };


