// Sign-in messages. The repository checks the account; the format checks run first, on the tablet.
export function validateSignIn(forceNumber, pin) {
  if (!forceNumber.trim()) return 'Enter your force number.';
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4 to 6 digits.';
  return null;
}

export function signInMessage(error, forceNumber) {
  switch (error) {
    case 'not_found':
      return `No account has force number ${forceNumber.trim()}.`;
    case 'suspended':
      return 'This account is suspended. Ask a system administrator to reactivate it.';
    case 'wrong_pin':
      return 'Incorrect PIN. Try again.';
    default:
      return 'Sign-in failed. Try again.';
  }
}

export const homeFor = (user) => (user.role === 'admin' ? '/admin/users' : '/scan');
