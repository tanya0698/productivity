import { useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { setPendingAvatar, takePendingAvatar, uploadAvatar } from "./avatar";
import { avatarUrlOf } from "./profile";

/**
 * A picture chosen at registration waits on the phone until the email is
 * confirmed and the person signs in; this uploads it then, once. If it fails
 * (offline, say) it stays for the next sign-in, and Account can always set one.
 */
export function PendingAvatarUpload() {
  const { client, session, getAccessToken } = useAuth();
  const user = session?.user;
  const tried = useRef<string | null>(null);

  useEffect(() => {
    const email = user?.email;
    if (!user || !email || tried.current === user.id) return;
    tried.current = user.id;
    void (async () => {
      if (avatarUrlOf(user)) return void setPendingAvatar(email, null);
      const pending = await takePendingAvatar(email);
      if (!pending) return;
      try {
        const url = await uploadAvatar(pending, await getAccessToken());
        const { error } = await client.auth.updateUser({ data: { avatar_url: url } });
        if (!error) await setPendingAvatar(email, null);
      } catch {
        /* keep it for next time */
      }
    })();
  }, [user, client, getAccessToken]);

  return null;
}
