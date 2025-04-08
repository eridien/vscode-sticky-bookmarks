const vscode = require('vscode');

class SidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    return Promise.resolve([
      new vscode.TreeItem('file 1'),
      new vscode.TreeItem('file 2')
    ]);
  }
}

module.exports = { SidebarProvider };
