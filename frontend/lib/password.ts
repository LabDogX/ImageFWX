// Shared password validation — mirrors backend validate_password_strength()
// in backend/app/api/auth.py. Keep these rules in sync with the backend.

export interface PasswordChecks {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function validatePassword(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const v = validatePassword(password);
  return v.minLength && v.hasLower && v.hasUpper && v.hasDigit && v.hasSpecial;
}

// List form for rendering requirement checklists in the UI.
export function passwordRequirementList(password: string) {
  const v = validatePassword(password);
  return [
    { text: 'At least 8 characters', met: v.minLength },
    { text: 'One uppercase letter', met: v.hasUpper },
    { text: 'One lowercase letter', met: v.hasLower },
    { text: 'One digit', met: v.hasDigit },
    { text: 'One special character (!@#$%^&*...)', met: v.hasSpecial },
  ];
}
