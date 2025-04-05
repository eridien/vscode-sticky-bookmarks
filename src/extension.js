const vscode = require('vscode');
const main   = require('./main.js');
const utils  = require('./utils.js');
const log    = utils.getLog('EXTN');

function activate(context) {
  main.init(context);
  utils.init(context);
	const toggleCmd = vscode.commands.registerCommand(
                        'sticky-bookmarks.toggle', function () {
		main.toggle();
	});
	context.subscriptions.push(toggleCmd);
  log('activated');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
