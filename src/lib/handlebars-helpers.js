/**
 * Handlebars helpers matching the PoracleNG Go backend (raymond).
 * Grouped: comparison, math, string, array, formatting.
 */

/**
 * Helper to make comparison helpers work in both block and inline/subexpression mode.
 * In block mode (options.fn exists), returns options.fn(this) or options.inverse(this).
 * In inline mode, returns the boolean result directly.
 */
function conditional(result, context, options) {
  if (options && typeof options.fn === 'function') {
    return result ? options.fn(context) : options.inverse(context);
  }
  return result;
}

export function registerAllHelpers(hbs) {
  // ─── Comparison helpers ───

  hbs.registerHelper('eq', function (a, b, options) {
    return conditional(String(a) === String(b), this, options);
  });

  hbs.registerHelper('ne', function (a, b, options) {
    return conditional(String(a) !== String(b), this, options);
  });

  hbs.registerHelper('isnt', function (a, b, options) {
    return conditional(String(a) !== String(b), this, options);
  });

  hbs.registerHelper('compare', function (a, operator, b, options) {
    const numA = Number(a);
    const numB = Number(b);
    let result;
    switch (operator) {
      case '==': result = String(a) === String(b); break;
      case '!=': result = String(a) !== String(b); break;
      case '<': result = numA < numB; break;
      case '>': result = numA > numB; break;
      case '<=': result = numA <= numB; break;
      case '>=': result = numA >= numB; break;
      default: result = false;
    }
    return conditional(result, this, options);
  });

  hbs.registerHelper('gt', function (a, b, options) {
    return conditional(Number(a) > Number(b), this, options);
  });

  hbs.registerHelper('gte', function (a, b, options) {
    return conditional(Number(a) >= Number(b), this, options);
  });

  hbs.registerHelper('lt', function (a, b, options) {
    return conditional(Number(a) < Number(b), this, options);
  });

  hbs.registerHelper('lte', function (a, b, options) {
    return conditional(Number(a) <= Number(b), this, options);
  });

  hbs.registerHelper('and', function (...args) {
    const options = args.pop();
    const result = args.every(a => !!a);
    return conditional(result, this, options);
  });

  hbs.registerHelper('or', function (...args) {
    const options = args.pop();
    const result = args.some(a => !!a);
    return conditional(result, this, options);
  });

  hbs.registerHelper('neither', function (...args) {
    const options = args.pop();
    const result = !args.some(a => !!a);
    return conditional(result, this, options);
  });

  hbs.registerHelper('not', function (value, options) {
    return conditional(!value, this, options);
  });

  hbs.registerHelper('contains', function (haystack, needle, options) {
    let result = false;
    if (Array.isArray(haystack)) {
      result = haystack.includes(needle);
    } else if (typeof haystack === 'string') {
      result = haystack.includes(String(needle));
    }
    return conditional(result, this, options);
  });

  hbs.registerHelper('default', function (value, defaultValue) {
    return value || defaultValue;
  });

  // ─── Math helpers ───

  hbs.registerHelper('round', (a) => Math.round(Number(a)));
  hbs.registerHelper('floor', (a) => Math.floor(Number(a)));
  hbs.registerHelper('ceil', (a) => Math.ceil(Number(a)));

  hbs.registerHelper('add', (a, b) => Number(a) + Number(b));
  hbs.registerHelper('plus', (a, b) => Number(a) + Number(b));

  hbs.registerHelper('subtract', (a, b) => Number(a) - Number(b));
  hbs.registerHelper('minus', (a, b) => Number(a) - Number(b));

  hbs.registerHelper('multiply', (a, b) => Number(a) * Number(b));

  hbs.registerHelper('divide', (a, b) => {
    const divisor = Number(b);
    return divisor === 0 ? 0 : Number(a) / divisor;
  });

  hbs.registerHelper('toFixed', (a, decimals) => Number(a).toFixed(Number(decimals)));

  hbs.registerHelper('toInt', (a) => Math.trunc(Number(a)));

  // ─── String helpers ───

  hbs.registerHelper('uppercase', (str) => String(str).toUpperCase());
  hbs.registerHelper('lowercase', (str) => String(str).toLowerCase());
  hbs.registerHelper('capitalize', (str) => {
    const s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  hbs.registerHelper('replace', (str, search, replacement) =>
    String(str).replaceAll(String(search), String(replacement))
  );

  hbs.registerHelper('replaceFirst', (str, search, replacement) =>
    String(str).replace(String(search), String(replacement))
  );

  hbs.registerHelper('truncate', function (str, len, options) {
    const s = String(str);
    const max = Number(len);
    const suffix = (options && options.hash && options.hash.suffix != null)
      ? options.hash.suffix
      : '...';
    if (s.length <= max) return s;
    return s.slice(0, max) + suffix;
  });

  hbs.registerHelper('concat', function (...args) {
    // Last arg is always the Handlebars options object — filter it out
    const last = args[args.length - 1];
    if (last && typeof last === 'object' && (last.name != null || last.lookupProperty != null)) {
      args.pop();
    }
    return args.join('');
  });

  // ─── Array helpers ───

  // Override built-in `each` to inject isFirst/isLast for PoracleJS compatibility
  hbs.registerHelper('each', function (context, options) {
    if (!options || typeof options.fn !== 'function') {
      return '';
    }

    let result = '';

    if (Array.isArray(context)) {
      for (let i = 0; i < context.length; i++) {
        const item = context[i];
        const data = hbs.createFrame(options.data || {});
        data.index = i;
        data.first = i === 0;
        data.last = i === context.length - 1;

        // For object items, spread and inject isFirst/isLast
        let ctx;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          ctx = { ...item, isFirst: i === 0, isLast: i === context.length - 1 };
        } else {
          ctx = item;
        }

        result += options.fn(ctx, { data });
      }
    } else if (context && typeof context === 'object') {
      const keys = Object.keys(context);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = context[key];
        const data = hbs.createFrame(options.data || {});
        data.index = i;
        data.key = key;
        data.first = i === 0;
        data.last = i === keys.length - 1;

        let ctx;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          ctx = { ...value, isFirst: i === 0, isLast: i === keys.length - 1 };
        } else {
          ctx = value;
        }

        result += options.fn(ctx, { data });
      }
    }

    if (result === '' && options.inverse) {
      return options.inverse(this);
    }

    return result;
  });

  hbs.registerHelper('forEach', function (context, options) {
    if (!options || typeof options.fn !== 'function') {
      return '';
    }

    let result = '';

    if (Array.isArray(context)) {
      for (let i = 0; i < context.length; i++) {
        const item = context[i];
        const data = hbs.createFrame(options.data || {});
        data.index = i;
        data.first = i === 0;
        data.last = i === context.length - 1;
        data.total = context.length;

        let ctx;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          ctx = { ...item, isFirst: i === 0, isLast: i === context.length - 1 };
        } else {
          ctx = item;
        }

        result += options.fn(ctx, { data });
      }
    }

    if (result === '' && options.inverse) {
      return options.inverse(this);
    }

    return result;
  });

  hbs.registerHelper('first', function (arr, options) {
    if (!Array.isArray(arr)) return arr;
    const n = (options && options.hash && options.hash.n) || 1;
    return arr.slice(0, Number(n));
  });

  hbs.registerHelper('last', function (arr, options) {
    if (!Array.isArray(arr)) return arr;
    const n = (options && options.hash && options.hash.n) || 1;
    return arr.slice(-Number(n));
  });

  hbs.registerHelper('length', (value) => {
    if (Array.isArray(value) || typeof value === 'string') return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  });

  hbs.registerHelper('join', function (arr, separator) {
    if (!Array.isArray(arr)) return '';
    // When called as {{join arr}}, separator is the Handlebars options object
    if (separator && typeof separator === 'object' && separator.name != null) {
      separator = undefined;
    }
    return arr.join(separator != null ? String(separator) : ',');
  });

  // ─── Formatting helpers ───

  hbs.registerHelper('numberFormat', (a, decimals) => Number(a).toFixed(Number(decimals)));

  hbs.registerHelper('pad0', (value, width) => {
    const w = Number(width) || 3;
    return String(value).padStart(w, '0');
  });

  hbs.registerHelper('addCommas', (value) => {
    const parts = String(value).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  });

  hbs.registerHelper('escape', (str) => {
    return hbs.Utils.escapeExpression(String(str));
  });
}
