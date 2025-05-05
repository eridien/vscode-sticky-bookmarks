const vscode = require('vscode');
const text   = require('./text.js');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log, start, end}  = utils.getLog('side');

const showPointers   = true;
let itemTree         = [];
const closedFolders  = new Set();
let   treeView;

function init(treeViewIn) {
  treeView = treeViewIn;
}

let intervalId  = null;
let timeoutId   = null;
let showingBusy = false;

function setBusy(busy, blinking = false) {
  if (treeView) 
      treeView.message = busy ? '⟳ Processing Bookmarks ...' : '';
  utils.updateSide();
  if(blinking) return;
  if(busy && !showingBusy) {
    showingBusy = true;
    intervalId = setInterval(() => {
      setBusy(true, true);
        timeoutId = setTimeout(() => {
          setBusy(false, true);
        }, 1000);
    }, 2000);
    setBusy(true);
  }
  if(!busy && showingBusy) {
    showingBusy = false;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
    intervalId = null;
    timeoutId  = null;
    setBusy(false, true);
  }
}
let uniqueItemIdNum = 0;
function getUniqueIdStr() { return (++uniqueItemIdNum).toString(); }

async function getNewFolderItem(mark) {
  const folderName = mark.folderUriPath.split('/').pop();
  const {folderIndex, folderFsPath, folderUriPath} = mark;
  const id    = getUniqueIdStr();
  const label = '📂 ' + folderName;
  const item  = new vscode.TreeItem(
                       label, vscode.TreeItemCollapsibleState.None);
  Object.assign(item, {id, type:'folder', contextValue:'folder', label,
                       folderIndex, folderName, folderFsPath, folderUriPath});
  if(closedFolders.has(folderFsPath))
    item.iconPath = new vscode.ThemeIcon("chevron-right");
  else
    item.iconPath = new vscode.ThemeIcon("chevron-down");
  item.command = {
    command:   'sticky-bookmarks.itemClickCmd',
    title:     'Item Clicked',
    arguments: [item],
  }
  return item;
}     

async function getNewFileItem(mark, children) { 
  const label =  '📄 ' + mark.fileRelUriPath;
  const {document, folderFsPath, folderUriPath, 
                   fileFsPath, fileRelUriPath} = mark;
  const item = new vscode.TreeItem(label,
                   vscode.TreeItemCollapsibleState.Expanded);
  item.id = getUniqueIdStr();
  Object.assign(item, {type:'file', contextValue:'file', 
                       document, children, 
                       folderFsPath, folderUriPath,
                       fileFsPath, fileRelUriPath});
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
  Object.assign(item, {id:getUniqueIdStr(), type:'bookmark', 
                                          contextValue:'bookmark', mark});
  item.command = {
    command: 'sticky-bookmarks.itemClickCmd',
    title:   'Item Clicked',
    arguments: [item],
  }
  return item;
};

let logIdx = 0;

async function getItemTree() {
  // start('getItemTree');
  // log('getItemTree', logIdx++);
  const allWsFolders = vscode.workspace.workspaceFolders;
  if (!allWsFolders) {
    log('getItemTree, No folders in workspace');
    return [];
  }
  const rootItems   = [];
  const marksArray  = Object.values(marks.getAllMarks());
  marksArray.sort((a, b) => {
    if(a.folderIndex > b.folderIndex) return +1;
    if(a.folderIndex < b.folderIndex) return -1;
    if(a.location.toLowerCase() > b.location.toLowerCase()) return +1;
    if(a.location.toLowerCase() < b.location.toLowerCase()) return -1;
    return 0;
  });
  let bookmarks;
  let lastFolderUriPath = null, lastFileFsPath;
  for(const mark of marksArray) {
    if(closedFolders.has(mark.folderFsPath)) continue;
    if(!await utils.fileExists(mark.folderFsPath)) {
       log('err','Folder not in workspace:', mark.folderFsPath);
      await marks.deleteMark(mark);
      continue;
    }
    const markFolderUriPath = mark.folderUriPath;
    if(markFolderUriPath !== lastFolderUriPath) {
      lastFolderUriPath = markFolderUriPath;
      let wsFolder = null;
      while(wsFolder = allWsFolders.shift()) {
        if(wsFolder.uri.path === markFolderUriPath) {
          const {folderIndex, folderName, folderFsPath, folderUriPath} = mark;
          rootItems.push(await getNewFolderItem(
                {folderIndex, folderName, folderFsPath, folderUriPath}));
          break;
        }
        const {index, name, uri} = wsFolder;
        rootItems.push(await getNewFolderItem(
           {folderIndex:index, folderName:name, 
            folderFsPath:uri.fsPath, folderUriPath:uri.path}));
      }
      if(!wsFolder) { 
        log('err', 'Folder missing: ', mark.folderFsPath);
        continue;
      }
      lastFileFsPath = null;
    }
    if(mark.fileFsPath !== lastFileFsPath) {
      lastFileFsPath = mark.fileFsPath;
      bookmarks = [];
      rootItems.push(await getNewFileItem(mark, bookmarks));
    }
    bookmarks.push(await getNewMarkItem(mark));
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document          = editor.document;
    const editorFileFsPath = document.uri.fsPath;
    const editorLine       = editor.selection.active.line;
    if(showPointers) {
      let haveDown  = null;
      let haveExact = null;
      let haveUp    = null;
      for(const item of rootItems) {
        if(item.type === 'file' &&
           item.fileFsPath === editorFileFsPath         &&
           item.children && item.children.length > 0 &&
           !closedFolders.has(item.folderUriPath)) {
          for (const bookmarkItem of item.children) {
            const markLine = bookmarkItem.mark.lineNumber;
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
        haveExact.iconPath  = new vscode.ThemeIcon("triangle-right");
      else {
        if(haveUp)
          haveUp.iconPath   = new vscode.ThemeIcon("triangle-up");
        if(haveDown)
          haveDown.iconPath = new vscode.ThemeIcon("triangle-down");
      }
    }
  }
  let wsFolder = allWsFolders.shift();
  while(wsFolder) {
    rootItems.push(await getNewFolderItem(
        {folderIndex:wsFolder.index, folderName:wsFolder.name, 
         folderFsPath:wsFolder.uri.fsPath, 
         folderUriPath:wsFolder.uri.path}));
    wsFolder = allWsFolders.shift();
  }
  // end('getItemTree');
  itemTree = rootItems;
  return itemTree;
}

function toggleFolder(folderFsPath, forceClose = false, forceOpen = false) {
  log('toggleFolder');
  const open = forceOpen || (!forceClose && closedFolders.has(folderFsPath));
  if(open) closedFolders.delete(folderFsPath);
  else     closedFolders.add(folderFsPath);
  utils.updateSide();
}

async function itemClick(item) {
  log('itemClick');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected'); return; }
  }
  text.clearDecoration();
  switch(item.type) {
    case 'folder': toggleFolder(item.folderFsPath); break;
    case 'file':
      await vscode.window.showTextDocument(item.document, {preview: false});
      break;
    case 'bookmark': await text.bookmarkItemClick(item); break;
  }
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
    if (showingBusy) return [];
    if(!item) {
      await marks.waitForInit();
      return await getItemTree();
    }
    return item.children ?? [];
  }
}

module.exports = {SidebarProvider, init, toggleFolder, setBusy, 
                  itemClick};

