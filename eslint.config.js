// ESLint 9/10 flat config. Focuses on correctness (unused vars, undefined
// references, unreachable code, etc.); code formatting is intentionally left
// to the developer/editor rather than enforced here — modern ESLint removed
// the core stylistic rules the old .eslintrc used.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      // Node runs the server/tools/build; the frontend/ bundles run in the
      // browser. Allowing both global sets keeps no-undef accurate for all.
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      'no-console': 'off',
      // Ignore deliberately-unused identifiers prefixed with _ (e.g. _event,
      // _error callback args kept for signature clarity).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.mocha } }
  }
];
