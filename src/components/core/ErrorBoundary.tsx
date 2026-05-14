import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import { logger } from '../../lib/logger';

interface Props {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Error handler callback (e.g. send to Sentry) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary component.
 * Catches JavaScript errors in the component tree and displays a fallback UI
 * instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ErrorBoundary caught:', error);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// ===================== Fallback UI =====================

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

export function DefaultErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconContainer}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.error + '20' }, // 12% opacity
          ]}
        >
          <Text style={[styles.iconText, { color: colors.error }]}>!</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        An unexpected error occurred. Please try again.
      </Text>

      {/* Error detail in dev mode */}
      {__DEV__ && error && (
        <View
          style={[
            styles.errorDetails,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.errorLabel, { color: colors.textSecondary }]}>
            Error Details:
          </Text>
          <ScrollView horizontal>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error.toString()}
              {'\n'}
              {error.stack}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.supportText, { color: colors.textTertiary }]}>
        If the problem persists, please contact support.
      </Text>
    </View>
  );
}

// ===================== Wrappers =====================

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
}

/** Screen-level error boundary */
export function ScreenErrorBoundary({ children }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      fallback={
        <View style={{ padding: spacing[6], paddingTop: spacing[12] }}>
          <DefaultErrorFallback
            error={null}
            onRetry={() => {
              // For screen-level, we just reset the boundary
            }}
          />
        </View>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/** Component-level error boundary with compact fallback UI */
export function ComponentErrorBoundary({ children }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      fallback={
        <CompactErrorFallback />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

function CompactErrorFallback() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.compactContainer,
        {
          backgroundColor: colors.error + '10',
          borderColor: colors.error + '30',
        },
      ]}
    >
      <Text style={[styles.compactText, { color: colors.error }]}>
        Component failed to load
      </Text>
    </View>
  );
}

// ===================== Styles =====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    minHeight: 400,
  },
  iconContainer: {
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight as any,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    marginBottom: spacing[6],
    paddingHorizontal: spacing[4],
  },
  errorDetails: {
    width: '100%',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing[6],
  },
  errorLabel: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  errorText: {
    fontSize: typography.xs.fontSize,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  primaryButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  supportText: {
    fontSize: typography.small.fontSize,
    textAlign: 'center',
  },
  compactContainer: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  compactText: {
    fontSize: typography.small.fontSize,
    fontWeight: '500',
  },
});
