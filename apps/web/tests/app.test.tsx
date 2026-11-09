import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * A stand-in for the Supabase client. Only the auth calls the app makes; the
 * tests switch `session` to sign in and out.
 */
const auth = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: unknown) => void>();
  const state: { session: unknown; nextLevel: "aal1" | "aal2"; currentLevel: "aal1" | "aal2" } = {
    session: null,
    nextLevel: "aal1",
    currentLevel: "aal1",
  };
  return {
    state,
    emit(event: string) {
      listeners.forEach((l) => l(event, state.session));
    },
    signIn(email: string) {
      state.session = { access_token: "token", user: { id: "11111111-1111-4111-8111-111111111111", email } };
      listeners.forEach((l) => l("SIGNED_IN", state.session));
    },
    client: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: state.session } })),
        onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
          listeners.add(cb);
          return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
        }),
        signInWithPassword: vi.fn(async ({ email }: { email: string }) => {
          state.session = { access_token: "token", user: { id: "11111111-1111-4111-8111-111111111111", email } };
          listeners.forEach((l) => l("SIGNED_IN", state.session));
          return { data: { session: state.session }, error: null };
        }),
        signOut: vi.fn(async () => {
          state.session = null;
          listeners.forEach((l) => l("SIGNED_OUT", null));
          return { error: null };
        }),
        updateUser: vi.fn(async () => ({ data: {}, error: null })),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: state.currentLevel, nextLevel: state.nextLevel },
            error: null,
          })),
          listFactors: vi.fn(async () => ({
            data: { totp: [{ id: "factor-1", status: "verified" }], all: [] },
            error: null,
          })),
          challengeAndVerify: vi.fn(async ({ code }: { code: string }) => {
            if (code !== "123456") return { data: null, error: { message: "Invalid TOTP code entered" } };
            state.currentLevel = "aal2";
            return { data: {}, error: null };
          }),
        },
      },
    },
  };
});

const remember = vi.hoisted(() => ({ value: true, set: vi.fn() }));
const landing = vi.hoisted(() => ({ fromConfirmation: false }));

vi.mock("@/shared/auth/supabase", () => ({
  supabase: auth.client,
  get landedFromEmailConfirmation() {
    return landing.fromConfirmation;
  },
  getRememberMe: () => remember.value,
  setRememberMe: (v: boolean) => {
    remember.value = v;
    remember.set(v);
  },
}));

const { default: App } = await import("@/App");

describe("App", () => {
  beforeEach(() => {
    auth.state.session = null;
    auth.state.nextLevel = "aal1";
    auth.state.currentLevel = "aal1";
    remember.value = true;
    remember.set.mockClear();
    landing.fromConfirmation = false;
    auth.client.auth.signOut.mockClear();
  });

  it("an email-confirmation link confirms the address but doesn't sign you in", async () => {
    // Supabase signs the user in from the link before the app runs.
    auth.state.session = { access_token: "token", user: { id: "11111111-1111-4111-8111-111111111111", email: "new@example.com" } };
    landing.fromConfirmation = true;
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByText(/Your email is confirmed/)).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("new@example.com");
    expect(auth.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(screen.queryByRole("heading", { name: "Today" })).toBeNull();
  });

  it("asks for the authenticator code before opening an account with two-step verification", async () => {
    auth.state.nextLevel = "aal2";
    auth.signIn("me@example.com");
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Today" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify$/ }));
    expect(await screen.findByText(/That code didn't work/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify$/ }));
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });

  it("asks for a new password when arriving from a reset link", async () => {
    auth.signIn("me@example.com");
    window.history.pushState({}, "", "/");
    render(<App />);
    await screen.findByRole("heading", { name: "Today" });
    act(() => auth.emit("PASSWORD_RECOVERY"));
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brand-new-pass" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "brand-new-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /Save new password$/ }));
    await waitFor(() => expect(auth.client.auth.updateUser).toHaveBeenCalledWith({ password: "brand-new-pass" }));
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });

  it("asks a signed-out visitor to sign in, then opens Today", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign in$/ }));

    await waitFor(() =>
      expect(auth.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.com", password: "correct-horse" }),
    );
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });

  it("honours 'Keep me signed in' before signing in", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    await screen.findByRole("heading", { name: "Welcome back" });
    fireEvent.click(screen.getByLabelText("Keep me signed in"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign in$/ }));
    await waitFor(() => expect(remember.set).toHaveBeenLastCalledWith(false));
  });

  it("opens on Today when already signed in, with every module in the navigation", async () => {
    auth.signIn("me@example.com");
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
    // jsdom reports a narrow screen, so the navigation lives in a drawer.
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("menuitem", { name: /Tasks/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Notes/ })).toBeTruthy();
    expect(screen.getByText("me@example.com")).toBeTruthy();
  });

  it("returns to the sign-in page after signing out", async () => {
    auth.signIn("me@example.com");
    window.history.pushState({}, "", "/");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open navigation" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sign out/ }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  });

  it("shows a not-found page for an unknown address", async () => {
    auth.signIn("me@example.com");
    window.history.pushState({}, "", "/nowhere");
    render(<App />);
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });
});
