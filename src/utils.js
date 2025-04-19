const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs').promises;
const {log, start, end}  = getLog('util');

const timers = {};

function init(contextIn) {
  context = contextIn;
  log('utils initialized');
  return {};
}

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
    logErr(`Error parsing default sticky-bookmarks.json, aborting`,
            error);
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

function getFocusedWorkspaceFolder() {                                 //:1vxx;
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

async function fileExists(path) {                                      //:qynh;
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

function getPathsFromWorkspaceFolder(folder) {   
  if(!folder) return null;
  const uri         = folder.uri;
  const folderIndex = folder.index;
  const folderName  = folder.name;

  // Absolute paths
  const absFsPath = uri.fsPath;
  const absFolderName = path.basename(absFsPath);  // folder name only
  const absParentFolder = path.dirname(absFsPath); // full path of parent
  // URI-style absolute path
  const absUriPath = uri.path;
  const absWsPaths = {folderIndex, folderName, absFsPath, 
                      absFolderName, absParentFolder, absUriPath};
  // Workspace-relativ`e paths
  const relUriPath = vscode.workspace.asRelativePath(uri);
  const relFolderName = path.basename(relUriPath);
  const relParent = path.dirname(relUriPath);
  const relWsPaths = {relUriPath, relFolderName, relParent}
  const wsPaths = Object.assign(absWsPaths, relWsPaths);
  log('getPathsFromWorkspaceFolder', wsPaths);  
  return wsPaths;
}

function getPathsFromFileDoc(doc) {                                       //:a16m;
  if(!doc) return null;
  const uri = doc.uri;
  // Absolute (platform-specific)
  const absFsPath = uri.fsPath;
  const absFile   = path.basename(absFsPath);
  const absFolder = path.dirname(absFsPath);
  const absUriPath = uri.path; // URI-style absolute path
  const filePaths = {absFsPath, absFile, absFolder, absUriPath};
  // Relative to workspace
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const inWorkspace = !!workspaceFolder;
  if(!inWorkspace) {
    filePaths.inWorkspace = false;
    log('getPathsFromFileDoc', filePaths);
  }
  else {
    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    const wsPaths = getPathsFromWorkspaceFolder(wsFolder);
    const relFsPath =  path.relative(workspaceFolder.uri.fsPath, absFsPath);
    const relFolder = path.dirname(relFsPath);
    const relFile = path.basename(relFsPath);
    const relUriPath = vscode.workspace.asRelativePath(uri);
    const folderUriPath = wsPaths.absUriPath;
    const fileUriPath = absUriPath;
    const fileRelUriPath = fileUriPath.slice( folderUriPath.length + 1);
    const relFilePaths = 
            { inWorkspace, relFsPath, relFolder, relFile, relUriPath, fileRelUriPath };
    Object.assign(filePaths, wsPaths, relFilePaths);
    log('getPathsFromFileDoc', filePaths);
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
    outputChannel.appendLine(line);
    console.log(line);
  }
  const end = function(name) {
    if(!timers[name]) {
      const line = `${module}: ${name} ended`;
      outputChannel.appendLine(line);
      console.log(line);
      return;
    }
    const endTime = Date.now();
    const duration = endTime - timers[name];
    const line      = `${module}: ${name} ended, ${timeInSecs(duration)}s`;
    outputChannel.appendLine(line);
    console.log(line);
  }
  const log = function(...args) {
    let errFlag    = false;
    let infoFlag   = false;
    let nomodFlag = false;
    if(typeof args[0] == 'string') {
      errFlag    = args[0].includes('err');
      infoFlag   = args[0].includes('info');
      nomodFlag = infoFlag || args[0].includes('nomod');
    }
    if(errFlag || infoFlag) args = args.slice(1);
    const par = args.map(a =>
      typeof a === 'object' ? JSON.stringify(a, null, 2) : a);
    const line = (nomodFlag ? '' : module + ': ') +
                 (errFlag    ? ' error, ' : '') + par.join(' ')
    outputChannel.appendLine(line);
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

module.exports = {
  init, getLog, fnv1aHash, loadStickyBookmarksJson,
  commentsByLang, keywords, fileExists,
  getPathsFromWorkspaceFolder, getPathsFromFileDoc
}

