import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findComments, isChecked, stripComments, UnsafeStrip } from './comments.js';

test('a comment on its own line goes with its line', () => {
  assert.equal(stripComments('a.ts', 'const one = 1;\n// why\nconst two = 2;\n'), 'const one = 1;\nconst two = 2;\n');
});

test('a comment after code goes with the spaces before it', () => {
  assert.equal(stripComments('a.ts', 'const one = 1; // why\nconst two = 2;\n'), 'const one = 1;\nconst two = 2;\n');
});

test('a doc block at the top of a file leaves no blank line behind', () => {
  assert.equal(stripComments('a.ts', '/**\n * Header.\n */\n\nimport x from "x";\n'), 'import x from "x";\n');
});

test('removing a comment between two blank lines leaves one blank line', () => {
  assert.equal(stripComments('a.ts', 'one();\n\n// why\n\ntwo();\n'), 'one();\n\ntwo();\n');
});

test('a block comment inside an expression goes with one of its spaces', () => {
  assert.equal(stripComments('a.ts', 'call(first, /* why */ second);\n'), 'call(first, second);\n');
});

test('slashes inside strings, templates and regular expressions are code, not comments', () => {
  const code = "const url = 'http://host/a';\nconst path = `//${url}/* x */`;\nconst pattern = /\\/\\/[a-z]*/g;\n";
  assert.deepEqual(findComments('a.js', code), []);
  assert.equal(stripComments('a.js', code), code);
});

test('a comment before a closing brace is found', () => {
  assert.equal(stripComments('a.ts', 'function run() {\n  work();\n  // done\n}\n'), 'function run() {\n  work();\n}\n');
});

test('tsconfig files, stylesheets and pages are checked too', () => {
  assert.equal(stripComments('tsconfig.test.json', '{\n  // why\n  "extends": "./tsconfig.json"\n}\n'), '{\n  "extends": "./tsconfig.json"\n}\n');
  assert.equal(stripComments('public/style.css', '/* panel */\n.panel { color: red; }\n'), '.panel { color: red; }\n');
  assert.equal(stripComments('public/index.html', '<body>\n  <!-- main -->\n  <main></main>\n</body>\n'), '<body>\n  <main></main>\n</body>\n');
});

test('code is checked everywhere except the host-side deploy files, CI and generated migrations', () => {
  assert.ok(isChecked('src/arena/domain/lobby.ts'));
  assert.ok(isChecked('public/app.js'));
  assert.ok(isChecked('scripts/sprites.mjs'));
  assert.ok(isChecked('tsconfig.json'));
  assert.ok(isChecked('src/view.tsx'));
  assert.ok(isChecked('public/icon.svg'));
  assert.ok(!isChecked('deploy/deploy.sh'));
  assert.ok(!isChecked('.github/workflows/ci.js'));
  assert.ok(!isChecked('drizzle/meta/_journal.json'));
  assert.ok(!isChecked('package.json'));
  assert.ok(!isChecked('README.md'));
});

test('removing an inline comment never glues two words together', () => {
  assert.equal(stripComments('a.ts', 'function value(x: number) {\n  return/**/x;\n}\n'), 'function value(x: number) {\n  return x;\n}\n');
  assert.equal(stripComments('a.js', 'let/* name */count = 1;\n'), 'let count = 1;\n');
});

test('an inline comment next to a bracket or a separator leaves no stray space', () => {
  assert.equal(stripComments('a.ts', 'call(/* first */ one, two /* last */);\n'), 'call(one, two);\n');
  assert.equal(stripComments('a.ts', 'type Pair = { left: number /* x */; right: number };\n'), 'type Pair = { left: number; right: number };\n');
  assert.equal(stripComments('a.ts', '\t/* why */ run();\n'), '\trun();\n');
});

test('a strip that would change the code is refused', () => {
  assert.throws(() => stripComments('a.js', 'const total = first+/**/+second;\n'), UnsafeStrip);
});

