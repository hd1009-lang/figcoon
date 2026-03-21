import typescript from '@rollup/plugin-typescript';

export default {
  input: 'code.ts',
  output: {
    file: 'code.js',
    format: 'cjs',
    name: 'code',
  },
  plugins: [typescript()],
};