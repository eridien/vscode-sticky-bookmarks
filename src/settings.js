const vscode = require('vscode');
const utils  = require('./utils.js');
const log    = utils.getLog('sett');

let config = null;

function init() {
  config = vscode.workspace.getConfiguration('sticky-bookmarks');
}

const settingCallbacks = {};
const settings = [
  'ignoreFilePatterns'
]

function logSettings() {
  for(const setting in settings) {
    if(settingCallbacks.hasOwnProperty(setting)) {
      log(`setting ${setting}: ${settings[setting]}`);
    }
  }
}

async function updateSetting(name, value) {
  await config.update(name, value, vscode.ConfigurationTarget.Workspace);
  log(`updated setting ${name} to ${value}`);
}

function registerSettingCallback(settingName, callback) {
  settingCallbacks[settingName] = callback;
}

vscode.workspace.onDidChangeConfiguration((event) => {
  for(const setting of settings) {
    const settingName = `sticky-bookmarks.${setting}`;
    if (event.affectsConfiguration(settingName)) {
      const value = vscode.workspace.getConfiguration().get(settingName);
      let prtValue = value;
      if(typeof value === 'object')
        prtValue = JSON.stringify(value, null, 2);
      log(`setting ${setting} changed to: ${prtValue}`);
      if(settingCallbacks[setting]) settingCallbacks[setting](value);
    }
  }
})


let ignorePatternRegexes = [];

function parseAndSaveIgnoreFilePatterns(strIn) {
  const partsIn = strIn.split(',').map(part => part.trim());
  const ignoreFilePatterns = [];
  for(let i=0; i < partsIn.length; i++) {
    const part     = partsIn[i];
    const nextPart = partsIn[i+1];
    if(part === "") {
      if(ignoreFilePatterns.length > 0 && i < partsIn.length-1 && nextPart !== "") {
        ignoreFilePatterns[ignoreFilePatterns.length-1] += (',' + partsIn[i+1]);
        i++;
      }
      continue;
    }
    ignoreFilePatterns.push(part);
  }
  ignorePatternRegexes = ignoreFilePatterns.map(pattern => RegExp(pattern));
}
registerSettingCallback('ignoreFilePatterns', parseAndSaveIgnoreFilePatterns);

// called on activation
function setIgnoreFilePatterns() {
  const ignoreFilePatternStr = config.get('ignoreFilePatterns');
  parseAndSaveIgnoreFilePatterns(ignoreFilePatternStr);
}

function getMinCharPos() {
  return 80;
}

module.exports = { init, logSettings, updateSetting, getMinCharPos,
                   registerSettingCallback };
