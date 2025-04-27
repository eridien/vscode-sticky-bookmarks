const vscode  = require('vscode');
const sidebar = require('./sidebar.js');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

let context;

function init(contextIn) {
  context = contextIn;
}

async function toggleKeyCmd() {
  log('toggleKeyCmd');
  await text.toggle();
}

async function prevKeyCmd() {
  log('prevKeyCmd');
  await text.scrollToPrevNext(false);
}

async function nextKeyCmd() {
  log('nextKeyCmd');
  await text.scrollToPrevNext(true);
}

//:986b;
async function refreshMark(params) {
  log('refreshMark');
  const {document, position, lineText, token} = params;
  const fileMarksByToken = {};
  const fileFsPath       = document.uri.fsPath;
  const lineNumber       = position.line;
  const globalMark       = marks.getGlobalMark(token);
  if(globalMark && (globalMark.fileFsPath != fileFsPath || 
                    globalMark.lineNumber != lineNumber)) {
    const newMark     = await marks.newGlobalMark(document, lineNumber);
    const newToken    = newMark.token;
    const newLineText = lineText.replace(token, newToken);
    await replaceLineInDocument(document, lineNumber, newLineText);
    haveMarkChg = true;
    log(`refreshMark, replaced duplicate token, ` + 
        `${utils.tokenToDigits(token)} -> `       +
        `${utils.tokenToDigits(newMark.token)}`);    
    return {position, token:newToken};
  }
  return {position, token};
}

//:tuvf;
async function refreshFile(fileFsPath) {
  log('refreshFile');
  const uri      = vscode.Uri.file(fileFsPath);
  const document = await vscode.workspace.openTextDocument(uri);
  let haveMarkChg = false;
  const fileMarks = await runOnAllBookmarksInFile(refreshMark, fileFsPath);
  const globalMarksInFile = marks.getMarksForFile(fileFsPath);
  const tokens = new Set();
  for(const fileMark of fileMarks) {
    const {position, token} = fileMark;
    tokens.add(token);
    if(globalMarksInFile.findIndex(
          (globalMark) => globalMark.token === token) === -1) {
      await marks.newGlobalMark(document, position.line, token);
      haveMarkChg = true;
    }
  }
  for(const globalMark of globalMarksInFile) {
    const token = globalMark.token;
    if(!tokens.has(token)) {
      await marks.delGlobalMark(token);
      haveMarkChg = true;
    }
  }
  if(haveMarkChg) await marks.saveGlobalMarks();
}

//:drpa;
async function refreshFileKeyCmd() {
  log('refreshFileKeyCmd');
  const editor = vscode.window.activeTextEditor;
  if (!editor) { log('info', 'No active text editor'); return; }
  document = editor.document;
  refreshFile(document.uri.fsPath);
}

async function refreshAllFilesKeyCmd() {
  start('refreshAllFilesKeyCmd');
  await runOnAllFoldersInWorkspace(refreshFile, true);
  end('refreshAllFilesKeyCmd');
}

async function deleteFileKeyCmd() {
  log('deleteFileKeyCmd');

}

async function deleteAllFilesKeyCmd() {
  log('deleteAllFilesKeyCmd');

}

async function hideAllTitleCmd() {
  log('hideAllTitleCmd');
  // sidebar.setTreeViewBusyState(true);
  // sidebar.setTreeViewBusyState(false);
}

async function refreshAllTitleCmd() {
  log('refreshAllTitleCmd');

}

async function deleteAllTitleCmd() {
  log('deleteAllTitleCmd');

}

async function eraseNameItemCmd(item) {
  log('eraseNameItemCmd');

}

async function editNameItemCmd(item) {
  log('editNameItemCmd');

}

async function refreshItemCmd(item) {
  log('refreshItemCmd');
  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'refreshItemCmd, No active editor'); return; }
    document = editor.document;
  }
  sidebar.setTreeViewBusyState(true);
  switch (item.type) {
    // case 'folder':   await deleteFolderFilesCmd(item.folderPath); break;
    // case 'file':     await text.refreshFile(document);            break;
  }
  sidebar.setTreeViewBusyState(false);
}

async function deleteItemCmd(item) {
  log('deleteItemCmd');

  if(!document) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { log('info', 'deleteCmd, No active editor'); return; }
    document = editor.document;
  }
  sidebar.setTreeViewBusyState(true);
  switch (item.type) {
    case 'folder':   await utils.runOnAllFilesInFolder(deleteCmd); break;
    case 'file':     await utils.runOnAllFilesInFolder(deleteCmd); break;
    case 'bookmark': await text.delMarkFromLineAndGlobal(
                        item.mark.document, item.mark.lineNumber); break;
  }
  sidebar.setTreeViewBusyState(false);
}

