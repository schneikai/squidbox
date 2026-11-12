// A spacing key, named or quoted: padding*, margin*, gap, rowGap, columnGap and the offsets.
const SPACING_KEY =
  '/^((padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?|gap|rowGap|columnGap|top|left|right|bottom|start|end|inset)$/';
// A constant named for a spacing.
const SPACING_CONST = '/(GAP|PADDING|INSET|MARGIN|OFFSET|GUTTER)$/';
// A number other than 0 anywhere in its value (a literal, a sum, a ternary, scale(n), -n), except
// the 2 that halves something (`/ 2`) and an array index.
const RAW_NUMBER = `Literal[raw=/^(?!0(\\.0*)?$)[0-9.]/]:not(BinaryExpression[operator='/'] > Literal.right[value=2]):not(MemberExpression > Literal.property)`;
const SPACING_MESSAGE = 'spacing: a space step or a layout role, not a number (styles/designTokens.ts)';
// Every padding, margin, gap and offset in any object (a StyleSheet, an inline style, a plain style
// object) and every spacing constant is a `space` step or a `layout` role; a number kept on purpose
// says why in an eslint-disable-next-line comment.
const SPACING_RULE = {
  selector: `:matches(Property[key.name=${SPACING_KEY}], Property[key.value=${SPACING_KEY}], VariableDeclarator[id.name=${SPACING_CONST}]) ${RAW_NUMBER}`,
  message: SPACING_MESSAGE,
};

// CLAUDE.md → Code layout: every colour is a `palette` entry in styles/designTokens.ts with a role named by
// purpose; a hex literal anywhere else is a one-off an agent will copy.
const HEX_COLOR_RULE = {
  selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/], TemplateElement[value.raw=/^#[0-9a-fA-F]{3,8}$/]',
  message: 'A colour lives in `palette` with a role named by purpose (styles/designTokens.ts), not as a hex literal.',
};
const FC_RULE = {
  selector:
    'TSTypeReference[typeName.name=/^(FC|FunctionComponent)$/], TSTypeReference[typeName.right.name=/^(FC|FunctionComponent)$/]',
  message: 'Type the props (`type XProps`) instead of React.FC (CLAUDE.md → Code layout).',
};
// CLAUDE.md → UI / Components: "Don't spread style objects in screens or features". A token's fields are
// named one by one, or the token goes into the style array at the use site.
const STYLE_SPREAD_RULE = {
  selector: "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create'] SpreadElement",
  message:
    'No spreading of style objects in screens or features (CLAUDE.md → UI / Components): name the fields, or put the token in the style array.',
};

module.exports = {
  root: true,
  extends: ['universe/native'],
  // React Native provides it (setUpXHR.js); universe/native doesn't list it.
  globals: { AbortController: 'readonly' },
  overrides: [
    {
      // The app's code, not its tests or scripts: the spacing rule, and CLAUDE.md → Code layout's
      // TypeScript rule: no `any`, no React.FC.
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      rules: {
        // `any` only at a third-party edge, with an eslint-disable comment saying why.
        '@typescript-eslint/no-explicit-any': 'error',
        'no-restricted-syntax': ['error', SPACING_RULE, FC_RULE, HEX_COLOR_RULE],
      },
    },
    {
      files: ['src/styles/designTokens.ts'],
      rules: { 'no-restricted-syntax': ['error', SPACING_RULE, FC_RULE] },
    },
    {
      files: ['src/features/**/*.ts', 'src/features/**/*.tsx', 'src/app/**/*.ts', 'src/app/**/*.tsx'],
      rules: { 'no-restricted-syntax': ['error', SPACING_RULE, FC_RULE, HEX_COLOR_RULE, STYLE_SPREAD_RULE] },
    },
  ],
};
