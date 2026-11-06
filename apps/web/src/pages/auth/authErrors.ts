/** Supabase errors are terse; say what to do instead. Shared by every auth screen. */
export function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them, or reset your password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link Supabase sent you, then sign in.";
  if (/already registered|already been registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/invalid api key/i.test(message)) return "Sign-in isn't configured correctly (the Supabase key is wrong). Check apps/web/.env.local.";
  if (/not authorized|email address .* is invalid/i.test(message))
    return "Supabase won't send email to this address yet. Its built-in mailer only delivers to the project's team; set up custom SMTP in Supabase to allow anyone.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  if (/invalid totp|invalid code|expired/i.test(message)) return "That code didn't work. Codes change every 30 seconds; enter the current one.";
  if (/same password|different from the old/i.test(message)) return "Choose a password you haven't used for this account.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the sign-in service. Check your connection and try again.";
  return message;
}
