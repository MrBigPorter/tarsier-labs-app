/**
 * AuthScreen — Passwordless email verification code login
 *
 * Flow:
 * 1. User enters email
 * 2. User taps "Send code" → POST /v1/auth/email/send-code
 * 3. Backend sends 6-digit code to email
 * 4. User enters 6-digit code
 * 5. User taps "Login" → POST /v1/auth/email/login (email + code)
 * 6. If account doesn't exist → auto-creates (Web's "login to register" philosophy)
 *
 * Features:
 * - App logo image at top
 * - Email input with Mail icon
 * - Send code button with countdown (60s)
 * - Verification code input with Lock icon
 * - Tip box: "New user? Login to register!"
 * - Submit button with ArrowRight icon
 * - OAuth buttons (Google, Facebook, Apple) with proper icons
 * - i18n support
 *
 * External deps:
 * - Redux: dispatch setCredentials to update auth state after login
 * - RTK Query: useSendEmailCodeMutation, useLoginWithEmailCodeMutation
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, spacing, typography } from '@/lib/theme';
import { useAppDispatch } from '@/store';
import { setCredentials } from '@/store/slices/authSlice';
import {
  useSendEmailCodeMutation,
  useLoginWithEmailCodeMutation,
} from '@/api/endpoints/auth';
import Header from '@/components/layout/Header';
import SvgIcon from '@/components/core/SvgIcon';
import { useOAuth } from '@/lib/hooks/useOAuth';
import type { RootStackScreenProps } from '@/navigation/types';

const CODE_REGEX = /^\d{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTDOWN_SECONDS = 60;

const AuthScreen: React.FC<RootStackScreenProps<'Auth'>> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // ─── State ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [eulaTip, setEulaTip] = useState<string | null>(null);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);

  // ─── Dynamic styles (depends on state + theme) ─────────────────────
  const eulaCheckboxStyle = React.useMemo(
    () => ({
      borderColor: eulaAccepted ? colors.primary : colors.border,
      backgroundColor: eulaAccepted ? colors.primary : 'transparent',
    }),
    [eulaAccepted, colors],
  );

  const emailRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // RTK Query mutations
  const [sendEmailCodeMutation, { isLoading: isSendLoading }] =
    useSendEmailCodeMutation();
  const [loginWithEmailCodeMutation, { isLoading: isLoginLoading }] =
    useLoginWithEmailCodeMutation();

  const isSubmitting = isLoginLoading;

  // OAuth login
  const { loginGoogle, loginFacebook, loginApple } = useOAuth();

  // ─── Countdown timer ────────────────────────────────────────────────

  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [countdown]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const validateEmail = useCallback((): string | null => {
    const trimmed = email.trim();
    if (!trimmed) {
      return t('auth.fillAllFields');
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return t('auth.invalidEmail');
    }
    return null;
  }, [email, t]);

  const handleSendCode = useCallback(async () => {
    Keyboard.dismiss();
    const emailError = validateEmail();
    if (emailError) {
      setError(emailError);
      return;
    }

    setError(null);
    setIsSendingCode(true);

    try {
      await sendEmailCodeMutation({
        email: email.trim(),
      }).unwrap();
      setCountdown(COUNTDOWN_SECONDS);
    } catch (err: any) {
      const status = err?.status ?? err?.originalStatus ?? '';
      const serverMsg = err?.data?.message || err?.error || '';
      const statusPrefix = status ? `[${status}] ` : '';
      const message =
        `${statusPrefix}${serverMsg}`.trim() || t('auth.sendCodeFailed');
      setError(message);
    } finally {
      setIsSendingCode(false);
    }
  }, [email, validateEmail, sendEmailCodeMutation, t]);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    setError(null);

    // Check EULA
    if (!eulaAccepted) {
      setEulaTip(t('auth.login.eulaRequired'));
      return;
    }

    // Validate email
    const emailError = validateEmail();
    if (emailError) {
      setError(emailError);
      return;
    }

    // Validate code
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (!CODE_REGEX.test(trimmedCode)) {
      setError(t('auth.invalidCode'));
      return;
    }

    try {
      const result = await loginWithEmailCodeMutation({
        email: email.trim(),
        code: trimmedCode,
      }).unwrap();

      console.log(
        '[Auth] ✅ Email code login success, dispatching setCredentials',
        {
          userId: result.id,
          email: result.email,
        },
      );

      // Update Redux auth state with the response (nested tokens.* format)
      dispatch(
        setCredentials({
          user: {
            id: result.id,
            email: result.email,
            nickname: result.nickname,
            avatar: result.avatar ?? undefined,
          },
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        }),
      );

      // Navigate back to main screen after successful login
      console.log('[Auth] 🔙 Navigating back to MainTabs');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err: any) {
      const status = err?.status ?? err?.originalStatus ?? '';
      const serverMsg = err?.data?.message || err?.error || '';
      const statusPrefix = status ? `[${status}] ` : '';
      const message =
        `${statusPrefix}${serverMsg}`.trim() || t('auth.loginFailed');
      setError(message);
    }
  }, [
    email,
    code,
    validateEmail,
    loginWithEmailCodeMutation,
    dispatch,
    t,
    navigation,
    eulaAccepted,
  ]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      setIsOAuthLoading(true);
      setError(null);
      await loginGoogle();
      console.log('[Auth] ✅ Google login success, navigating back');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err: any) {
      if (err?.code !== 'CANCELLED') {
        setError(err?.message || t('auth.oauth.googleFailed'));
      }
    } finally {
      setIsOAuthLoading(false);
    }
  }, [loginGoogle, navigation, t]);

  const handleFacebookLogin = useCallback(async () => {
    try {
      setIsOAuthLoading(true);
      setError(null);
      await loginFacebook();
      console.log('[Auth] ✅ Facebook login success, navigating back');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err: any) {
      if (err?.code !== 'CANCELLED') {
        setError(err?.message || t('auth.oauth.facebookNotReady'));
      }
    } finally {
      setIsOAuthLoading(false);
    }
  }, [loginFacebook, navigation, t]);

  const handleAppleLogin = useCallback(async () => {
    try {
      setIsOAuthLoading(true);
      setError(null);
      await loginApple();
      console.log('[Auth] ✅ Apple login success, navigating back');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err: any) {
      if (err?.code !== 'CANCELLED') {
        setError(err?.message || t('auth.oauth.googleFailed'));
      }
    } finally {
      setIsOAuthLoading(false);
    }
  }, [loginApple, navigation, t]);

  // ─── Derived state for send-code button ─────────────────────────────

  const canSendCode = !isSendingCode && !isSendLoading && countdown === 0;
  const sendButtonLabel =
    isSendingCode || isSendLoading
      ? t('auth.sending')
      : countdown > 0
        ? `${t('auth.resendIn')} ${countdown}s`
        : t('auth.sendCode');

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title=""
        showBack
        onBackPress={handleGoBack}
        hideSearch
        hideSettings
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Title Section ─────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Image
            source={require('@assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontFamily: typography.h3.fontFamily,
                fontSize: typography.h3.fontSize,
                fontWeight: typography.h3.fontWeight,
              },
            ]}
          >
            {t('auth.login.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.login.subtitle')}
          </Text>
        </View>

        {/* ─── Tip Box ──────────────────────────────────────────── */}
        <View
          style={[
            styles.tipBox,
            {
              backgroundColor: colors.utilityBlue50,
              borderColor: colors.utilityBlue200,
            },
          ]}
        >
          <Text style={[styles.tipText, { color: colors.utilityBlue700 }]}>
            {t('auth.login.tip')}
          </Text>
        </View>

        {/* Email Input */}
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          {t('auth.email')}
        </Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.background,
              borderColor: error ? colors.borderError : colors.border,
            },
          ]}
        >
          <View style={styles.inputIcon}>
            <SvgIcon name="mail" size={18} color={colors.textSecondary} />
          </View>
          <TextInput
            ref={emailRef}
            style={[styles.input, { color: colors.text }]}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => codeRef.current?.focus()}
          />
        </View>

        {/* Verification Code + Send Code Button */}
        <View style={styles.codeHeaderRow}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {t('auth.verificationCode')}
          </Text>
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={!canSendCode}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.sendCodeText,
                {
                  color: canSendCode ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              {sendButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.background,
              borderColor: error ? colors.borderError : colors.border,
            },
          ]}
        >
          <View style={styles.inputIcon}>
            <SvgIcon name="lock" size={18} color={colors.textSecondary} />
          </View>
          <TextInput
            ref={codeRef}
            style={[styles.input, { color: colors.text }]}
            placeholder={t('auth.codePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={code}
            onChangeText={text => {
              // Only allow digits, max 6
              const filtered = text.replace(/[^0-9]/g, '').slice(0, 6);
              setCode(filtered);
            }}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* ─── EULA Agreement ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.eulaRow}
          onPress={() => {
            setEulaAccepted(!eulaAccepted);
            setEulaTip(null);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.eulaCheckbox, eulaCheckboxStyle]}>
            {eulaAccepted && <Text style={styles.eulaCheckmark}>✓</Text>}
          </View>
          <Text style={[styles.eulaText, { color: colors.textSecondary }]}>
            {t('auth.login.eula')}{' '}
            <Text
              style={[styles.eulaLink, { color: colors.primary }]}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              {t('auth.login.termsOfService')}
            </Text>{' '}
            {t('auth.login.and')}{' '}
            <Text
              style={[styles.eulaLink, { color: colors.primary }]}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              {t('auth.login.privacyPolicy')}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Error Message */}
        {(error || eulaTip) && (
          <View style={styles.errorContainer}>
            <SvgIcon
              name="alert-circle"
              size={16}
              color={colors.textErrorPrimary}
            />
            <Text
              style={[styles.errorText, { color: colors.textErrorPrimary }]}
            >
              {error || eulaTip}
            </Text>
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
            <View style={styles.submitContent}>
              <Text style={styles.submitButtonText}>
                {t('auth.login.button')}
              </Text>
              <SvgIcon name="arrow-right" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* ─── Divider ────────────────────────────────────────────── */}
        <View style={styles.divider}>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
            {t('auth.orContinueWith')}
          </Text>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
        </View>

        {/* ─── OAuth Buttons ──────────────────────────────────────── */}

        {/* Google */}
        <TouchableOpacity
          onPress={() => {
            if (!eulaAccepted) {
              setEulaTip(t('auth.login.eulaRequired'));
              return;
            }
            handleGoogleLogin();
          }}
          disabled={isOAuthLoading}
          style={[
            styles.oauthButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <SvgIcon name="google" size={20} />
          <Text style={[styles.oauthButtonText, { color: colors.text }]}>
            {t('auth.login.google')}
          </Text>
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity
          onPress={() => {
            if (!eulaAccepted) {
              setEulaTip(t('auth.login.eulaRequired'));
              return;
            }
            handleFacebookLogin();
          }}
          disabled={isOAuthLoading}
          style={[
            styles.oauthButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <SvgIcon name="facebook" size={20} />
          <Text style={[styles.oauthButtonText, { color: colors.text }]}>
            {t('auth.login.facebook')}
          </Text>
        </TouchableOpacity>

        {/* Apple (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            onPress={() => {
              if (!eulaAccepted) {
                setEulaTip(t('auth.login.eulaRequired'));
                return;
              }
              handleAppleLogin();
            }}
            disabled={isOAuthLoading}
            style={[
              styles.oauthButton,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                backgroundColor: isDark ? '#1C1C1E' : '#000000',
                borderColor: isDark ? '#333333' : '#000000',
              },
            ]}
            activeOpacity={0.7}
          >
            <SvgIcon name="apple" size={20} color="#FFFFFF" />
            <Text
              // eslint-disable-next-line react-native/no-inline-styles
              style={[styles.oauthButtonText, { color: '#FFFFFF' }]}
            >
              Apple
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAwareScrollView>
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
    paddingTop: spacing.lg,
    flexGrow: 1,
  },

  // ─── Title Section ──────────────────────────────────────────────────
  titleSection: {
    alignItems: 'center',
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.md,
  },
  logoImage: {
    width: 96,
    height: 96,
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── Tip Box ────────────────────────────────────────────────────────
  tipBox: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // ─── Input Fields ───────────────────────────────────────────────────
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    height: 54,
    marginBottom: spacing.lg,
  },
  inputIcon: {
    marginLeft: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    height: '100%',
  },

  // ─── Code Header Row (label + send code button) ────────────────────
  codeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sendCodeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Error ─────────────────────────────────────────────────────────
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },

  // ─── EULA ─────────────────────────────────────────────────────────
  eulaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  eulaCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  eulaCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  eulaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  eulaLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ─── Submit Button ─────────────────────────────────────────────────
  submitButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ─── Divider ────────────────────────────────────────────────────────
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

  // ─── OAuth Buttons ──────────────────────────────────────────────────
  oauthButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  oauthButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default AuthScreen;
