
import * as vsc from 'vscode'
import { ZigHost } from 'zigparse'
import { Declaration, VariableDeclaration, FunctionDeclaration, EnumDeclaration, FunctionArgumentDeclaration, StructDeclaration, ContainerDeclaration, MemberField, ErrorDeclaration, ErrorIdentifier, EnumMember } from 'zigparse/lib/ast'


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
  if (decl.is(ErrorDeclaration))
    return k.Enum
  if (decl.is(ErrorIdentifier))
    return k.EnumMember
  return k.Value
}

const s = vsc.SymbolKind
const sm = new Map<typeof Declaration, vsc.SymbolKind>()
.set(VariableDeclaration, s.Variable)
.set(FunctionDeclaration, s.Function)
.set(FunctionArgumentDeclaration, s.Function)
.set(EnumDeclaration, s.Enum)
.set(EnumMember, s.EnumMember)
.set(MemberField, s.Field)

export function symbolkind (decl: Declaration): vsc.SymbolKind {
  return sm.get(decl.constructor as any) || s.Null
}
export class ZigCompletionProvider implements
  vsc.CompletionItemProvider,
  vsc.DocumentSymbolProvider,
  vsc.HoverProvider
{

  public host!: ZigHost

  constructor(public log: vsc.OutputChannel) {
    this.trylog(() => {
      const config = vsc.workspace.getConfiguration('zig');
      const zigPath = config.get<string>('zigPath') || 'zig';
      this.log.appendLine(zigPath)
      this.host = new ZigHost(zigPath)
    })
  }

  trylog(fn: () => void) {
    try {
      fn()
    } catch (e) {
      this.log.appendLine(`error: ${e.message}`)
      this.log.appendLine(`${e.stack}`)
    }
  }

  provideCompletionItems(doc: vsc.TextDocument, pos: vsc.Position, tok: vsc.CancellationToken) {
    const f = this.host.addFile(doc.fileName, doc.getText())
    try {
      var res = f.getCompletionsAt(doc.offsetAt(pos))
      // this.log.appendLine(`${res.length} completions`)
      if (res) {
        return res.map(decl => {
          var cpl = new vsc.CompletionItem(decl.fullName(), kind(decl))
          cpl.insertText = decl.name
          cpl.filterText = decl.name
          cpl.documentation = decl.doc ? new vsc.MarkdownString(decl.doc) : ''
          cpl.commitCharacters = ['.', ',', ')']
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

  provideHover(doc: vsc.TextDocument, pos: vsc.Position, token: vsc.CancellationToken): vsc.ProviderResult<vsc.Hover> {
    const f = this.host.addFile(doc.fileName, doc.getText())
    const offset = doc.offsetAt(pos)
    var decl = f.getDeclarationAt(offset)
    if (decl) {
      var hov = new vsc.Hover(decl.fullName().replace(/\*/g, '\\*'))
      return hov
    }
    return null
  }

}