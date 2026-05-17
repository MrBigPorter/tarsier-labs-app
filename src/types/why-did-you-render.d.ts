/**
 * Type augmentation for @welldone-software/why-did-you-render
 *
 * Extends React component types to support the `.whyDidYouRender` property
 * used to selectively track component re-renders during development.
 *
 * Usage:
 *   import { EmptyLogoContent } from './EmptyLogoContent';
 *   EmptyLogoContent.whyDidYouRender = true;
 */
import 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FunctionComponent<P = {}> {
    whyDidYouRender?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FC<P = {}> {
    whyDidYouRender?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface MemoExoticComponent<T = any> {
    whyDidYouRender?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ExoticComponent<P = {}> {
    whyDidYouRender?: boolean;
  }
}