test('comment markers inside stylesheet strings and urls are not comments', () => {
  const stylesheet = '.a { content: "/* x */"; background: url(/x/*.png); }\n.b { background: URL( /y/*.png); }\n.c { background: url("z/*.png"); }\n';
  assert.deepEqual(findComments('public/style.css', stylesheet), []);
});

test('markup comments are found in the page and inside its inline scripts and styles, not in attributes', () => {
  const page = '<div title="<!-- no -->"></div>\n<!-- yes -->\n<script>\n  // yes\n  const url = "http://x";\n</script>\n<style>\n  /* yes */\n  .a { content: "/* no */"; }\n</style>\n';
  const found = findComments('public/index.html', page).map((range) => page.slice(range.start, range.end));
  assert.deepEqual(found, ['<!-- yes -->', '// yes', '/* yes */']);
});

test('directives are comments too', () => {
  assert.equal(findComments('a.ts', '// @ts-expect-error\nconst x: number = "a";\n').length, 1);
});

test('an inline script whose strip would change the code is refused', () => {
  assert.throws(() => stripComments('public/index.html', '<script>\nconst total = first+/**/+second;\n</script>\n'), UnsafeStrip);
});

test('a less-than sign in text does not hide a later comment', () => {
  const page = "<p>a < b's</p><!-- c -->\n";
  assert.deepEqual(findComments('public/index.html', page).map((range) => page.slice(range.start, range.end)), ['<!-- c -->']);
});

test('attributes may span lines and custom elements are not scripts or styles', () => {
  assert.deepEqual(findComments('public/index.html', '<div title="a\n> <!-- not -->\nb"></div>\n'), []);
  assert.deepEqual(findComments('public/index.html', "<style-panel>don't /* x */</style-panel>\n"), []);
});

test('a script that is not JavaScript is not parsed', () => {
  assert.deepEqual(findComments('public/index.html', '<script type="text/template">\n  <a href="//host">x</a>\n</script>\n'), []);
});

test('removing a markup comment keeps the surrounding text as it renders', () => {
  assert.equal(stripComments('public/index.html', '<p>foo<!-- c -->bar</p>\n'), '<p>foobar</p>\n');
  assert.equal(stripComments('public/index.html', '<p>( <!-- c --> baz</p>\n'), '<p>( baz</p>\n');
});

test('text inside JSX is not a comment', () => {
  assert.deepEqual(findComments('src/view.tsx', 'export const view = <div>\n  // not a comment\n</div>;\n'), []);
});

test('the space before a closing brace stays', () => {
  assert.equal(stripComments('a.ts', 'type Single = { value: number /* x */ };\n'), 'type Single = { value: number };\n');
});

test('removing a comment adds no blank line at either end of a file', () => {
  assert.equal(stripComments('a.ts', 'one();\n\n// end\n'), 'one();\n');
  assert.equal(stripComments('a.ts', '\n// start\n\nrun();\n'), '\nrun();\n');
});

test('windows line endings are kept', () => {
  assert.equal(stripComments('a.ts', 'one();\r\n// c\r\ntwo(); // d\r\n'), 'one();\r\ntwo();\r\n');
});

test('the bodies of non-JavaScript scripts, textareas, titles and character data are left alone', () => {
  const page = '<script type="application/ld+json">{"html":"<!-- data -->"}</script>\n<textarea><!-- typed --></textarea>\n<title>a <!-- b --></title>\n<svg><style><![CDATA[ .a{} ]]></style><![CDATA[ <!-- raw --> ]]></svg>\n<!-- real -->\n';
  assert.deepEqual(findComments('public/index.html', page).map((range) => page.slice(range.start, range.end)), ['<!-- real -->']);
  assert.equal(stripComments('public/index.html', page), page.replace('<!-- real -->\n', ''));
});

test('a self-closing script in an svg has no body', () => {
  const image = '<svg><script href="a.js"/><!-- c --><rect/></svg>\n';
  assert.deepEqual(findComments('public/icon.svg', image).map((range) => image.slice(range.start, range.end)), ['<!-- c -->']);
});

