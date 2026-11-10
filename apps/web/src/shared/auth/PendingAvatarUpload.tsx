import { useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { avatarUrlOf } from "./profile";
import { setPendingAvatar, takePendingAvatar, uploadAvatar } from "./avatar";

/**
 * A picture chosen at registration waits on the device until the email is
 * confirmed and the person signs in; this uploads it then, once. If it fails
 * (offline, say) it stays for the next sign-in, and Profile can always set one.
 */
export function PendingAvatarUpload() {
  const { client, session, getAccessToken } = useAuth();
  const user = session?.user;
  const tried = useRef<string | null>(null);

  useEffect(() => {
    const email = user?.email;
    if (!email || tried.current === user.id) return;
    tried.current = user.id;
    const pending = takePendingAvatar(email);
    if (!pending) return;
    if (avatarUrlOf(user)) {
      setPendingAvatar(email, null);
      return;
    }
    void (async () => {
      try {
        const url = await uploadAvatar(pending, await getAccessToken());
        const { error } = await client.auth.updateUser({ data: { avatar_url: url } });
        if (!error) setPendingAvatar(email, null);
      } catch {
        /* keep it for next time */
      }
    })();
  }, [user, client, getAccessToken]);

  return null;
}
