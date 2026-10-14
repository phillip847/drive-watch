// Returns { user } on success or { error } with a message for the sign-in form.
export function checkSignIn(users, forceNumber, pin) {
  const id = forceNumber.trim();
  if (!id) return { error: 'Enter your force number.' };
  if (!/^\d{4,6}$/.test(pin)) return { error: 'PIN must be 4 to 6 digits.' };

  const user = users.find((u) => u.id.toLowerCase() === id.toLowerCase());
  if (!user) return { error: `No account has force number ${id}.` };
  if (user.status === 'suspended') {
    return { error: 'This account is suspended. Ask a system administrator to reactivate it.', user };
  }
  if (user.pin !== pin) return { error: 'Incorrect PIN. Try again.', user };
  return { user };
}

export const homeFor = (user) => (user.role === 'admin' ? '/admin/users' : '/scan');
