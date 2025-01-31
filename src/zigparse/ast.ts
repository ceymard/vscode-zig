import { File } from "./host"
import { Lexeme, Opt, Balanced, any, Z, Either, Seq, separated_by, third, T, Token, S, SeqObj } from "./libparse"

export const ident = Token(T.IDENT).map(i => i.str.replace(/@"/, '').replace(/"$/, ''))

// getMembers is wrong for a scope as it has no members.
// a scope only serves to resolve a declaration.
// the problem is mainly because functions / enums are scopes but are also **values**
// I Should create the file scope

// first, it's get variable by name
// then, we go along the member chain

// getMembers() is used when something is used as a value.
// getInstanceMembers() is only used on containers.

/**
 * A resolvable expression, where operators are ignored and we only care about
 * symbols (and function calls).
 */
const modified_ident = SeqObj({
  // pointers and such
  pointer_access: Z(Either('*', '&')),
  array_def: Z(Balanced('[', any, ']')),
  kw_const: Opt('const'),
  ident,
  // several chained array access
  array_index: Z(Balanced('[', any, ']')),
})
.map(({ident}) => (from_decl: Declaration, only_public: boolean) => {
  var decl = from_decl.getMemberByName(ident, only_public)
  return {decl, pubs: only_public}
})

// const star = ;
const potential_fncall = SeqObj({
  id: modified_ident,
  is_fn: Opt(Balanced('(', any, ')')),
}).map(({id, is_fn}) => (from_decl: Declaration, only_public: boolean) => {
  var {decl, pubs} = id(from_decl, only_public)

  if (is_fn && decl && decl.is(FunctionDeclaration)) {
    // fake variable declaration
    decl = new VariableDeclaration()
      .set('type', decl.return_type)
      .set('file', decl.file)
      .set('parent', decl.parent)
  }
  // FIXME : should check for function call. but we would need to know if being called from a value
  // or not.
  return { pubs, decl: decl}
})


const cimport = SeqObj({
  start: '@cImport',
  contents: Balanced('(', any, ')')
})
.map(() => (from_decl: Declaration) => {
  var f = from_decl.file.host.getCFile()
  return { pubs: false, decl: f ? f.scope : null }
})


