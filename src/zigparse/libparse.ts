
export class Lexeme {

  constructor(
    public regexp: RegExp,
    public str: string,
    public start: number,
    public end: number,
    public input_position: number,
    public line: number,
    public col: number,
  ) {

  }

  // inspect(depth: any, opts: any) {
  //   return 'L`' + this.str
  // }

  is(arg: string | RegExp) {
    return arg === this.str || arg === this.regexp
  }

  matches(r: RegExp) {
    return r.test(this.str)
  }
}


export class Lexer {

  lexed: Lexeme[] = []
  original_regexps: RegExp[] = []

  constructor(public regexps: RegExp[], public skip = /[\t \s\n]+|\/\/[^\/][^\n]*\n/m) {
    this.original_regexps = [...regexps, skip]
    this.regexps = this.original_regexps.map(r => new RegExp(r.source, r.flags + 'y'))
  }

  /**
   * Find the position of the lexeme our cursor is at.
   */
  getLexemeAt(position: number) {
    var start = 0
    var end = this.lexed.length - 1
    var pos!: number

    if (position > this.lexed[end].end)
      return this.lexed[end]

    while (end - start > 1) {
      pos = Math.floor((start + end) / 2)
      var current = this.lexed[pos]
      if (current.start + 1 > position) {
        end = pos
      } else if (current.end < position) {
        start = pos
      } else {
        // found you !
        // console.log(this.lexed[pos])
        return this.lexed[pos]
      }
    }
    return this.lexed[pos]
  }

  feed(str: string): Lexeme[] {
    var idx = 0
    var position = 0
    var line = 0
    var col = 0
    var regexps = this.regexps
    var original_regexps = this.original_regexps
    var res: Lexeme[] = []
    var skip = this.skip

    const lines = (s: string): [number, number] => {
      var lines = 0
      var len = s.length
      var col = 0
      for (var i = 0; i < len; i++) {
        col++
        if (s[i] === '\n') {
          lines++
          col = 0
        }
      }
      return [lines, col]
    }

    const next = () => {
      if (idx > str.length) return null

      var match: RegExpMatchArray | null = null
      var rl = regexps.length
      for (var i = 0; i < rl; i++) {
        var reg = regexps[i]
        reg.lastIndex = idx
        if ((match = reg.exec(str)) && match.index === idx) {
          return {regexp: original_regexps[i], match}
        }
      }
      return null
    }

    var match: ReturnType<typeof next>
    while (match = next()) {
      var m = match.match
      if (match.regexp !== skip) {
        res.push(new Lexeme(
          match.regexp,
          m[0],
          idx,
          idx + m[0].length,
          position++,
          line,
          col
        ))
      }
      idx += m[0].length
      var lin = lines(m[0])
      line += lin[0]
      col = lin[1]
    }

    if (idx < str.length) {
      console.error(res.slice(Math.max(res.length - 5, 0), res.length))
      throw new Error(`leftovers: ${str.slice(idx, idx + 64)}...`)
    }

    this.lexed = res

    return res
  }

}


export type ParseResult<T> = [number, T] | null

/**
 *
 */
export class Rule<T> {

  constructor(
    public _parse: (pos: number, input: Lexeme[], step: 1 | -1) => ParseResult<T>,
    public _maps?: ((a: T, start: Lexeme, end: Lexeme, input: Lexeme[]) => T)[]
  ) {

  }

  tryParse(pos: number, input: Lexeme[], step: 1 | -1): ParseResult<T> {
    var res = this._parse(pos, input, step)
    if (res != null) {
      // if (res[0] === pos) throw new Error('what')
      if (this._maps) {
        var start = step === 1 ? pos : res[0] + 1
        var end = step === 1 ? res[0] - 1 : pos
        for (var m of this._maps) {
          res[1] = m(res[1], input[start], input[end], input)
        }
      }
        // return [res[0], this._maps(res[1], pos, res[0], input)]
      return res
    }
    return null
  }