test('a script type with parameters is still JavaScript and a type inside another attribute is ignored', () => {
  assert.equal(findComments('public/index.html', '<script type="text/javascript; charset=utf-8">\n// c\n</script>\n').length, 1);
  assert.equal(findComments('public/index.html', '<script data-note=" type=text/plain">\n// c\n</script>\n').length, 1);
});

test('an apostrophe in an unquoted attribute does not hide a later comment', () => {
  assert.equal(findComments('public/index.html', "<p title=it's>x</p>\n<!-- c -->\n").length, 1);
});

test('a page with inline script and style is stripped segment by segment', () => {
  const page = '<script>  // first\n  run(); /* why */\n</script>\n<style>\n  /* panel */\n  .a { margin: 0/* gap */auto; }\n</style>\n';
  assert.equal(stripComments('public/index.html', page), '<script>\n  run();\n</script>\n<style>\n  .a { margin: 0 auto; }\n</style>\n');
});

test('a stylesheet comment between two words leaves a space', () => {
  assert.equal(stripComments('public/style.css', '.a { border: 1px/* c */solid red; margin: 10px /* c */ 20px; }\n'), '.a { border: 1px solid red; margin: 10px 20px; }\n');
});

test('a multi-line comment that ends a statement keeps its line break', () => {
  assert.equal(stripComments('a.js', 'const first = 1 /* c\n*/ const second = 2\n'), 'const first = 1\nconst second = 2\n');
});

test('the spaces after a comment at the end of a line go too', () => {
  assert.equal(stripComments('a.ts', 'const value = 1; /* c */   \nrun();\n'), 'const value = 1;\nrun();\n');
});

test('empty markup comments and the --!> ending close where browsers close them', () => {
  const page = '<p>a</p><!--><p>kept</p><!---><p>kept too</p><!-- b --!>\n<p>also kept</p><!-- c -->\n';
  assert.deepEqual(findComments('public/index.html', page).map((range) => page.slice(range.start, range.end)), ['<!-->', '<!--->', '<!-- b --!>', '<!-- c -->']);
  assert.equal(stripComments('public/index.html', page), '<p>a</p><p>kept</p><p>kept too</p>\n<p>also kept</p>\n');
});

test('only an svg script closes itself; in a page its body is still JavaScript', () => {
  const page = '<script type="module" />\n// why\nconst text = "<!-- x -->";\n</script>\n';
  assert.equal(stripComments('public/index.html', page), '<script type="module" />\nconst text = "<!-- x -->";\n</script>\n');
});

test('in an svg, title and textarea hold markup, not raw text', () => {
  assert.equal(findComments('public/icon.svg', '<svg><title>a <!-- b --></title></svg>\n').length, 1);
});

test('legacy JavaScript types are read as JavaScript', () => {
  assert.equal(findComments('public/index.html', '<script type="text/ecmascript">\n// c\n</script>\n').length, 1);
});

test('attributes without spaces between them and unquoted values with quotes inside are read as browsers read them', () => {
  assert.deepEqual(findComments('public/index.html', '<script data-a="x"type="text/template">a // not</script>\n'), []);
  assert.equal(findComments('public/index.html', '<a href=https://example.com/?x=">link</a>\n<!-- real -->\n').length, 1);
});

test('a stylesheet comment never merges two values into one', () => {
  assert.equal(stripComments('public/style.css', '.a { margin: 1px/* c */-1px; padding: 1/* c */.5em; width: 10%/* c */5px; }\n'), '.a { margin: 1px -1px; padding: 1 .5em; width: 10% 5px; }\n');
  assert.equal(stripComments('public/style.css', 'div/* c */.a { }\n'), 'div.a { }\n');
});

test('escapes and identifiers that end in url do not confuse the stylesheet scanner', () => {
  assert.equal(findComments('public/style.css', '.a\\" { } /* c */\n').length, 1);
  assert.deepEqual(findComments('public/style.css', '.a { content: "a\\\r\n/* not */"; }\n'), []);
  assert.equal(findComments('public/style.css', '.a { background: my-url(/* c */ foo); }\n').length, 1);
  assert.deepEqual(findComments('public/style.css', '.a { background: url(a\\)b/*.png); }\n'), []);
});
