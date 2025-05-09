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

async function getNewFolderItem(mark, wsFolder) {
  const id        = getUniqueIdStr();
  const label     = '📂 ' + (mark ? mark.folderName() : wsFolder.name);
  const item      = new vscode.TreeItem(
                       label, vscode.TreeItemCollapsibleState.None);
  Object.assign(item, {id, type:'folder', contextValue:'folder', label});
  item.command = {
    command:   'sticky-bookmarks.itemClickCmd',
    title:     'Item Clicked',
    arguments: [item],
  }
  if(!mark) {
    item.iconPath = new vscode.ThemeIcon("chevron-down");
    item.wsFolder = wsFolder;
    return item;
  }
  item.mark     = mark;
  item.wsFolder = mark.wsFolder();
  if(closedFolders.has(mark.folderFsPath()))
    item.iconPath = new vscode.ThemeIcon("chevron-right");
  else
    item.iconPath = new vscode.ThemeIcon("chevron-down");
  return item;
}     

async function getNewFileItem(mark, children) { 
  const label =  '📄 ' + mark.fileRelUriPath();
  const item = new vscode.TreeItem(label,
                   vscode.TreeItemCollapsibleState.Expanded);
  item.id = getUniqueIdStr();
  Object.assign(item, {type:'file', contextValue:'file', children, mark});
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
  start('getItemTree', true);
  // log('getItemTree', logIdx++);
  const allWsFolders = vscode.workspace.workspaceFolders;
  if (!allWsFolders) {
    log('getItemTree, No folders in workspace');
    return [];
  }
  const rootItems   = [];
  const marksArray  = Object.values(marks.getAllMarks());
  marksArray.sort((a, b) => {
    if(a.locStrLc() > b.locStrLc()) return +1;
    if(a.locStrLc() < b.locStrLc()) return -1;
    return 0;
  });
  let bookmarks;
  let lastFolderUriPath = null, lastFileFsPath;
  for(const mark of marksArray) {
    if(closedFolders.has(mark.folderFsPath())) continue;
    if(!await utils.fileExists(mark.folderFsPath())) {
      log('err','Folder not in workspace:', mark.folderName());
      continue;
    }
    if( mark.folderUriPath() !== lastFolderUriPath) {
      lastFolderUriPath =  mark.folderUriPath();
      let wsFolder = null;
      while(wsFolder = allWsFolders.shift()) {
        if(wsFolder.uri.fsPath ===  mark.folderFsPath()) {
          rootItems.push(await getNewFolderItem(mark));
          break;
        }
        const {index, name, uri} = wsFolder;
        rootItems.push(await getNewFolderItem(mark));
      }
      if(!wsFolder) { 
        log('err', 'Folder missing: ', mark.folderName());
        continue;
      }
      lastFileFsPath = null;
    }
    if(mark.fileFsPath() !== lastFileFsPath) {
      lastFileFsPath = mark.fileFsPath();
      bookmarks = [];
      rootItems.push(await getNewFileItem(mark, bookmarks));
    }
    bookmarks.push(await getNewMarkItem(mark));
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document         = editor.document;
    const editorFileFsPath = document.uri.fsPath;
    const editorLine       = editor.selection.active.line;
    if(showPointers) {
      let haveDown  = null;
      let haveExact = null;
      let haveUp    = null;
      for(const item of rootItems) {
        if(item.type === 'file' &&
           item.mark.fileFsPath() === editorFileFsPath &&
           item.children && item.children.length > 0   &&
           !closedFolders.has(item.mark.folderFsPath())) {
          for (const bookmarkItem of item.children) {
            const markLine = bookmarkItem.mark.lineNumber();
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
    rootItems.push(await getNewFolderItem(null, wsFolder));
    wsFolder = allWsFolders.shift();
  }
  end('getItemTree');
  itemTree = rootItems;
  return itemTree;
}

function toggleFolder(item, forceClose = false, forceOpen = false) {
  log('toggleFolder');
  if(item.wsFolder)
     closedFolders.delete(item.wsFolder.uri.fsPath);
  else {
    const folderFsPath = item.mark.folderFsPath();
    const open = forceOpen || (!forceClose && closedFolders.has(folderFsPath));
    if(open) closedFolders.delete(folderFsPath);
    else     closedFolders.add(folderFsPath);
  }
  utils.updateSide();
}

async function itemClick(item) {
  // log('itemClick');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected'); return; }
  }
  text.clearDecoration();
  switch(item.type) {
    case 'folder': toggleFolder(item); break;
    case 'file':
      await vscode.window.showTextDocument(marks.getDocument(item.mark),
                                           {preview: false});
      break;
    case 'bookmark': await text.bookmarkItemClick(item); break;
  }
}

module.exports = {SidebarProvider, init, toggleFolder, setBusy, 
                  itemClick};