  parse(input: Lexeme[]): T | null {
    var res = this.tryParse(0, input, 1)
    if (res) return res[1]
    return null
  }

  map<U>(fn: (a: T, start: Lexeme, end: Lexeme, input: Lexeme[]) => U): Rule<U> {
    return new Rule(this._parse, [...(this._maps||[]), fn] as any) as any as Rule<U>
  }

}

export type RawRule<T> = string | RegExp | Rule<T> | (() => Rule<T>)

export type InferedRule<T> = T extends Rule<infer U> ? Rule<U> : Rule<Lexeme>

export type GenericRule<Arr extends RawRule<any>[]> = {[K in keyof Arr]:
  Arr[K] extends Rule<infer U> ? Rule<U> : Rule<Lexeme>
}


export function mkRule<T>(r: RawRule<T>): InferedRule<typeof r> {
  return r instanceof RegExp || typeof r === 'string' ? Token(r) :
    typeof r === 'function' ? Forward(r) : r
}

export function mkRules<R extends RawRule<any>[]>(rules: R): GenericRule<R> {
  return rules.map(t => mkRule(t)) as any
}


export function Token(r: RegExp | string) {
  return new Rule((pos, input, step) => {
    var lexeme = input[pos]
    if (lexeme && lexeme.is(r)) {
      return [pos + step, lexeme]
    }
    return null
  })
}


export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>>(a: A, b: B, c: C, d: D): Rule<[Result<A>, Result<B>, Result<C>, Result<D>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>>(a: A, b: B, c: C): Rule<[Result<A>, Result<B>, Result<C>]>
export function Seq<A extends RawRule<any>, B extends RawRule<any>>(a: A, b: B): Rule<[Result<A>, Result<B>]>
export function Seq(..._rules: any[]): Rule<any> {
  var rules = mkRules(_rules)
  return new Rule<any[]>((pos, input, step) => {
    var p: ParseResult<any>
    var res = new Array(rules.length) as any[]

    var start = step === 1 ? 0 : rules.length - 1
    var end = step === 1 ? rules.length : -1
    for (var i = start; i !== end; i += step) {
      if (!(p = rules[i].tryParse(pos, input, step)))
        return null
      else {
        [pos, res[i]] = p
      }
    }

    return [pos, res]
  })
}


export function SeqObj<T extends {[name: string]: RawRule<any>}>(_rules: T): Rule<{[K in keyof T]: Result<T[K]>}> {
  var rules = mkRules(Object.values(_rules))
  var keys = Object.keys(_rules)
  return new Rule<any>((pos, input, step) => {
    var p: ParseResult<any>
    var res = {} as any

    var start = step === 1 ? 0 : rules.length - 1
    var end = step === 1 ? rules.length : -1
    for (var i = start; i !== end; i += step) {
      if (!(p = rules[i].tryParse(pos, input, step)))
        return null
      else {
        [pos, res[keys[i]]] = p
      }
    }

    return [pos, res]
  })
}


export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H, I]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>, Result<I>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G, H]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>, Result<H>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F, G]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>, Result<G>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E, F]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>, Result<F>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D, E]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>, Result<E>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C, D]): Rule<[Result<A>, Result<B>, Result<C>, Result<D>]>
export function S<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B, C]): Rule<[Result<A>, Result<B>, Result<C>]>
export function S<A extends RawRule<any>, B extends RawRule<any>>(t: TemplateStringsArray, ...rules: [A, B]): Rule<[Result<A>, Result<B>]>
export function S<A extends RawRule<any>>(t: TemplateStringsArray, rules: A): Rule<Result<A>>
export function S(tpl: TemplateStringsArray, ...rules: RawRule<any>[]): Rule<any> {
  const len = rules.length
  const mapped_rules: RawRule<any>[] = []
  const indexes = [] as number[]
  for (var i = 0; i < tpl.length; i++) {
    var item = tpl[i].trim()
    if (item) mapped_rules.push(item)
    if (rules[i]) {
      indexes.push(mapped_rules.length)
      mapped_rules.push(rules[i])
    }
  }
  return (Seq as any)(...mapped_rules).map((res: any) => {
    const _res = new Array(len)
    for (var i = 0; i < len; i++) {
      _res[i] = res[indexes[i]]
    }

    return len > 1 ? _res : _res[0]
  })
}


