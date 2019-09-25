
import * as vsc from 'vscode'
import { getCompletions } from 'zigparse'

export class ZigCompletionProvider implements vsc.CompletionItemProvider {

  constructor(public log: vsc.OutputChannel) { }

  provideCompletionItems(doc: vsc.TextDocument, pos: vsc.Position, tok: vsc.CancellationToken) {
    try {
      var res = getCompletions(doc.fileName, doc.getText(), doc.offsetAt(pos), (st) => this.log.appendLine(st))
      this.log.appendLine(JSON.stringify(res))
      return [new vsc.CompletionItem('vooovk', vsc.CompletionItemKind.Value)]
    } catch(e) {
      this.log.appendLine('error: ' + e.message);
      this.log.appendLine(e.stack)
      return []
    }
  }

  resolveCompletionItem(item: vsc.CompletionItem, tok: vsc.CancellationToken) {
    return item
  }

}