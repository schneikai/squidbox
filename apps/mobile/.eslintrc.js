module.exports = {
  root: true,
  extends: ['universe/native'],
  // React Native provides it (setUpXHR.js); universe/native doesn't list it.
  globals: { AbortController: 'readonly' },
  overrides: [
    {
      // CLAUDE.md → Code layout's TypeScript rule for the app's code: no `any`, no React.FC.
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      rules: {
        // `any` only at a third-party edge, with an eslint-disable comment saying why.
        '@typescript-eslint/no-explicit-any': 'error',
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'TSTypeReference[typeName.name=/^(FC|FunctionComponent)$/], TSTypeReference[typeName.right.name=/^(FC|FunctionComponent)$/]',
            message: 'Type the props (`type XProps`) instead of React.FC (CLAUDE.md → Code layout).',
          },
        ],
      },
    },
  ],
};
