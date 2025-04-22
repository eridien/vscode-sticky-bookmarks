const vscode = require('vscode');
const text   = require('./text.js');
const marks  = require('./marks.js');
const utils  = require('./utils.js');
const {log, start, end}  = utils.getLog('side');

const showPointers = true;

let sidebarProvider, itemTree = [];

const closedFolders = new Set();

function init(sidebarProviderIn) {
  sidebarProvider = sidebarProviderIn;
}

async function getNewFolderItem(mark) {
  const {folderIndex, folderName, folderFsPath, folderUriPath} = mark;
  const id    = utils.fnv1aHash(folderUriPath);
  const label = '📂 ' + folderName;
  const item  = new vscode.TreeItem(label,
                    vscode.TreeItemCollapsibleState.None);
  Object.assign(item, {id, type:'folder', label,
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

// let fileWithPtrFsPath = null;

//bookmark:d6bh;
async function updatePointers(editor) {
  if(showPointers) {
    const fsPath        = editor.document.uri.fsPath;
    const selectionLine = editor.selection.active.line;
    let itemDown  = null;
    let itemExact = null;
    let itemUp    = null;
    for(const item of itemTree) {
      if(item.type === 'file' && !closedFolders.has(item.folderFsPath) && 
              item.children.length > 0) {
        // if (fsPath !== fileWithPtrFsPath && 
        //     item.fileFsPath === fileWithPtrFsPath) {
        //   for (const bookmarkItem of item.children)
        //       delete bookmarkItem.iconPath;
        //   continue;
        // }
        if(item.fileFsPath === fsPath) {
          for (const bookmarkItem of item.children)
              delete bookmarkItem.iconPath;
          for (const bookmarkItem of item.children) {
            const bookmarkLine = bookmarkItem.mark.lineNumber;
            if(selectionLine === bookmarkLine) {
              itemExact = bookmarkItem;
              break;
            }
            else if(selectionLine < bookmarkLine)  {
              itemUp = bookmarkItem;
              break;
            }
            else if(selectionLine > bookmarkLine) {
              itemDown = bookmarkItem;
            }
          }
        }
      }
    }
    if(itemExact) {
      // fileWithPtrFsPath  = itemExact.fileFsPath;
      itemExact.iconPath = new vscode.ThemeIcon("triangle-right");
    }
    else {
      if(itemUp) {
        // fileWithPtrFsPath = itemUp.fileFsPath;
        itemUp.iconPath   = new vscode.ThemeIcon("triangle-up");
      }
      if(itemDown) {
        // fileWithPtrFsPath =  itemDown.fileFsPath;
        itemDown.iconPath = new vscode.ThemeIcon("triangle-down");
      }
    }
  }
}

let logIdx = 0;

//bookmark:w2jy;
async function getItemTree() {
  start('getItemTree');
  log('getItemTree', logIdx++);
  const allWsFolders = vscode.workspace.workspaceFolders;
  if (!allWsFolders) {
    log('getItemTree, No folders in workspace');
    return [];
  }
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
  let bookmarks;
  let lastFolderUriPath = null, lastFileFsPath;
  for(const mark of marksArray) {
    // log('mark of marksArray', mark);
    if(closedFolders.has(mark.folderFsPath)) continue;
    if(!mark.inWorkspace || 
       !await utils.fileExists(mark.folderFsPath)) {
      log('Folder missing or mark not in workspace(1), '+
          'deleting globalMark:', mark.token, mark.folderName);
      marks.delGlobalMark[mark.token];
      await marks.saveGlobalMarks();
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
        marks.delGlobalMark[mark.token];
        await marks.saveGlobalMarks();
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
  //bookmark:jt4x;
  itemTree = rootItems;
  const editor = vscode.window.activeTextEditor;
  if (editor) await updatePointers(editor);
  let wsFolder = allWsFolders.shift();
  while(wsFolder) {
    rootItems.push(await getNewFolderItem(
        {folderIndex:wsFolder.index, folderName:wsFolder.name, 
         folderFsPath:wsFolder.uri.fsPath, 
         folderUriPath:wsFolder.uri.path}));
    wsFolder = allWsFolders.shift();
  }
  end('getItemTree');
  return rootItems;
}

async function itemClickCmd(item) {
  text.clearDecoration();
  if(item.type === 'folder') {
    const folderItem = 
           itemTree.find(rootItem => rootItem.id === item.id);
    if(folderItem) {
      if(closedFolders.has(folderItem.folderFsPath))
         closedFolders.delete(folderItem.folderFsPath);
      else
         closedFolders.add(folderItem.folderFsPath);
      updateSidebar();
    }
    return;
  }
  if(item.type === 'bookmark') {
    await text.bookmarkClick(item);
  }
}

function updateSidebar() {
  sidebarProvider._onDidChangeTreeData.fire();
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

module.exports = { init, SidebarProvider, itemClickCmd};


