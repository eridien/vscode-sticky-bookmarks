const vscode = require('vscode');
const text   = require('./text.js');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log}  = utils.getLog('side');

const showPointers = true;

let provider, itemTree;

const closedFolders = new Set();

async function init(providerIn) {
  provider  = providerIn;
  return updateSidebar;
}

//:7rlm;
async function getNewFolderItem(mark) {
  const {folderIndex, folderName, folderFsPath, folderUriPath} = mark;
  const id    = utils.fnv1aHash(folderUriPath);
  const label = '📂 ' + folderName;
  const item  = new vscode.TreeItem(label,
                    vscode.TreeItemCollapsibleState.None);
  Object.assign(item, {id, type:'folder', label,
                       folderIndex, folderName, folderFsPath, folderUriPath});
  if(closedFolders.has(folderUriPath))
    item.iconPath = new vscode.ThemeIcon("chevron-right");
  else
    item.iconPath = new vscode.ThemeIcon("chevron-down");
  item.command = {
    command:   'sticky-bookmarks.itemClickCmd',
    title:     'Item Clicked',
    arguments: [item],
  }
  // if(item.id == lastFolderId) debugger;
  // lastFolderId =  item.id;

  // log('');
  // log('folder', item.folderName, item.id);
  return item;
}

//:aguf;
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
  // log('file  ', item.fileName, item.id);
  return item;
};

//:r8z9;
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
  // log('mark  ', item.label.slice(0,30), item.id);
  return item;
};

//:ufim;
async function getItemTree() {
  const allWsFolders = vscode.workspace.workspaceFolders;
  if (!allWsFolders) {
    log('getItemTree, No folders in workspace');
    return [];
  }
  // log('getItemTree', ++itemTreeLogCount);
  const rootItems   = [];
  const marksArray  = Object.values(marks.getGlobalMarks());
  marksArray.sort((a, b) => {
    if(a.folderIndex > b.folderIndex) return +1;
    if(a.folderIndex < b.folderIndex) return -1;
    if(a.folderUriPath.toLowerCase() >
       b.folderUriPath.toLowerCase()) return +1;
    if(a.folderUriPath.toLowerCase() <
       b.folderUriPath.toLowerCase()) return -1;
    if(a.fileRelUriPath.toLowerCase() >
       b.fileRelUriPath.toLowerCase()) return +1;
    if(a.fileRelUriPath.toLowerCase() <
       b.fileRelUriPath.toLowerCase()) return -1;
    return (a.lineNumber - b.lineNumber);
  });
//:hx8x;
  let bookmarks;
  let lastFolderUriPath = null, lastFileFsPath;
  for(const mark of marksArray) {
    // log('mark of marksArray', mark);
    if(closedFolders.has(mark.folderUriPath)) continue;
    if(!mark.inWorkspace || 
       !await utils.fileExists(mark.folderFsPath)) {
      log('Folder missing or mark not in workspace(1), '+
          'deleting globalMark:', mark.token, mark.folderName);
      await marks.delGlobalMark(mark.token);
      continue;
    }
    const markFolderUriPath = mark.folderUriPath;
    if(markFolderUriPath !== lastFolderUriPath) {
      lastFolderUriPath = markFolderUriPath;
      let wsFolder = null;
      while(wsFolder = allWsFolders.shift()) {
        // log('wsFolder = allWsFolders.shift()', wsFolder);
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
        log('Folder missing or mark not in workspace(2), '+
            'deleting globalMark:', mark.token, mark.folderName);
        await marks.delGlobalMark(mark.token);
        continue;
      }
      lastFileFsPath = null;
    }
    if(mark.fileFsPath !== lastFileFsPath) {
      lastFileFsPath = mark.fileFsPath;
      bookmarks = [];
      rootItems.push(await getNewFileItem(mark, bookmarks));
    }
//:4s9h;
    bookmarks.push(await getNewMarkItem(mark));
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document       = editor.document;
    const editorFilePath = document.uri.path;
    const editorLine     = editor.selection.active.line;
    if(showPointers) {
      let haveDown  = null;
      let haveExact = null;
      let haveUp    = null;
      for(const item of rootItems) {
        if(item.type === 'file' &&
           item.fileUriPath === editorFilePath &&
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
  itemTree = rootItems;
  return rootItems;
}

//:9lza;
async function itemClickCmd(item) {
  // log('itemClickCmd');
  text.clearDecoration();
  if(item.type === 'folder') {
    const folderItem = 
           itemTree.find(rootItem => rootItem.id === item.id);
    if(folderItem) {
      if(closedFolders.has(folderItem.folderUriPath))
         closedFolders.delete(folderItem.folderUriPath);
      else
         closedFolders.add(folderItem.folderUriPath);
      updateSidebar();
    }
    return;
  }
  if(item.type === 'bookmark') {
    await text.bookmarkClick(item);
  }
}

//:0qrj;
function updateSidebar(item) {
  provider._onDidChangeTreeData.fire(item);
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

module.exports = { init, SidebarProvider, itemClickCmd, updateSidebar};


