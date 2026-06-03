/**
 * @format
 */

// Hermes global polyfills — MUST be imported first to ensure all browser
// globals are declared before any third-party code references them.
// @see src/lib/globals.ts for full documentation.
import './src/lib/globals';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
