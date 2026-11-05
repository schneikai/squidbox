// A spacing property inside a style: a StyleSheet's or an inline `style` prop's.
const SPACING_KEY = 'Property[key.name=/^(padding|margin|gap|rowGap|columnGap|top|left|right|bottom)/]';
// A raw number for it: a literal other than 0, a negative one, or a scale(n).
const RAW_NUMBER = `:matches(Literal[raw=/^[1-9]/], UnaryExpression[operator='-'][argument.type='Literal'], CallExpression[callee.name='scale'], UnaryExpression[operator='-'][argument.callee.name='scale'])`;
const SPACING_MESSAGE = 'spacing: a space step or a layout role, not a number (styles/designTokens.js)';

module.exports = {
  root: true,
  extends: ['universe/native'],
  // React Native provides it (setUpXHR.js); universe/native doesn't list it.
  globals: { AbortController: 'readonly' },
  rules: {
    // Every padding, margin, gap and offset is a `space` step or a `layout` role; a number kept on
    // purpose says why in an eslint-disable-next-line comment.
    'no-restricted-syntax': [
      'error',
      {
        selector: `CallExpression[callee.object.name='StyleSheet'][callee.property.name='create'] ${SPACING_KEY} > ${RAW_NUMBER}`,
        message: SPACING_MESSAGE,
      },
      { selector: `JSXAttribute[name.name='style'] ${SPACING_KEY} > ${RAW_NUMBER}`, message: SPACING_MESSAGE },
    ],
  },
};
