/**
 * AuthScreen — Login and registration
 *
 * Features:
 * - Login form (email + password)
 * - Registration form (nickname + email + password + confirm)
 * - Toggle between login/register modes
 * - Form validation
 * - Loading state during submission
 * - Error display
 * - Social login buttons (Google, Apple) — placeholder
 *
 * Data:
 * - Redux authSlice login thunk
 * - register endpoint (RTK Query mutation)
 *
 * Edge cases:
 * - Network error
 * - Validation errors
 * - Already authenticated → redirect
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useAppDispatch, useAppSelector } from '../store';
import { login, clearError } from '../store/slices/authSlice';
import { useRegisterMutation } from '../api/endpoints/auth';
import Header from '../components/layout/Header';
import SvgIcon from '../components/core/SvgIcon';
import type { RootStackScreenProps } from '../navigation/types';

type AuthMode = 'login' | 'register';

interface FormErrors {
  nickname?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const AuthScreen: React.FC<RootStackScreenProps<'Auth'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
  const dispatch = useAppDispatch();
  const { isLoading, error: authError } = useAppSelector(state => state.auth);

  // ─── State ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AuthMode>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // RTK Query mutation for registration
  const [registerMutation, { isLoading: isRegistering }] =
    useRegisterMutation();

  // ─── Validation ─────────────────────────────────────────────────────

  const validate = useCallback((): FormErrors => {
    const errors: FormErrors = {};

    if (mode === 'register') {
      if (!nickname.trim()) {
        errors.nickname = 'Nickname is required';
      } else if (nickname.trim().length < 2) {
        errors.nickname = 'Nickname must be at least 2 characters';
      }
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'register') {
      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    return errors;
  }, [mode, nickname, email, password, confirmPassword]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleModeSwitch = useCallback(() => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setFormErrors({});
    dispatch(clearError());
  }, [dispatch]);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    if (mode === 'login') {
      dispatch(login({ email: email.trim(), password }));
    } else {
      try {
        await registerMutation({
          nickname: nickname.trim(),
          email: email.trim(),
          password,
        }).unwrap();
        // Auto-switch to login mode after successful registration
        setMode('login');
        Alert.alert(
          'Registration Successful',
          'Please check your email to verify your account, then sign in.',
        );
      } catch {
        // Error is handled by RTK Query
      }
    }
  }, [mode, email, password, nickname, validate, dispatch, registerMutation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const isSubmitting = isLoading || isRegistering;

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title=""
        showBack
        onBackPress={handleGoBack}
        hideSearch
        hideAvatar
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header ────────────────────────────────────────────── */}
          <View style={styles.authHeader}>
            <View
              style={[
                styles.logoIcon,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text
              style={[
                styles.welcomeText,
                {
                  color: colors.text,
                  fontFamily: typography.h3.fontFamily,
                  fontSize: typography.h3.fontSize,
                  fontWeight: typography.h3.fontWeight,
                },
              ]}
            >
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary },
              ]}
            >
              {mode === 'login'
                ? 'Sign in to access your bookmarks and comments'
                : 'Join the Tarsier community'}
            </Text>
          </View>

          {/* ─── Form ──────────────────────────────────────────────── */}
          <View style={styles.form}>
            {/* Nickname (register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Nickname
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: formErrors.nickname
                        ? '#EF4444'
                        : colors.border,
                    },
                  ]}
                  placeholder="Your display name"
                  placeholderTextColor={colors.textSecondary}
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
                {formErrors.nickname && (
                  <Text style={styles.errorText}>
                    {formErrors.nickname}
                  </Text>
                )}
              </View>
            )}

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Email
              </Text>
              <TextInput
                ref={emailRef}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: formErrors.email
                      ? '#EF4444'
                      : colors.border,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {formErrors.email && (
                <Text style={styles.errorText}>{formErrors.email}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Password
              </Text>
              <View
                style={[
                  styles.passwordContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: formErrors.password
                      ? '#EF4444'
                      : colors.border,
                  },
                ]}
              >
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.passwordInput,
                    { color: colors.text },
                  ]}
                  placeholder={
                    mode === 'register'
                      ? 'At least 6 characters'
                      : 'Your password'
                  }
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType={
                    mode === 'register' ? 'next' : 'done'
                  }
                  onSubmitEditing={() => {
                    if (mode === 'register') {
                      confirmPasswordRef.current?.focus();
                    } else {
                      handleSubmit();
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(prev => !prev)}
                  style={styles.eyeButton}
                >
                  <SvgIcon
                    name={showPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {formErrors.password && (
                <Text style={styles.errorText}>
                  {formErrors.password}
                </Text>
              )}
            </View>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Confirm Password
                </Text>
                <TextInput
                  ref={confirmPasswordRef}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: formErrors.confirmPassword
                        ? '#EF4444'
                        : colors.border,
                    },
                  ]}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                {formErrors.confirmPassword && (
                  <Text style={styles.errorText}>
                    {formErrors.confirmPassword}
                  </Text>
                )}
              </View>
            )}

            {/* API Error */}
            {authError && (
              <View style={styles.apiError}>
                <SvgIcon
                  name="alert-circle"
                  size={16}
                  color="#EF4444"
                />
                <Text style={styles.apiErrorText}>{authError}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitButton,
                {
                  backgroundColor: isSubmitting
                    ? colors.primary + '60'
                    : colors.primary,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mode Switch */}
            <View style={styles.switchRow}>
              <Text
                style={[
                  styles.switchText,
                  { color: colors.textSecondary },
                ]}
              >
                {mode === 'login'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Text>
              <TouchableOpacity onPress={handleModeSwitch}>
                <Text
                  style={[
                    styles.switchLink,
                    { color: colors.primary },
                  ]}
                >
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── Social Login ───────────────────────────────────────── */}
          <View style={styles.socialSection}>
            <View style={styles.divider}>
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: colors.border },
                ]}
              />
              <Text
                style={[
                  styles.dividerText,
                  { color: colors.textSecondary },
                ]}
              >
                OR
              </Text>
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              disabled
            >
              <Text
                style={[
                  styles.socialButtonText,
                  { color: colors.text },
                ]}
              >
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Apple Sign In */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: theme.dark ? '#FFFFFF' : '#000000',
                    borderColor: colors.border,
                  },
                ]}
                disabled
              >
                <Text
                  style={[
                    styles.socialButtonText,
                    { color: theme.dark ? '#000000' : '#FFFFFF' },
                  ]}
                >
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  authHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  welcomeText: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginTop: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    height: 48,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    height: '100%',
  },
  eyeButton: {
    padding: spacing.sm,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  apiError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  apiErrorText: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  socialSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '500',
  },
  socialButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default AuthScreen;
