import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "./push.module";

describe("push endpoints", () => {
  it("accepts the real push services", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:def")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QGuQyavXutnMH")).toBe(true);
  });

  it("refuses anything else, so the server can't be pointed at other systems", () => {
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false); // not https
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.example/send")).toBe(false); // lookalike host
    expect(isPushEndpoint("https://evilfcm.googleapis.com/send")).toBe(false);
    expect(isPushEndpoint("https://user:pass@fcm.googleapis.com/send")).toBe(false);
    expect(isPushEndpoint("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPushEndpoint("https://localhost/push")).toBe(false);
    expect(isPushEndpoint("not a url")).toBe(false);
  });
});
