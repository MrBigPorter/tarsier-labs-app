/* eslint-env jest */
/**
 * Jest setup file — mocks native modules that require native linking.
 *
 * React Native native modules are not available in the Jest test runner,
 * so we provide lightweight mock implementations here.
 */

// react-native-keyboard-controller — native keyboard management
jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  return {
    KeyboardProvider: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    useReanimatedKeyboardAnimation: () => ({
      height: { value: 0 },
      progress: { value: 0 },
    }),
    useKeyboardHandler: () => {},
    KeyboardController: {
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    },
    KeyboardEvents: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// react-native-gesture-handler — native gesture handling
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement(
        View,
        { ...props, style: [{ flex: 1 }, props.style] },
        children,
      ),
    Gesture: {
      Tap: () => ({}),
      Pan: () => ({}),
      Pinch: () => ({}),
      Rotation: () => ({}),
      Fling: () => ({}),
      Native: () => ({}),
      LongPress: () => ({}),
      ForceTouch: () => ({}),
      Manual: () => ({}),
      Race: (...gestures) => ({}),
      Simultaneous: (...gestures) => ({}),
      Exclusive: (...gestures) => ({}),
    },
    GestureDetector: ({ children }) => children,
    NativeViewGestureHandler: ({ children }) => children,
    PanGestureHandler: ({ children }) => children,
    TapGestureHandler: ({ children }) => children,
    LongPressGestureHandler: ({ children }) => children,
    PinchGestureHandler: ({ children }) => children,
    RotationGestureHandler: ({ children }) => children,
    FlingGestureHandler: ({ children }) => children,
    State: {
      ACTIVE: 4,
      END: 5,
      FAILED: 1,
      BEGAN: 2,
      CANCELLED: 3,
      UNDETERMINED: 0,
    },
    Swipeable: ({ children }) => children,
    DrawerLayout: ({ children }) => children,
    TouchableOpacity: ({ children, ...props }) => {
      const TouchableOpacity = require('react-native').TouchableOpacity;
      return React.createElement(TouchableOpacity, props, children);
    },
    TouchableHighlight: ({ children, ...props }) => {
      const TouchableHighlight = require('react-native').TouchableHighlight;
      return React.createElement(TouchableHighlight, props, children);
    },
  };
});

// react-native-reanimated — native animation engine
// IMPORTANT: FlatList and ScrollView are mocked as simple View components
// to prevent VirtualizedList timers from running in tests.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const View = require('react-native').View;
  const MockScrollView = React.forwardRef(({ children, ...props }, ref) =>
    React.createElement(View, { ...props, ref }, children),
  );
  MockScrollView.displayName = 'MockScrollView';
  const MockFlatList = React.forwardRef(
    ({ data, renderItem, ListEmptyComponent, ...props }, ref) =>
      React.createElement(View, { ...props, ref, testID: 'mock-flatlist' }),
  );
  MockFlatList.displayName = 'MockFlatList';
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: component => component,
      View: View,
      Text: require('react-native').Text,
      Image: require('react-native').Image,
      ScrollView: MockScrollView,
      FlatList: MockFlatList,
    },
    useSharedValue: init => ({ value: init }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: fn => ({ value: fn() }),
    withTiming: toValue => toValue,
    withSpring: toValue => toValue,
    withRepeat: animation => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    withDelay: (delay, animation) => animation,
    interpolate: (value, inputRange, outputRange) => outputRange[0],
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: {
      linear: t => t,
      ease: t => t,
      in: easing => easing,
      out: easing => easing,
      inOut: easing => easing,
      bezier: () => t => t,
      sin: t => t,
      circle: t => t,
      exp: t => t,
      poly: () => t => t,
      quad: t => t,
      cubic: t => t,
      bounce: t => t,
      elastic: t => t,
      back: t => t,
    },
    FadeIn: { duration: () => ({}), delay: () => ({}) },
    FadeOut: { duration: () => ({}), delay: () => ({}) },
    SlideInLeft: { duration: () => ({}), delay: () => ({}) },
    SlideInRight: { duration: () => ({}), delay: () => ({}) },
    SlideOutLeft: { duration: () => ({}), delay: () => ({}) },
    SlideOutRight: { duration: () => ({}), delay: () => ({}) },
    ZoomIn: { duration: () => ({}), delay: () => ({}) },
    ZoomOut: { duration: () => ({}), delay: () => ({}) },
    FlipInX: { duration: () => ({}), delay: () => ({}) },
    FlipOutX: { duration: () => ({}), delay: () => ({}) },
    StretchInX: { duration: () => ({}), delay: () => ({}) },
    StretchOutX: { duration: () => ({}), delay: () => ({}) },
    Layout: { duration: () => ({}), delay: () => ({}) },
    SequencedTransition: { duration: () => ({}), delay: () => ({}) },
    JumpingTransition: { duration: () => ({}), delay: () => ({}) },
    CurvedTransition: { duration: () => ({}), delay: () => ({}) },
    EntryExitTransition: { duration: () => ({}), delay: () => ({}) },
    combineTransition: () => ({}),
    runOnJS: fn => fn,
    runOnUI: fn => fn,
    useAnimatedProps: () => ({}),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => ({}),
    useAnimatedGestureHandler: () => ({}),
    useAnimatedReaction: (prepare, react) => {},
    createAnimatedComponent: component => component,
    makeMutable: init => ({ value: init }),
    Animation: () => ({}),
    processColor: color => color,
    Platform: { OS: 'web' },
    screenTransition: {
      create: () => ({}),
      build: () => ({}),
    },
  };
});

