
import * as vsc from 'vscode'
import { ZigHost } from 'zigparse'
import { Declaration, VariableDeclaration, FunctionDeclaration, EnumDeclaration, FunctionArgumentDeclaration, StructDeclaration, ContainerDeclaration, MemberField } from 'zigparse/lib/ast'


// Should also do
// - registerDefinitionProvider : goto definition
// - registerSignatureHelpProvider : function stuff ! nice to have !
// - registerHoverProvider : show type and info about the symbol // Maybe leave that to Zig.
// - registerRenameProvider // TRICKY ONE.

const k = vsc.CompletionItemKind
export function kind (decl: Declaration): vsc.CompletionItemKind {
  if (decl.is(VariableDeclaration))
    return k.Variable
  if (decl.is(FunctionDeclaration) || decl.is(FunctionArgumentDeclaration))
    return k.Function
  if (decl.is(EnumDeclaration))
    return k.Enum
  if (decl.is(StructDeclaration))
    return k.Struct
  return k.Value
}

const s = vsc.SymbolKind
export function symbolkind (decl: Declaration): vsc.SymbolKind {
  if (decl.is(VariableDeclaration))
    return s.Variable
  if (decl.is(FunctionDeclaration) || decl.is(FunctionArgumentDeclaration))
    return s.Function
  if (decl.is(EnumDeclaration))
    return s.Enum
  if (decl.is(StructDeclaration))
    return s.Struct
  if (decl instanceof MemberField)
    return s.Field
  return s.Null
}
export class ZigCompletionProvider implements
  vsc.CompletionItemProvider,
  vsc.DocumentSymbolProvider
{

  host = new ZigHost()
  constructor(public log: vsc.OutputChannel) { }

  provideCompletionItems(doc: vsc.TextDocument, pos: vsc.Position, tok: vsc.CancellationToken) {
    const f = this.host.addFile(doc.fileName, doc.getText())
    try {
      var res = f.getCompletionsAt(doc.offsetAt(pos))
      if (res) {
        return res.map(decl => {
          var cpl = new vsc.CompletionItem(decl.name, kind(decl))
          return cpl
        })
      }
      // var res = getCompletions(doc.fileName, doc.getText(), doc.offsetAt(pos), (st) => this.log.appendLine(st))
      // this.log.appendLine(JSON.stringify(res))
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

  provideDocumentSymbols(doc: vsc.TextDocument, token: vsc.CancellationToken) { // : ProviderResult<SymbolInformation[]> {
    const f = this.host.addFile(doc.fileName, doc.getText())
    try {
      function make_symbol(d: Declaration) {
        var parents = [] as string[]
        var iter = d.parent
        while (iter && iter.name) {
          parents.unshift(iter.name)
          iter = iter.parent
        }

        return new vsc.SymbolInformation(d.name, symbolkind(d), parents.join('.'), new vsc.Location(
          vsc.Uri.file(doc.fileName),
          doc.positionAt(d.position.start.start)
        ))
      }

      var res = f.mapDeclarations(d => {
        if (!d.name) return

        if (d.is(VariableDeclaration) && (d.parent instanceof FunctionDeclaration) || d.is(FunctionArgumentDeclaration))
          // do not show function variables
          return

        if (d instanceof VariableDeclaration || d instanceof ContainerDeclaration || d instanceof FunctionDeclaration)
          return make_symbol(d)
      })
      // this.log.appendLine('SAASDASD ' + res.length)
      return res
    } catch (e) {
      this.log.appendLine(`symbols error: ${e.message}`)
      return []
    }
  }

}