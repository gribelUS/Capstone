import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const terserOptions = {
  compress: {
    drop_console: false,
    drop_debugger: true,
    pure_funcs: [],
    passes: 2,
    ecma: 2018
  },
  mangle: {
    properties: false
  },
  format: {
    comments: false
  }
};

export default {
  input: 'src/client.ts',
  output: [
    {
      file: 'dist/ultralytics.js',
      format: 'umd',
      name: 'Ultralytics',
      sourcemap: true,
      exports: 'named',
      globals: {}
    },
    {
      file: 'dist/ultralytics.min.js',
      format: 'umd',
      name: 'Ultralytics',
      sourcemap: true,
      exports: 'named',
      globals: {},
      plugins: [terser(terserOptions)]
    },
    {
      file: 'dist/ultralytics.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named'
    },
    {
      file: 'dist/ultralytics.esm.min.js',
      format: 'es',
      sourcemap: true,
      exports: 'named',
      plugins: [terser(terserOptions)]
    }
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined
    })
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false
  }
};