// react-native-blurhash — blurhash native rendering
jest.mock('react-native-blurhash', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    Blurhash: ({ blurhash, ...props }) =>
      React.createElement(View, {
        ...props,
        style: [{ backgroundColor: '#e0e0e0' }, props.style],
        testID: 'blurhash-mock',
      }),
    BlurhashRenderer: ({ blurhash, ...props }) =>
      React.createElement(View, {
        ...props,
        style: [{ backgroundColor: '#e0e0e0' }, props.style],
      }),
  };
});

// react-native-video — native video player
jest.mock('react-native-video', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: React.forwardRef(({ source, ...props }, ref) =>
      React.createElement(View, { ...props, ref, testID: 'video-mock' }),
    ),
  };
});

// react-native-fast-image — performant image loading
jest.mock('react-native-fast-image', () => {
  const React = require('react');
  const Image = require('react-native').Image;
  return {
    __esModule: true,
    default: props => React.createElement(Image, props),
    priority: { low: 'low', normal: 'normal', high: 'high' },
    resizeMode: {
      contain: 'contain',
      cover: 'cover',
      stretch: 'stretch',
      center: 'center',
    },
  };
});

// react-native-keychain — secure credential storage
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve()),
  getGenericPassword: jest.fn(() =>
    Promise.resolve({ password: 'mock-token' }),
  ),
  resetGenericPassword: jest.fn(() => Promise.resolve()),
  SECURITY_LEVEL: {
    ANY: 'ANY',
    SECURE_SOFTWARE: 'SECURE_SOFTWARE',
    SECURE_HARDWARE: 'SECURE_HARDWARE',
  },
}));

// react-native-splash-screen / bootsplash — native splash
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(() => Promise.resolve()),
  show: jest.fn(() => Promise.resolve()),
  getVisibilityStatus: jest.fn(() => Promise.resolve('hidden')),
}));

// react-native-sse — Server-Sent Events
jest.mock('react-native-sse', () => {
  return jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeAllEventListeners: jest.fn(),
    close: jest.fn(),
    error: jest.fn(),
    message: jest.fn(),
  }));
});

// MMKV mock for storage
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn(key => store.get(key) ?? null),
      set: jest.fn((key, value) => store.set(key, value)),
      delete: jest.fn(key => store.delete(key)),
      clearAll: jest.fn(() => store.clear()),
      getAllKeys: jest.fn(() => Array.from(store.keys())),
      contains: jest.fn(key => store.has(key)),
      getBoolean: jest.fn(key => {
        const v = store.get(key);
        return v === 'true' ? true : v === 'false' ? false : null;
      }),
      getNumber: jest.fn(key => {
        const v = store.get(key);
        return v != null ? Number(v) : NaN;
      }),
    })),
    useMMKVStorage: jest.fn(() => []),
  };
});

// react-native-safe-area-context — safe area insets
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const View = require('react-native').View;
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children, ...props }) =>
      React.createElement(
        View,
        { ...props, style: [{ flex: 1 }, props.style] },
        children,
      ),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
    },
    SafeAreaFrameContext: {
      Consumer: ({ children }) => children(frame),
    },
    initialWindowMetrics: { insets, frame },
  };
});

// @react-native-community/netinfo — network status
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    }),
  ),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  },
}));

// @react-native-community/blur — native blur view
jest.mock('@react-native-community/blur', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    BlurView: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement(View, { ...props, ref }, children),
    ),
  };
});