async function clickItemCmd(item) {
  log('clickItemCmd');
  text.clearDecoration();
  switch(item.type) {
    case 'folder': 
      const folderItem = itemTree.find(rootItem => rootItem.id === item.id);
      if(folderItem) {
        if(closedFolders.has(folderItem.folderFsPath))
          closedFolders.delete(folderItem.folderFsPath);
        else
          closedFolders.add(folderItem.folderFsPath);
        utils.updateSidebar();
      }
      break;
    case 'file':
      await vscode.window.showTextDocument(item.document, {preview: false});
      break;
    case 'bookmark': await text.bookmarkClick(item); break;
  }
}

//:i0cp;
async function runOnAllFoldersInWorkspace(func, runOnFiles, runOnBookmarks) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    log('info err', 'No Folders found in workspace'); 
    return; 
  }
  if(runOnFiles) {
    const funcRes = [];
    for (const folder of folders)
     funcRes.push(await runOnAllFilesInFolder(
                                     func, folder.uri.fsPath, runOnBookmarks));
    return funcRes;
  }
  else return folders;
}

//:n762;
async function runOnAllFilesInFolder(func, folderFsPath, runOnBookmarks) {
  folderFsPath ??= getFocusedWorkspaceFolder()?.uri.fsPath;
  if (!folderFsPath) { 
    log('info err', 'Folder not found in workspace'); 
    return; 
  }
  const folderUri = vscode.Uri.file(folderFsPath);
  const pattern   = new vscode.RelativePattern(folderUri, '**/*');
  const files     = await vscode.workspace
                                .findFiles(pattern, '**/node_modules/**');
  if(runOnBookmarks) {
    const funcRes = [];
    for(const file of files) {
      try {
        funcRes.push(await runOnAllBookmarksInFile(func, file.fsPath));
      } catch(_e) {continue}
    }
    return funcRes;
  }
  else return files;
}

//:6d96;
async function runOnAllBookmarksInFile(func, fileFsPath) {
  const uri      = vscode.Uri.file(fsPath);
  const document = await vscode.workspace.openTextDocument(uri);
  const docText  = document.getText();
  const matches  = [...docText.matchAll(text.getTokenRegExG())];
  matches.reverse();
  const funcRes = [];
  for (const match of matches) {
    const offset   = match.index;
    const position = document.positionAt(offset); 
    const lineText = document.lineAt(position.line);
    const token    = match[0];
    funcRes.push(await func({document, docText, position, lineText, token}));
  }
  return funcRes;
}

async function clearAllSavedDataCmd() {
  log('clearAllSavedDataCmd');
  for (const key of context.workspaceState.keys()) {
    await context.workspaceState.update(key, undefined);
  }
  for (const key of context.globalState.keys()) {
    await context.globalState.update(key, undefined);
  }
  log('info', 'All Sticky Bookmarks data has been cleared.');
}

async function resetAllKeysCmd() {
  log('resetAllKeysCmd');
  for (const key of context.workspaceState.keys()) 
    await context.workspaceState.update(key, undefined);
  for (const key of context.globalState.keys()) 
    await context.globalState.update(key, undefined);
  log('info', 'Sticky Bookmarks keybindings reset.');
};

let sidebarIsVisible = false;

async function changedSidebarVisiblitiy(visible) {
  if(visible && !sidebarIsVisible) {
    utils.updateSidebar();
  }
  sidebarIsVisible = visible;
  utils.updateSidebar(); 
}

async function changedDocument() {
  utils.updateSidebar();
}

async function changedEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  utils.updateSidebar();
}

async function changedVisEditors() {
  utils.updateSidebar();
}  

//bookmark
const changedSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.deleteDecoration();
  await text.refreshFile(textEditor.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

const changedText = utils.debounce(async (event) => {
  const {document} = event;
  text.deleteDecoration();
  await text.refreshFile(event.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

module.exports = { init, toggleKeyCmd, prevKeyCmd, nextKeyCmd,
                   refreshFileKeyCmd, refreshAllFilesKeyCmd,
                   deleteFileKeyCmd, deleteAllFilesKeyCmd,
                   hideAllTitleCmd, refreshAllTitleCmd, deleteAllTitleCmd,
                   eraseNameItemCmd, editNameItemCmd,
                   refreshItemCmd, deleteItemCmd, clickItemCmd,
                   clearAllSavedDataCmd, resetAllKeysCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