export type Result<T> = T extends Rule<infer U> ? U : T extends () => Rule<infer V> ? V : Lexeme

export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>, I extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H> | Result<I>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>, H extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G> | Result<H>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>, G extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F, g: G): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F> | Result<G>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>, F extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E, f: F): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E> | Result<F>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>, E extends RawRule<any>>(a: A, b: B, c: C, d: D, e: E): Rule<Result<A> | Result<B> | Result<C> | Result<D> | Result<E>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>, D extends RawRule<any>>(a: A, b: B, c: C, d: D): Rule<Result<A> | Result<B> | Result<C> | Result<D>>
export function Either<A extends RawRule<any>, B extends RawRule<any>, C extends RawRule<any>>(a: A, b: B, c: C): Rule<Result<A> | Result<B> | Result<C>>
export function Either<A extends RawRule<any>, B extends RawRule<any>>(a: A, b: B): Rule<Result<A> | Result<B>>

export function Either(..._rules: RawRule<any>[]): Rule<any> {
  var rules = mkRules(_rules)
  return new Rule((pos, input, step) => {
    var p: ParseResult<any>
    for (var r of rules) {
      if (p = r.tryParse(pos, input, step)) {
        return p
      }
    }
    // not found
    return null
  }) as any
}


export function Peek(r: RawRule<any>) {
  var rule = mkRule(r)
  return new Rule((pos, input, step) => {
    if (rule.tryParse(pos, input, step))
      return [pos, input] // do not consume.
    return null
  })
}


export const any = new Rule((pos, input, step) => (step === 1 ? pos < input.length : pos >= 0) ? [pos + step, input[pos]] : null)

export function Z<T>(_r: RawRule<T>): Rule<T[]> {
  const rule = mkRule(_r) as Rule<T>
  return new Rule((pos, input, step) => {
    var res: T[] = []
    var p: ParseResult<T>
    while (p = rule.tryParse(pos, input, step)) {
      res.push(p[1])
      pos = p[0]
    }
    return [pos, step === -1 ? res.reverse() : res]
  })
}


export function Opt<T extends RawRule<any>>(_r: T): Rule<Result<T> | null> {
  const rule = mkRule(_r) as any
  return new Rule((pos, input, step) => {
    const p = rule.tryParse(pos, input, step)
    if (p) return p
    else return [pos, null]
  })
}


export function P<T>(_r: RawRule<T>): Rule<T[]> {
  const subr = Z(_r)
  return new Rule((pos, input, step) => {
    const p = subr.tryParse(pos, input, step)
    if (p && p[0] > pos) return p // only accept a superior input.
    return null
  })
}


export function Balanced<T>(_start: RawRule<any>, _rule: RawRule<T>, _end: RawRule<any>): Rule<T[]> {
  const start = mkRule(_start)
  const end = mkRule(_end)
  const rule = mkRule(_rule)
  return new Rule((pos, input, step) => {
    var res = [] as T[]
    const st = step === 1 ? start : end
    const en = step === 1 ? end : start

    var st_res = st.tryParse(pos, input, step)
    if (!st_res) return null
    pos = st_res[0]
    var stack = 1

    var end_pos = step === 1 ? input.length : -1
    while (pos !== end_pos) {
      var en_res = en.tryParse(pos, input, step)
      if (en_res) {
        pos = en_res[0]
        stack--
        if (stack === 0)
          return [pos, res]
        continue
      }

      st_res = st.tryParse(pos, input, step)
      if (st_res) {
        stack++
        pos = st_res[0]
        continue
      }

      var rule_res = rule.tryParse(pos, input, step)
      if (rule_res) {
        pos = rule_res[0]
        res.push(rule_res[1] as T)
        continue
      }

      pos += step
    }

    return null
  })
}


