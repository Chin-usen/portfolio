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
        'http://localhost/lab/sample-teardown/',
        'http://localhost/lab/sample-simulation/',
        'http://localhost/lab/chip-junction-temperature/',
        'http://localhost/about/',
        'http://localhost/en/',
        'http://localhost/en/work/',
        'http://localhost/en/work/sample-case/',
        'http://localhost/en/work/career-case-b/',
        'http://localhost/en/work/career-case-c/',
        'http://localhost/en/lab/',
        'http://localhost/en/lab/sample-teardown/',
        'http://localhost/en/lab/sample-simulation/',
        'http://localhost/en/lab/chip-junction-temperature/',
        'http://localhost/en/about/',
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
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/reports' },
  },
};
