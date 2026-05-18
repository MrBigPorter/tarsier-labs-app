module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest-setup.js'],
  clearMocks: true,
  forceExit: true,
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      'react-native|' +
      'react-redux|' +
      '@reduxjs/toolkit|' +
      'immer|' +
      'i18next|' +
      'react-i18next|' +
      '@react-navigation|' +
      'react-native-markdown-display|' +
      'react-native-sse|' +
      'react-native-video|' +
      'react-native-svg' +
      ')/)',
  ],
};
