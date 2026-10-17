// eslint-disable-next-line @typescript-eslint/no-require-imports -- LHCI loads its config as CommonJS.
const { readdirSync, readFileSync } = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- LHCI loads its config as CommonJS.
const { join } = require('node:path');
const labRoot = join(__dirname, 'src/components/lab');
const installedPages = readdirSync(labRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .flatMap((entry) => {
    try {
      return [JSON.parse(readFileSync(join(labRoot, entry.name, 'page.json'), 'utf8'))];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  });
const additionalPages = installedPages
  .filter((page) => !['half-bridge-module', 'chip-junction-temperature'].includes(page.slug))
  .map((page) => page.slug)
  .sort();
const additionalUrls = additionalPages.flatMap((slug) => [
  `http://localhost/lab/${slug}/`,
  `http://localhost/en/lab/${slug}/`,
]);

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      isSinglePageApplication: false,
      numberOfRuns: 3,
      url: [
        'http://localhost/',
        'http://localhost/work/',
        'http://localhost/work/sample-case/',
        'http://localhost/work/career-case-b/',
        'http://localhost/work/career-case-c/',
        'http://localhost/lab/',
        'http://localhost/lab/half-bridge-module/',
        'http://localhost/lab/sample-simulation/',
        'http://localhost/lab/chip-junction-temperature/',
        'http://localhost/about/',
        'http://localhost/en/',
        'http://localhost/en/work/',
        'http://localhost/en/work/sample-case/',
        'http://localhost/en/work/career-case-b/',
        'http://localhost/en/work/career-case-c/',
        'http://localhost/en/lab/',
        'http://localhost/en/lab/half-bridge-module/',
        'http://localhost/en/lab/sample-simulation/',
        'http://localhost/en/lab/chip-junction-temperature/',
        'http://localhost/en/about/',
        ...additionalUrls,
      ],
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: 'simulate',
        onlyCategories: ['performance', 'accessibility', 'seo'],
      },
    },
    assert: {
      assertMatrix: [
        ...additionalPages.map((slug) => ({
          matchingUrlPattern: `/lab/${slug}/`,
          assertions: {
            'largest-contentful-paint': [
              'error',
              { maxNumericValue: 2499, aggregationMethod: 'median' },
            ],
          },
        })),
        {
          assertions: {
            'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
            'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
          },
        },
        {
          matchingUrlPattern: 'chip-junction-temperature',
          assertions: {
            'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'largest-contentful-paint': [
              'error',
              { maxNumericValue: 2499, aggregationMethod: 'median' },
            ],
          },
        },
        {
          matchingUrlPattern: 'half-bridge-module',
          assertions: {
            'largest-contentful-paint': [
              'error',
              { maxNumericValue: 2499, aggregationMethod: 'median' },
            ],
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/reports' },
  },
};
