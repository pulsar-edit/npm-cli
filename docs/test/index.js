const t = require('tap')
const { join } = require('path')
const walk = require('ignore-walk')
const { paths: { content: CONTENT_DIR, nav: NAV, template: TEMPLATE } } = require('../lib/index.js')

const testBuildDocs = async (t, { verify, ...opts } = {}) => {
  const mockedBuild = require('../lib/build.js')

  const fixtures = {
    man: {},
    html: {},
    md: {},
    ...opts,
  }

  const root = t.testdir(fixtures)

  const paths = {
    content: fixtures.content ? join(root, 'content') : CONTENT_DIR,
    template: fixtures.template ? join(root, 'template') : TEMPLATE,
    nav: fixtures.nav ? join(root, 'nav') : NAV,
    man: join(root, 'man'),
    html: join(root, 'html'),
    md: join(root, 'md'),
  }

  return {
    results: await mockedBuild({ ...paths, verify }),
    root,
    ...paths,
  }
}

t.test('builds and verifies the real docs', async (t) => {
  const { man, html, md, results } = await testBuildDocs(t, { verify: true })

  const allFiles = (await Promise.all([
    walk({ path: man }).then(r => r.length),
    walk({ path: html }).then(r => r.length),
    walk({ path: md }).then(r => r.length),
  ])).reduce((a, b) => a + b, 0)

  t.equal(allFiles, results.length)
})

t.test('fails on mismatched nav', async t => {
  await t.rejects(() => testBuildDocs(t, {
    content: { 'test.md': '' },
    nav: '- url: /test2',
  }), 'Documentation navigation (nav.yml) does not match filesystem')
})

t.test('missing placeholders', async t => {
  t.test('command', async t => {
    await t.rejects(testBuildDocs(t, {
      content: {
        commands: { 'npm-access.md': '<!-- AUTOGENERATED USAGE DESCRIPTIONS -->' },
      },
    }), /npm-access\.md/)
    await t.rejects(testBuildDocs(t, {
      content: {
        commands: { 'npm-access.md': '<!-- AUTOGENERATED CONFIG DESCRIPTIONS -->' },
      },
    }), /npm-access\.md/)
  })

  t.test('definitions', async t => {
    await t.rejects(testBuildDocs(t, {
      content: {
        'using-npm': { 'config.md': '<!-- AUTOGENERATED CONFIG SHORTHANDS -->' },
      },
    }), /config\.md/)
    await t.rejects(testBuildDocs(t, {
      content: {
        'using-npm': { 'config.md': '<!-- AUTOGENERATED CONFIG DESCRIPTIONS -->' },
      },
    }), /config\.md/)
  })
})

t.test('html', async t => {
  // these don't happen anywhere in the docs so test this for coverage
  // but we test for coverage
  t.test('files can link to root pages', async t => {
    await testBuildDocs(t, {
      content: { 'test.md': '[link](/test)' },
      nav: '- url: /test',
    })
  })

  t.test('succeeds with empty content', async t => {
    await testBuildDocs(t, {
      content: { 'test.md': '' },
      nav: '- url: /test',
      template: '{{ content }}',
    })
  })

  t.test('fails on missing vars in template', async t => {
    await t.rejects(() => testBuildDocs(t, {
      template: '{{ hello }}',
    }), /\{\{ hello \}\}/)
  })

  t.test('rewrites img src', async t => {
    await testBuildDocs(t, {
      content: { 'test.md': '![](/src)' },
      nav: '- url: /test',
    })
  })
})
