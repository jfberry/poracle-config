import { describe, it, expect } from 'vitest';
import { createEngine, renderTemplate, renderDtsTemplate } from '../handlebars-engine';

function render(tpl, data = {}) {
  const engine = createEngine();
  return renderTemplate(engine, tpl, data);
}

// ─── Comparison helpers ───

describe('eq', () => {
  it('block mode: true', () => {
    expect(render('{{#eq a "1"}}yes{{else}}no{{/eq}}', { a: 1 })).toBe('yes');
  });
  it('block mode: false', () => {
    expect(render('{{#eq a "2"}}yes{{else}}no{{/eq}}', { a: 1 })).toBe('no');
  });
  it('inline/subexpression mode', () => {
    expect(render('{{#if (eq a "1")}}yes{{else}}no{{/if}}', { a: 1 })).toBe('yes');
  });
});

describe('ne / isnt', () => {
  it('ne true', () => {
    expect(render('{{#ne a "2"}}yes{{else}}no{{/ne}}', { a: 1 })).toBe('yes');
  });
  it('ne false', () => {
    expect(render('{{#ne a "1"}}yes{{else}}no{{/ne}}', { a: 1 })).toBe('no');
  });
  it('isnt is alias for ne', () => {
    expect(render('{{#isnt a "1"}}yes{{else}}no{{/isnt}}', { a: 1 })).toBe('no');
  });
});