export function Between<T>(_start: RawRule<any>, _rule: RawRule<T>, _end: RawRule<any>): Rule<T[]> {
  const start = mkRule(_start)
  const end = mkRule(_end)
  const rule = mkRule(_rule)
  return new Rule((pos, input, step) => {
    var res = [] as T[]
    const st = step === 1 ? start : end
    const en = step === 1 ? end : start

    var st_res = st.tryParse(pos, input, step)
    if (!st_res) return null
    pos = st_res[0]

    var end_pos = step === 1 ? input.length : -1
    while (pos !== end_pos) {
      var en_res = en.tryParse(pos, input, step)
      if (en_res) {
        pos = en_res[0]
        return [pos, res]
      }

      var rule_res = rule.tryParse(pos, input, step)
      if (rule_res) {
        pos = rule_res[0]
        res.push(rule_res[1] as T)
        continue
      }

      pos += step
    }

    return null
  })
}


/**
 * I should remove this as it can't reliably parse backwards.
 */
export function ZF<T>(_r: RawRule<T>, until?: RawRule<any> | null): Rule<T[]> {
  const rule = mkRule(_r)
  const _until = until ? mkRule(until) : null
  return new Rule((pos, input, step) => {
    var res: T[] = []

    while (true) {
      // try the until rule
      if (_until && _until.tryParse(pos, input, step)) {
        // if matches => return
        return [pos, res]
      }

      // try the rule
      var p = rule.tryParse(pos, input, step)
      if (p) {
        pos = p[0]
        res.push(p[1] as T)
        continue
      }

      // we were not on the until rule, and the rule didn't match, so we're just going to
      // advance the position
      pos += step
      if (step === 1 && pos > input.length || step === -1 && pos < 0)
        // if we're past the end, just return.
        return [pos, step === -1 ? res.reverse() : res]
    }
  })
}

export function first<A>(a: [A, ...any[]]) { return a[0] }
export function second<A>(a: [any, A, ...any[]]) { return a[1] }
export function third<A>(a: [any, any, A, ...any[]]) { return a[2] }

export const separated_by = <T>(separator: RawRule<any>, rule: RawRule<T>) =>
  Seq(
    rule as Rule<T>,
    Z(
      Seq(separator, rule).map(([_, r]) => {
        return r as T
      })
    )
  ).map(([f, s]) => [f, ...s])


export function Forward<T>(fn: () => RawRule<T>): Rule<T> {
  return new Rule<any>((pos, input, step) => {
    var r = mkRule(fn())
    return r.tryParse(pos, input, step)
  })
}



export const T = {
  BLOCK_COMMENT: /([ \t]*\/\/\/[^\n]*\n)+/m,
  STR: /"(\\"|.)*"|\\\\[^\n]*\n(\s*\\\\[^\n]*\n)*/,
  CHAR: /'(\\'|.)*'/,
  IDENT: /@?\w+|@"[^"]+"/,
  OP: new RegExp([
    /&=|&/,
    /\*%=|\*%|\*=|\*\*|\*/,
    /\^=?/,
    /\.\.\.|\.\.|\.\?|\.\*|\./,
    /=>|==|=/,
    /!=|!/,
    /<<=|<=|<<|</,
    /-%=|-%|->|-=|-/,
    /%=|%/,
    /\|=|\|\||\|/,
    /\+%=|\+%|\+=|\+\+|\+/,
    /\[\*c\]|\[\*\]/,
    /\?/,
    />>=|>=|>>|>/,
    /\/=|\/(?!\/)/,
    /~/
  ].map(r => r.source).join('|')),
  // /&=?|\*[\*=%]?=?|==?=?|\./,
  CONTROL: /\(|\{|\[|\]|\}|\)|;|:|,/,
}