const impor = SeqObj({
  _import: '@import',
  lparent: '(',
  pth: T.STR,
  rparen: ')'
}).map(({pth}) => (from_decl: Declaration) => {
  // ignore the previous declaration
  var the_file = from_decl.file.host.getZigFile(from_decl.file.path, pth.str.replace(/"/g, ''))
  if (!the_file) return null
  return { pubs: true, decl: the_file.scope }
})


export const resolvable_outer_expr = SeqObj({
  _try: Opt('try'),
  _err: Opt(Seq(any, '!')),
  lst: separated_by('.', Either(cimport, impor, potential_fncall)),
}).map(({lst}) => {
  return (decl: Scope): Declaration | null => {
    if (lst.length === 0) return null
    var resolve = (decl: Declaration, pubs: boolean, index: number): Declaration | null => {
      var res = lst[index](decl, pubs)
      if (!res || !res.decl) return null
      if (index === lst.length - 1) return res.decl
      return resolve(res.decl, res.pubs, index + 1)
    }
    return resolve(new FakeScopeResolver(decl), false, 0)
  }
})


const spaces: {[name: string]: string} = {
  const: 'const ',
  extern: 'extern ',
}

export function reJoin(lex: Lexeme[] | null, prefix = '') {
  if (!lex) return ''
  // fixme need list of rejoinders
  return prefix + lex.map(l => spaces[l.str] ? spaces[l.str] : l.str).join('')
}


export class PropertyChainer {
  is<T extends {new (...a: any[]): any}>(kls: T): this is InstanceType<T> {
    return this.constructor === kls
  }

  set<K extends keyof this>(k: K, value: this[K]) {
    this[k] = value
    return this
  }
}


export class Position {
  constructor(
    /**
     * The first lexeme of this element
     */
    public start: Lexeme,

    /**
     * The last lexeme position of this element
     */
    public end: Lexeme,
  ) { }
}


export class PositionedElement extends PropertyChainer {
  position!: Position
  file!: File

  setFile(f: File) {
    this.file = f
  }
}


/**
 * A declaration is the declaration of a name.
 * It is always tied to a scope.
 */
export class Declaration extends PositionedElement {
  parent: Scope | null = null
  doc = ''
  is_public: boolean = false
  name: string = ''

  fullName() {
    return this.name
  }

  /**
   * Get the members of the given declaration.
   * For variables, returns the list of .names
   *
  */
  getMembers(): Declaration[] {
    return []
  }

  getMemberByName(name: string, filter_public = false): Declaration | null {
    var res = this.getMembers()
    for (var d of res)
      if (d.name === name) {
        if (filter_public && !d.is_public) return null
        return d
      }
    return null
  }

  getMemberByPath(path: string[]): Declaration | null {
    if (path.length === 0) return this
    var [here, ...rest] = path
    var sub = this.getMemberByName(here)
    if (!sub) return null
    return sub.getMemberByPath(rest)
  }

}


export class UnprocessedType {

  constructor(public lexemes: Lexeme[]) { }

}


export class VariableDeclaration extends Declaration {
  varconst = 'const'
  value: Lexeme[] | null = null
  type: Lexeme[] | null = null // explicit type declaration.

  //
  _resolved_type: Declaration | null = null
  resolved_type(t?: Declaration) {
    if (t) this._resolved_type = t
    return this._resolved_type
  }

  fullName() {
    return `${this.name}${reJoin(this.type, ': ')}`
  }

  /**
   * Resolve the type of this expression.
   * This may have to go fetch the value first.
   * Used to modify the getMembers to take into account
   * if it is a pointer, option, maybe error or array so that
   * the members show '*', '?', whatever an error completes to or 'len',
   * or nothing if the current type resolves to a function type
   */
  getType(): Declaration | null {

    if (this.type) {
      var typ = this.parent!.resolveExpression(this.type)
      while (typ instanceof VariableDeclaration) {
        typ = typ.parent!.resolveExpression(typ.value)
      }

      // found it, maybe ?
      return typ
    }

    // yeah, didn't find it.
    return null
  }

  getMembers(): Declaration[] {
    // look first at the type. If we find it, then return its instance members.
    // This is probably the place where we need to find out if the type is actually
    // an array, an error or something else, so
    // FIXME

    // as long as we have a declaration, but as long as it's not a
    var typ = this.getType()
    if (typ && typ instanceof MemberedContainer) {
      return typ.getInstanceMembers()
    }

    if (this.value) {
      var val = this.parent!.resolveExpression(this.value)
      if (val)
        return val.getMembers()
    }

    return []
  }

}


export class ErrorIdentifier extends VariableDeclaration { }


export class ErrorDeclaration extends VariableDeclaration {
  lst: ErrorIdentifier[] = []

  getMembers() {
    return this.lst
  }
}


/**
 * A scope contains declarations. That's about it.
 */
export class Scope extends Declaration {
  // A scope can exist inside another scope.
  declarations: Declaration[] = []

  handleDeclaration(decl: Declaration) {
    decl.parent = this
  }

  appendDeclarations(decl: Declaration[]) {
    for (var d of decl) this.handleDeclaration(d)
    this.declarations = [...this.declarations, ...decl]
    return this
  }

  prependDeclarations(decl: Declaration[]) {
    for (var d of decl) this.handleDeclaration(d)
    this.declarations = [...decl, ...this.declarations]
    return this
  }

  setFile(f: File) {
    this.file = f
    for (var d of this.declarations)
      d.setFile(f)
  }

  getMembers(): Declaration[] {
    return []
  }

  getDeclarations(): Declaration[] {
    if (this.parent) return [...this.parent.getDeclarations(), ...this.declarations]
    return this.declarations
  }

  /**
   *
   */
  getDeclarationByName(name: string) {
    for (var d of this.getDeclarations()) {
      if (d.name === name)
        return d
    }
    return null
  }

  resolveExpression(expr: Lexeme[] | null): Declaration | null {
    if (!expr) return null
    const exp = resolvable_outer_expr.parse(expr)
    if (!exp) return null
    return exp(this)
  }

}


export class FileDeclaration extends Scope {
  // it has no name

  getMembers() {
    return this.getDeclarations()
  }
}


/**
 * A container is tied to a scope, in which some of its declarations
 * are to be treated as members and others as regular symbols.
 *
 * Members are accessed when variables are using this container as a
 * type.
 */
export class ContainerDeclaration extends Scope {

  members: Declaration[] = []

  // Override this in further declarations to add a declaration
  // to the list of members
  isMember(decl: Declaration) {
    return false
  }

  handleDeclaration(decl: Declaration) {
    super.handleDeclaration(decl)
    if (this.isMember(decl))
      this.members.push(decl)
  }

}


export class FunctionArgumentDeclaration extends VariableDeclaration {

}

/**
 *
 */
export class FunctionDeclaration extends Scope {
  args: FunctionArgumentDeclaration[] = []
  return_type: Lexeme[] | null = null

  fullName() {
    return `${this.name}(${this.args.map(a => a.fullName()).join(', ')})${reJoin(this.return_type, ': ')}`
  }

  getReturnType(): Declaration | null {
    return this.resolveExpression(this.return_type)
  }

}


export class MemberField extends VariableDeclaration {
  is_public = true
}

export class MemberedContainer extends ContainerDeclaration {
  // members:

  isInstanceMember(d: Declaration) {
    if (d instanceof MemberField) return true
    if (d instanceof FunctionDeclaration) {
      if (d.args.length > 0) {
        var first_arg = d.args[0]
        return d.resolveExpression(first_arg.type) === this
      }
    }
    return false
  }

  getMembers(as_type = false): Declaration[] {
    return this.declarations.filter(d => !this.isInstanceMember(d))
  }

  getInstanceMembers() {
    return this.declarations.filter(d => this.isInstanceMember(d))
  }
}


export class EnumMember extends VariableDeclaration {
  is_public = true
}

export class EnumDeclaration extends MemberedContainer {

}


export class StructDeclaration extends MemberedContainer {

}


export class UnionDeclaration extends MemberedContainer {

}


export class TestDeclaration extends Scope {
  name: string = ''
}


// Only used in resolver.
export class FakeScopeResolver extends Declaration {
  constructor(public scope: Scope) {
    super()
    this.file = scope.file
  }

  getMembers() {
    return this.scope.getDeclarations()
  }
}