describe('compare', () => {
  it('== true', () => expect(render('{{#compare a "==" "1"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
  it('!= true', () => expect(render('{{#compare a "!=" "2"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
  it('< true', () => expect(render('{{#compare a "<" "2"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
  it('> true', () => expect(render('{{#compare a ">" "0"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
  it('<= true', () => expect(render('{{#compare a "<=" "1"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
  it('>= true', () => expect(render('{{#compare a ">=" "1"}}y{{else}}n{{/compare}}', { a: 1 })).toBe('y'));
});

describe('gt / gte / lt / lte', () => {
  it('gt true', () => expect(render('{{#gt 5 3}}y{{else}}n{{/gt}}')).toBe('y'));
  it('gt false', () => expect(render('{{#gt 3 5}}y{{else}}n{{/gt}}')).toBe('n'));
  it('gte true (equal)', () => expect(render('{{#gte 5 5}}y{{else}}n{{/gte}}')).toBe('y'));
  it('lt true', () => expect(render('{{#lt 3 5}}y{{else}}n{{/lt}}')).toBe('y'));
  it('lte true (equal)', () => expect(render('{{#lte 5 5}}y{{else}}n{{/lte}}')).toBe('y'));
});

describe('and / or / neither', () => {
  it('and: all truthy', () => expect(render('{{#and 1 "a" true}}y{{else}}n{{/and}}')).toBe('y'));
  it('and: one falsy', () => expect(render('{{#and 1 "" true}}y{{else}}n{{/and}}')).toBe('n'));
  it('or: one truthy', () => expect(render('{{#or 0 "" "a"}}y{{else}}n{{/or}}')).toBe('y'));
  it('or: none truthy', () => expect(render('{{#or 0 ""}}y{{else}}n{{/or}}')).toBe('n'));
  it('neither: none truthy', () => expect(render('{{#neither 0 ""}}y{{else}}n{{/neither}}')).toBe('y'));
  it('neither: one truthy', () => expect(render('{{#neither 0 "a"}}y{{else}}n{{/neither}}')).toBe('n'));
});

describe('not', () => {
  it('not falsy', () => expect(render('{{#not false}}y{{else}}n{{/not}}')).toBe('y'));
  it('not truthy', () => expect(render('{{#not true}}y{{else}}n{{/not}}')).toBe('n'));
});

describe('contains', () => {
  it('string contains', () => expect(render('{{#contains s "world"}}y{{else}}n{{/contains}}', { s: 'hello world' })).toBe('y'));
  it('string does not contain', () => expect(render('{{#contains s "xyz"}}y{{else}}n{{/contains}}', { s: 'hello world' })).toBe('n'));
  it('array includes', () => expect(render('{{#contains arr 2}}y{{else}}n{{/contains}}', { arr: [1, 2, 3] })).toBe('y'));
});

describe('default', () => {
  it('returns value when truthy', () => expect(render('{{default a "fallback"}}', { a: 'hi' })).toBe('hi'));
  it('returns default when falsy', () => expect(render('{{default a "fallback"}}', { a: '' })).toBe('fallback'));
});

// ─── Math helpers ───

describe('math helpers', () => {
  it('round', () => expect(render('{{round 3.7}}')).toBe('4'));
  it('floor', () => expect(render('{{floor 3.7}}')).toBe('3'));
  it('ceil', () => expect(render('{{ceil 3.2}}')).toBe('4'));
  it('add', () => expect(render('{{add 3 4}}')).toBe('7'));
  it('plus', () => expect(render('{{plus 3 4}}')).toBe('7'));
  it('subtract', () => expect(render('{{subtract 10 3}}')).toBe('7'));
  it('minus', () => expect(render('{{minus 10 3}}')).toBe('7'));
  it('multiply', () => expect(render('{{multiply 3 4}}')).toBe('12'));
  it('divide', () => expect(render('{{divide 12 4}}')).toBe('3'));
  it('divide by zero', () => expect(render('{{divide 12 0}}')).toBe('0'));
  it('toFixed', () => expect(render('{{toFixed 3.14159 2}}')).toBe('3.14'));
  it('toInt', () => expect(render('{{toInt 3.9}}')).toBe('3'));
  it('toInt negative', () => expect(render('{{toInt -3.9}}')).toBe('-3'));
});

// ─── String helpers ───

describe('string helpers', () => {
  it('uppercase', () => expect(render('{{uppercase "hello"}}')).toBe('HELLO'));
  it('lowercase', () => expect(render('{{lowercase "HELLO"}}')).toBe('hello'));
  it('capitalize', () => expect(render('{{capitalize "hello"}}')).toBe('Hello'));
  it('replace all', () => expect(render('{{replace "abab" "a" "x"}}')).toBe('xbxb'));
  it('replaceFirst', () => expect(render('{{replaceFirst "abab" "a" "x"}}')).toBe('xbab'));
  it('truncate', () => expect(render('{{truncate "hello world" 5}}')).toBe('hello...'));
  it('truncate with custom suffix', () => expect(render('{{truncate "hello world" 5 suffix="!"}}')).toBe('hello!'));
  it('truncate when short enough', () => expect(render('{{truncate "hi" 5}}')).toBe('hi'));
  it('concat', () => expect(render('{{concat "a" "b" "c"}}')).toBe('abc'));
  it('concat with variables', () => expect(render('{{concat a b}}', { a: 'hello', b: ' world' })).toBe('hello world'));
});

// ─── Array helpers ───

describe('each (overridden)', () => {
  it('iterates array with @index', () => {
    expect(render('{{#each arr}}{{@index}}{{/each}}', { arr: ['a', 'b', 'c'] })).toBe('012');
  });
  it('injects isFirst/isLast into object items', () => {
    const data = { arr: [{ n: 'a' }, { n: 'b' }, { n: 'c' }] };
    expect(render('{{#each arr}}{{n}}:{{isFirst}}:{{isLast}} {{/each}}', data))
      .toBe('a:true:false b:false:false c:false:true ');
  });
  it('sets @first and @last data vars', () => {
    expect(render('{{#each arr}}{{@index}} {{/each}}', { arr: [1, 2, 3] }))
      .toBe('0 1 2 ');
  });
  it('iterates objects', () => {
    expect(render('{{#each obj}}{{@key}}={{this}} {{/each}}', { obj: { x: 1, y: 2 } }))
      .toBe('x=1 y=2 ');
  });
  it('shows else block for empty array', () => {
    expect(render('{{#each arr}}item{{else}}empty{{/each}}', { arr: [] })).toBe('empty');
  });
});

describe('forEach', () => {
  it('sets @total', () => {
    expect(render('{{#forEach arr}}{{@total}} {{/forEach}}', { arr: ['a', 'b'] })).toBe('2 2 ');
  });
});

describe('first / last', () => {
  it('first 1', () => {
    expect(render('{{#each (first arr)}}{{this}}{{/each}}', { arr: [1, 2, 3] })).toBe('1');
  });
  it('first n=2', () => {
    expect(render('{{#each (first arr n=2)}}{{this}}{{/each}}', { arr: [1, 2, 3] })).toBe('12');
  });
  it('last 1', () => {
    expect(render('{{#each (last arr)}}{{this}}{{/each}}', { arr: [1, 2, 3] })).toBe('3');
  });
  it('last n=2', () => {
    expect(render('{{#each (last arr n=2)}}{{this}}{{/each}}', { arr: [1, 2, 3] })).toBe('23');
  });
});

describe('length', () => {
  it('array', () => expect(render('{{length arr}}', { arr: [1, 2, 3] })).toBe('3'));
  it('string', () => expect(render('{{length "hello"}}')).toBe('5'));
  it('object', () => expect(render('{{length obj}}', { obj: { a: 1, b: 2 } })).toBe('2'));
});

describe('join', () => {
  it('join with separator', () => expect(render('{{join arr ", "}}', { arr: ['a', 'b', 'c'] })).toBe('a, b, c'));
  it('join default separator', () => expect(render('{{join arr}}', { arr: ['a', 'b'] })).toBe('a,b'));
});

// ─── Formatting helpers ───

describe('formatting helpers', () => {
  it('numberFormat', () => expect(render('{{numberFormat 3.14159 2}}')).toBe('3.14'));
  it('pad0 default width', () => expect(render('{{pad0 5}}')).toBe('005'));
  it('pad0 width 5', () => expect(render('{{pad0 42 5}}')).toBe('00042'));
  it('addCommas', () => expect(render('{{addCommas 1234567}}')).toBe('1,234,567'));
  it('addCommas with decimals', () => expect(render('{{addCommas 1234.56}}')).toBe('1,234.56'));
});

// ─── Game helpers ───

describe('game helpers', () => {
  it('pokemonName', () => expect(render('{{pokemonName 25}}')).toBe('Pokemon #25'));
  it('moveName', () => expect(render('{{moveName 14}}')).toBe('Move #14'));

  it('pokemon block helper', () => {
    const result = render('{{#pokemon 25}}{{name}}{{/pokemon}}');
    expect(result).toBe('Pokemon #25');
  });

  it('getPowerUpCost block helper', () => {
    const result = render('{{#getPowerUpCost 1 40}}{{stardust}} stardust{{/getPowerUpCost}}');
    expect(result).toBe('0 stardust');
  });
});

// ─── Engine ───

describe('renderTemplate', () => {
  it('renders with data', () => {
    const engine = createEngine();
    expect(renderTemplate(engine, 'Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('noEscape: does not escape HTML', () => {
    const engine = createEngine();
    expect(renderTemplate(engine, '{{html}}', { html: '<b>bold</b>' })).toBe('<b>bold</b>');
  });
});

describe('renderDtsTemplate', () => {
  it('renders JSON template object', () => {
    const engine = createEngine();
    const tpl = { title: '{{name}}', value: '{{count}}' };
    const result = renderDtsTemplate(engine, tpl, { name: 'Test', count: '42' });
    expect(result).toEqual({ title: 'Test', value: '42' });
  });

  it('handles nested objects and arrays', () => {
    const engine = createEngine();
    const tpl = {
      embed: {
        title: '{{pokeName}}',
        fields: [
          { name: 'IV', value: '{{iv}}%' },
          { name: 'Level', value: '{{level}}' },
        ],
      },
    };
    const result = renderDtsTemplate(engine, tpl, { pokeName: 'Pikachu', iv: '100', level: '35' });
    expect(result).toEqual({
      embed: {
        title: 'Pikachu',
        fields: [
          { name: 'IV', value: '100%' },
          { name: 'Level', value: '35' },
        ],
      },
    });
  });

  it('returns null for invalid JSON output', () => {
    const engine = createEngine();
    // Template that produces invalid JSON when rendered
    const tpl = { title: '{{name}}' };
    // name contains a quote that breaks JSON
    const result = renderDtsTemplate(engine, tpl, { name: 'test"break' });
    expect(result).toBeNull();
  });
});
