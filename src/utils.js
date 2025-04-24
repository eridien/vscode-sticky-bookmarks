const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs').promises;
const {log, start, end}  = getLog('util');

let context, sidebarProvider;

function init(contextIn) {
  context = contextIn;
}

function initProvider(sidebarProviderIn) {
  sidebarProvider = sidebarProviderIn;
}

function updateSidebar() {
  sidebarProvider._onDidChangeTreeData.fire();
}

const closedFolders = new Set();

const timers = {};

let comsByLang = [];
function commentsByLang(langId) {
  return comsByLang[langId] ?? ['//', '']
}

let keywordsStore = {};
function keywords() {
  return keywordsStore;
}

function installBookmarksJson(configText) {
  let configObj;
  try {configObj = JSON.parse(configText)}
  catch(error) {
    logErr(`Error parsing default sticky-bookmarks.json, aborting`, error);
    return false;
  }
  comsByLang = configObj.commentsByLangs;
  if(!comsByLang) {
    log('err info', 'No comment settings in sticky-bookmarks.json, aborting');
    return false;
  }
  keywordsStore = configObj.keywords || {};
  end('loadStickyBookmarksJson');
  return true;
}

function getFocusedWorkspaceFolder() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  return vscode.workspace.getWorkspaceFolder(editor.document.uri);
}

function getTargetWorkspaceFolder() {
  const focused = getFocusedWorkspaceFolder();
  if (focused) return focused;
  const all = vscode.workspace.workspaceFolders;
  return all && all.length > 0 ? all[0] : null;
}

async function workspaceFilePath(relativePath) {
  const folder = getTargetWorkspaceFolder();
  if (!folder) {
    log("No workspace folder available");
    return false;
  }
  return path.join(folder.uri.fsPath, relativePath);
}

async function fileExists(path) {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(path));
    return true;
  } catch (_err) {
    return false;
  }
}

async function workspaceFileExists(relativePath) {
  const filePath = await workspaceFilePath(relativePath);
  if (!filePath) {
    log('err', `No workspace folder for ${relativePath}`);
    return false;
  }
  return fileExists(filePath);
}

async function runOnAllFilesInFolder(func, folderFsPath) {
  folderFsPath ??= getFocusedWorkspaceFolder()?.uri.fsPath;
  if (!folderFsPath) { 
    log('info err', 'Folder not found in workspace'); 
    return; 
  }
  const folderUri = vscode.Uri.file(folderFsPath);
  const pattern   = new vscode.RelativePattern(folderUri, '**/*');
  const files     = await vscode.workspace
                                .findFiles(pattern, '**/node_modules/**');
  for(const file of files) {
    const uri = vscode.Uri.file(file.fsPath);
    let document;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch(_e) {continue}
    await func(document);
  }
}

async function readWorkspaceFile(relativePath) {
  const filePath = await workspaceFilePath(relativePath);
  if (!filePath) {
    log('err', `No workspace folder for ${relativePath}`);
    return null;
  }
  let contents = null;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    logErr(`Error reading file ${relativePath}`, error);
  }
  return contents;
}

async function writeWorkspaceFile(relativePath, textData) {
  const folder    = await getTargetWorkspaceFolder();
  const folderUri = folder.uri;
  const fileUri   = vscode.Uri.joinPath(folderUri, relativePath);
  const encoder   = new TextEncoder();
  const content   = encoder.encode(textData);
  try {
    await vscode.workspace.fs.writeFile(fileUri, content);
  } catch (err) {
    logErr(`Error writing ${relativePath}.`, err);
    return false;
  }
  return true;
}

function getLineFromTextAtOffset(text, offset) {
  const before = text.lastIndexOf('\n', offset - 1);
  const after  = text.indexOf('\n', offset);
  const lineStart = before === -1 ? 0 : before + 1;
  const lineEnd   = after  === -1 ? text.length : after;
  return text.slice(lineStart, lineEnd);
}

function getPathsFromWorkspaceFolder(folder) {   
  if(!folder) return null;
  const uri                = folder.uri;
  const folderIndex        = folder.index;
  const folderName         = folder.name;
  const folderFsPath       = uri.fsPath;
  const folderUriPath      = uri.path;
  const wsPaths = {folderIndex, folderName, folderFsPath, folderUriPath};
  return wsPaths;
}

function getPathsFromFileDoc(doc) {
  if(!doc) return null;
  const uri         = doc.uri;
  const fileFsPath  = uri.fsPath;
  const fileName    = path.basename(fileFsPath);
  const fileUriPath = uri.path;
  const filePaths   = {fileFsPath, fileName, fileUriPath};
  const wsFolder    = vscode.workspace.getWorkspaceFolder(uri);
  const inWorkspace = !!wsFolder;
  if(!inWorkspace) {
    filePaths.inWorkspace = false;
    return filePaths;
  }
  else {
    const wsPaths           = getPathsFromWorkspaceFolder(wsFolder);
    const folderUriPath     = wsPaths.folderUriPath;
    const fileRelUriPath    = fileUriPath.slice( folderUriPath.length + 1);
    const relFilePaths      = {inWorkspace, fileRelUriPath};
    Object.assign(filePaths, wsPaths, relFilePaths);
    return filePaths;
  }
}

