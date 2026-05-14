module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-reanimated must be listed last per docs
    'react-native-reanimated/plugin',
  ],
};
