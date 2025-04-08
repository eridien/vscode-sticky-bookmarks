const vscode = require('vscode');

class SidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    return Promise.resolve([
      this.createItem('file 1'),
      this.createItem('file 2')
    ]);
  }

  createItem(label) {
    return {
      label,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'sticky-bookmarks.itemClick',
        title: 'Item Clicked',
        arguments: [{ label, arg2:{arg21:'arg21'} }]
      }
    };
  }
}


module.exports = { SidebarProvider };