// react-native-fs — native file system access
jest.mock('react-native-fs', () => ({
  downloadFile: jest.fn(() => Promise.resolve({ statusCode: 200, jobId: 1 })),
  readDir: jest.fn(() => Promise.resolve([])),
  readFile: jest.fn(() => Promise.resolve('')),
  writeFile: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
  exists: jest.fn(() => Promise.resolve(true)),
  DocumentDirectoryPath: '/mock/document',
  CacheDirectoryPath: '/mock/cache',
  CachesDirectoryPath: '/mock/caches',
}));

// @sentry/react-native — crash reporting (mock to prevent native calls)
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  configureScope: jest.fn(),
  withScope: jest.fn(),
  startTransaction: jest.fn(() => ({ finish: jest.fn() })),
  ReactNativeTracing: jest.fn(() => ({})),
  reactNativeTracingIntegration: jest.fn(),
  nativeCrash: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  Severity: {
    Error: 'error',
    Warning: 'warning',
    Log: 'log',
    Info: 'info',
    Debug: 'debug',
  },
}));

// react-native-code-push — hot update (code-push-server SDK)
// CodePush wraps the root component with an HOC that checks for updates.
// In tests, we just return the component unmocked so it renders normally.
jest.mock('react-native-code-push', () => {
  const codePush = jest.fn(options => component => component);
  codePush.CheckFrequency = { ON_APP_RESUME: 0 };
  codePush.InstallMode = { ON_NEXT_RESTART: 0 };
  return codePush;
});

// react-native-worklets-core — worklet threading
jest.mock('react-native-worklets', () => ({
  createWorklet: fn => fn,
  runOnWorklet: fn => fn,
  runOnJS: fn => fn,
}));

// react-native-svg — SVG rendering
jest.mock('react-native-svg', () => {
  const React = require('react');
  const View = require('react-native').View;
  const mockComponent = displayName => {
    const Comp = React.forwardRef((props, ref) =>
      React.createElement(View, { ...props, ref, testID: displayName }),
    );
    Comp.displayName = displayName;
    return Comp;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    SvgXml: mockComponent('SvgXml'),
    SvgCss: mockComponent('SvgCss'),
    SvgWithCss: mockComponent('SvgWithCss'),
    Path: mockComponent('Path'),
    Circle: mockComponent('Circle'),
    Rect: mockComponent('Rect'),
    Line: mockComponent('Line'),
    G: mockComponent('G'),
    Text: mockComponent('SvgText'),
    TSpan: mockComponent('TSpan'),
    Polygon: mockComponent('Polygon'),
    Polyline: mockComponent('Polyline'),
    Ellipse: mockComponent('Ellipse'),
    Defs: mockComponent('Defs'),
    ClipPath: mockComponent('ClipPath'),
    Mask: mockComponent('Mask'),
    LinearGradient: mockComponent('LinearGradient'),
    RadialGradient: mockComponent('RadialGradient'),
    Stop: mockComponent('Stop'),
    Image: mockComponent('SvgImage'),
    Use: mockComponent('Use'),
    Symbol: mockComponent('Symbol'),
  };
});

// react-native-share — native share dialog
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ success: true, message: 'shared' })),
  Share: { open: jest.fn(() => Promise.resolve({ success: true })) },
}));

// react-native-markdown-display — markdown rendering
jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const View = require('react-native').View;
  const Text = require('react-native').Text;
  return {
    __esModule: true,
    default: React.forwardRef(({ children, style, ...props }, ref) =>
      React.createElement(
        View,
        { ...props, ref, testID: 'markdown-mock' },
        React.createElement(Text, null, String(children || '')),
      ),
    ),
    Markdown: React.forwardRef(({ children, style, ...props }, ref) =>
      React.createElement(
        View,
        { ...props, ref, testID: 'markdown-mock' },
        React.createElement(Text, null, String(children || '')),
      ),
    ),
  };
});

// @welldone-software/why-did-you-render — dev-only render tracking
jest.mock('@welldone-software/why-did-you-render', () => {
  return jest.fn();
});

/**
 * Override requestAnimationFrame to prevent PerfProvider's FPS loop
 * from running in tests.
 *
 * The @react-native/jest-preset's setup.js sets requestAnimationFrame to
 *   setTimeout(callback, 0)
 * which creates an infinite setTimeout loop via the recursive
 *   requestAnimationFrame(tick) pattern in PerfProviderInner.
 *
 * This override stops the loop entirely, eliminating:
 *  - "An update to PerfProviderInner ... not wrapped in act(...)"
 *  - "ReferenceError: Jest environment torn down" (from setFps() after teardown)
 */
global.requestAnimationFrame = jest.fn().mockReturnValue(0);
global.cancelAnimationFrame = jest.fn();
