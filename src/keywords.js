const utils  = require('./utils.js');
// const log    = utils.getLog('KEYW');

const keywordSetsByLang = {};

async function init() {
  const text = await utils.readTxt(true, 'keywords.json');
  const json = JSON.parse(text);
  for(const [lang, keywords] of Object.entries(json)) {
    const set = new Set(keywords);
    keywordSetsByLang[lang] = set;
  }
}

function isKeyWord(languageId, word) {
  return keywordSetsByLang[languageId].has(word);
}

module.exports = { init, isKeyWord };