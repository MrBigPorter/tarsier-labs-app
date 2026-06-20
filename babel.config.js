module.exports = {
  presets: [['module:@react-native/babel-preset', { inlineRequires: true }]],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@': './src',
          '@assets': './assets',
        },
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
      },
    ],
    // Inline process.env.APP_ENV at build time so we can skip CodePush sync
    // in staging builds without a native module.
    [
      'babel-plugin-transform-inline-environment-variables',
      {
        include: ['APP_ENV'],
      },
    ],
    // react-native-reanimated must be listed last per docs
    'react-native-reanimated/plugin',
  ],
};
