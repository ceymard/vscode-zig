import * as fs from 'fs'
import { PositionedElement, Scope, VariableDeclaration, FunctionDeclaration, StructDeclaration, EnumDeclaration, MemberField, Declaration, ContainerDeclaration, FunctionArgumentDeclaration, ErrorDeclaration, EnumMember } from './ast'
import { Lexer, Lexeme, S, P, any, Either, Opt } from './libparse'
import c from 'chalk'
import { ZigHost } from '.'


const is = (d: any, d2: any) => d.constructor === d2


const host = new ZigHost('', process.cwd())


const kw = [
  'align',
  'allowzero',
  'and',
  'asm',
  'async',
  'await',
  'break',
  'catch',
  'comptime',
  'const',
  'continue',
  'defer',
  'else',
  'enum',
  'errdefer',
  'error',
  'export',
  'extern',
  'false',
  'fn',
  'for',
  'if',
  'inline',
  'nakedcc',
  'noalias',
  'null',
  'or',
  'orelse',
  'packed',
  'promise',
  'pub',
  'resume',
  'return',
  'linksection',
  'stdcallcc',
  'struct',
  'suspend',
  'switch',
  'test',
  'threadlocal',
  'true',
  'try',
  // 'undefined',
  'union',
  'unreachable',
  'usingnamespace',
  'var',
  'volatile',
  'while',

]


function printDeclaration(d: Declaration, indent = '') {
  var p = (s: string) => console.log(indent + s)
  var pu = (s: Declaration) => s.is_public ? 'pub ' : ''
  var lx = (lx: Lexeme[] | null) => (lx||[]).map(l => l.str + (kw.includes(l.str) ? ' ' : '')).join('')

  if (d.is(VariableDeclaration)) {
    p(c.gray.bold(pu(d) + d.varconst) + ' ' + d.name + (d.type ? c.gray(': ' + lx(d.type)) : '') + c.gray(' = ' + lx(d.value)))
  } else if (d.is(FunctionDeclaration)) {
    p(c.green.bold(pu(d) + 'fn')
      + ' '
      + d.name
      + '(' + d.args.map(a => c.green(a.name) + ': ' + c.grey(lx(a.type))).join(', ') + ')'
      + c.gray(' -> ' + lx(d.return_type))
    )
  } else if (d.is(ErrorDeclaration)) {
    p(c.red.bold(pu(d) + 'error') + ' ' + d.name)
    indent += '  '
    for (var e of d.lst)
      p(c.red(e.name))
  } else if (d.is(EnumMember)) {
    p(c.cyan(d.name) + c.gray((d.value ? ' = ' : '') + lx(d.value)))
  } else if (d.is(StructDeclaration)) {
    p(c.magentaBright.bold(pu(d) + 'struct') + ' ' + d.name)
  } else if (d.is(EnumDeclaration)) {
    p(c.cyan.bold(pu(d) + 'enum') + ' ' + d.name)
  } else if (d.is(MemberField)) {
    p(c.yellowBright('.' + d.name + c.gray(': ' + lx(d.type))))
  } else if (d.is(FunctionArgumentDeclaration)) {
    // do nothing, they're handled in the function block
  } else {
    p(c.red.bold('/!\\ ' + d.constructor.name))
  }
}

function printVisit(d: PositionedElement, pub = false, indent = '') {

  var mp = (d: PositionedElement) => printVisit(d, pub, indent + '  ')

  if (
    (d.is(VariableDeclaration) || d instanceof ContainerDeclaration)
    && !d.is(Scope) && pub && !d.is_public) return

  if (d instanceof Declaration && !d.is(Scope)) {
    printDeclaration(d, indent)
  }

  if (d instanceof Scope) {
    d.declarations.forEach(mp)
  }
}

export function tree(paths: string[], opt = 'tree' as string) {
  for (var path of paths) {
    const contents = fs.readFileSync(path, 'utf-8')
    process.stdout.write(c.bold.magentaBright(`File`) + ' ' + c.magentaBright(path) + ` ${Math.round(contents.length / 1024)}kb`)
    const f = host.addFile(path, contents)
    console.info(` lex(${f.lex_hrtime[0] > 0 ? c.red.bold('%ds') : '%ds'} %dms) parse(${f.parse_hrtime[0] > 0 ? c.red.bold('%ds') : '%ds'} %dms)`, f.lex_hrtime[0], f.lex_hrtime[1] / 1000000, f.parse_hrtime[0], f.parse_hrtime[1] / 1000000)
    if (opt !== 'silent') {
      // for (var l of f.lexer.lexed) {
      //   process.stdout.write(`'${l.str}' `)
      // }
      // console.log()
      printVisit(f.scope, opt === 'pub')
    }
  }
}

export function scope(path: string, pos: number) {
  const f = host.addFile(path, fs.readFileSync(path, 'utf-8'))
  const scope = f.getScopeAt(pos)
  if (scope) {
    const decls = f.getDeclarationsInScope(scope)
    for (var d of Object.values(decls)) printDeclaration(d)
  } else
    console.log(c.redBright('no scope found'))
}

export function complete(path: string, pos: number) {
  const f = host.addFile(path, fs.readFileSync(path, 'utf-8'))
  const decls = f.getCompletionsAt(pos)
  for (var d of decls) printDeclaration(d)
}

// export function completion()


const args = process.argv.slice(2).map((a, i) => new Lexeme(/./, a, 0, 0, i, 0, 0))

const tree_cmd = S`tree ${Opt(Either('pub', 'silent'))} ${P(any)}`.map(([pub, s]) => tree(s.map(s => s.str), pub ? pub.str : 'tree'))
const scope_cmd = S`scope ${any} ${any}`.map(([fname, num]) => scope(fname.str, parseInt(num.str)))
const complete_cmd = S`comp ${any} ${any}`.map(([fname, num]) => complete(fname.str, parseInt(num.str)))

const commands = Either(tree_cmd, scope_cmd, complete_cmd)
commands.parse(args)