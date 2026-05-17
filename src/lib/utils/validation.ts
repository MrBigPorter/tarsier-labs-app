/**
 * Form validation utilities
 *
 * Centralizes validation logic extracted from AuthScreen.tsx
 * to be reusable across any form in the app.
 */

/** Standard validation errors map: field name → error message */
export interface ValidationErrors {
  [field: string]: string;
}

/**
 * Check if a string is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check if a password meets minimum length requirement.
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Check if a string is non-empty after trimming.
 */
export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate login form fields.
 *
 * @returns Object with field-level error messages. Empty object = valid.
 *
 * @example
 * const errors = validateLoginForm(email, password);
 * if (Object.keys(errors).length > 0) setErrors(errors);
 */
export function validateLoginForm(
  email: string,
  password: string,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!isRequired(email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!isRequired(password)) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(password)) {
    errors.password = 'Password must be at least 6 characters';
  }

  return errors;
}

/**
 * Validate registration form fields.
 *
 * @returns Object with field-level error messages. Empty object = valid.
 */
export function validateRegisterForm(
  email: string,
  password: string,
  confirmPassword: string,
  nickname?: string,
): ValidationErrors {
  const errors: ValidationErrors = {};

  // Email
  if (!isRequired(email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Nickname
  if (nickname !== undefined && !isRequired(nickname)) {
    errors.nickname = 'Nickname is required';
  }

  // Password
  if (!isRequired(password)) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(password)) {
    errors.password = 'Password must be at least 6 characters';
  }

  // Confirm password
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
}

/**
 * Validate comment form fields.
 *
 * @returns Object with field-level error messages. Empty object = valid.
 */
export function validateCommentForm(
  content: string,
  author?: string,
  email?: string,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!isRequired(content)) {
    errors.content = 'Comment cannot be empty';
  }

  if (author !== undefined && !isRequired(author)) {
    errors.author = 'Name is required';
  }

  if (email !== undefined) {
    if (!isRequired(email)) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
  }

  return errors;
}
