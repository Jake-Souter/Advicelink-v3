// @ts-check
import base from './index.js';
import globals from 'globals';

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