async function loadStickyBookmarksJson() {
  start('loadStickyBookmarksJson');
  async function readDefaultConfig() {
    const defaultConfig =
                    await readExtensionFile('sticky-bookmarks.json');
    if(defaultConfig === null) {
      log('err info', 'unable to load sticky-bookmarks.json, aborting.');
      return null;
    }
    return defaultConfig.toString('utf8');
  }
  if(!await workspaceFileExists('sticky-bookmarks.json')) {
    log('sticky-bookmarks.json missing, copying default to workspace');
    const defaultConfig = await readDefaultConfig();
    if(defaultConfig === null) return false;
    const writeOk = await writeWorkspaceFile(
                             'sticky-bookmarks.json', defaultConfig);
    if(!writeOk)
      log('err info', 'Ignoring error and using default config.');
    log('installing default config');
    return installBookmarksJson(defaultConfig);
  }
  let fileTxt = await readWorkspaceFile('sticky-bookmarks.json');
  if(fileTxt === null) {
    log('Ignoring error and using default config.');
    fileTxt = await readDefaultConfig();
    if(fileTxt === null) {
      log('error reading config file in extension, aborting');
      return false;
    }
  }
  return installBookmarksJson(fileTxt);
}

const outputChannel =
         vscode.window.createOutputChannel('Sticky Bookmarks');
outputChannel.clear();
outputChannel.show(true);

function timeInSecs(ms) {
  return (ms / 1000).toFixed(2);
}

function getLog(module) {
  const start = function(name) {
    const startTime = Date.now();
    timers[name]    = startTime;
    const line      = `${module}: ${name} started`;
    // outputChannel.appendLine(line);
    console.log(line);
  }
  const end = function(name) {
    if(!timers[name]) {
      const line = `${module}: ${name} ended`;
      // outputChannel.appendLine(line);
      console.log(line);
      return;
    }
    const endTime  = Date.now();
    const duration = endTime - timers[name];
    const line     = `${module}: ${name} ended, ${timeInSecs(duration)}s`;
    // outputChannel.appendLine(line);
    console.log(line);
  }
  const log = function(...args) {
    let errFlag   = false;
    let infoFlag  = false;
    let nomodFlag = false;
    if(typeof args[0] == 'string') {
      errFlag   = args[0].includes('err');
      infoFlag  = args[0].includes('info');
      nomodFlag = infoFlag || args[0].includes('nomod');
    }
    if(errFlag || infoFlag || nomodFlag) args = args.slice(1);
    const par = args.map(a => {
      if(typeof a === 'object') {
        try{ return JSON.stringify(a, null, 2); }
        catch(e) { return JSON.stringify(Object.keys(a)) + e.message }
      }
      else return a;
    });
    const line = (nomodFlag ? '' : module + ': ') +
                 (errFlag    ? ' error, ' : '') + par.join(' ')
    // outputChannel.appendLine(line);
    if(errFlag) console.error(line);
    else        console.log(line);
    if(infoFlag) vscode.window.showInformationMessage(line);
  }
  return {log, start, end};
}

function logErr(message, event) {
  log('info err', message);
  log('err', event.message);
}

async function readExtensionFile(filename) {
  const filePath = path.join(context.extensionPath, ".", filename);
  const fileUri = vscode.Uri.file(filePath);
  try {
    return await vscode.workspace.fs.readFile(fileUri);
  } catch (error) {
    log('err', "readExtensionFile Error reading file:", error.message);
    return null;
  }
}

function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString();
}

async function deleteLine(document, lineNumber) {
  const line = document.lineAt(lineNumber); 
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, line.rangeIncludingLineBreak); 
  await vscode.workspace.applyEdit(edit);
}

async function insertLine(document, lineNumber, lineText) {
  const position = new vscode.Position(lineNumber, 0);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, position, lineText + '\n');
  return await vscode.workspace.applyEdit(edit);
}

async function replaceLine(document, lineNumber, lineText) {
  const line = document.lineAt(lineNumber);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, lineText);
  return await vscode.workspace.applyEdit(edit);
}

function debounce(fn, delay = 100) {
  let timeout;
  let pendingResolve;
  return function (...args) {
    return new Promise(resolve => {
      clearTimeout(timeout);
      if (pendingResolve) pendingResolve(undefined); // cancel previous
      pendingResolve = resolve;
      timeout = setTimeout(async () => {
        const result = await fn.apply(this, args);
        resolve(result);
        pendingResolve = null;
      }, delay);
    });
  };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

module.exports = {
  init, getLog, fnv1aHash, loadStickyBookmarksJson,
  commentsByLang, keywords, fileExists, getLineFromTextAtOffset,
  deleteLine, insertLine, replaceLine, debounce, sleep,
  getPathsFromWorkspaceFolder, getPathsFromFileDoc,
  runOnAllFilesInFolder, getFocusedWorkspaceFolder, initProvider,
  updateSidebar
}

