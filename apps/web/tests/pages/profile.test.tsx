import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";

const avatar = vi.hoisted(() => ({
  pending: new Map<string, string>(),
  upload: vi.fn<(dataUrl: string, token: string | null) => Promise<string>>(async () => "https://cdn.example/avatars/u/1.webp"),
  remove: vi.fn(async () => {}),
}));

vi.mock("@/shared/auth/avatar", () => ({
  // jsdom can't decode images; the resize step is the browser's job.
  prepareAvatar: vi.fn(async () => "data:image/webp;base64,UklGRgAAAABXRUJQ"),
  uploadAvatar: avatar.upload,
  removeAvatar: avatar.remove,
  setPendingAvatar: (email: string, v: string | null) => (v ? avatar.pending.set(email, v) : avatar.pending.delete(email)),
  takePendingAvatar: (email: string) => avatar.pending.get(email) ?? null,
}));

vi.mock("@/shared/auth/supabase", () => ({
  supabase: {},
  landedFromEmailConfirmation: false,
  getRememberMe: () => true,
  setRememberMe: () => {},
}));

const { AuthProvider } = await import("@/shared/auth/AuthProvider");
const { default: SignInPage } = await import("@/pages/auth/SignInPage");
const { ProfileCard } = await import("@/pages/account/ProfileCard");

type Session = { access_token: string; user: { id: string; email: string; user_metadata: Record<string, unknown> } } | null;

function fakeClient(session: Session, signUpSession: Session = null) {
  const state = { session };
  const listeners = new Set<(e: string, s: unknown) => void>();
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      }),
      signUp: vi.fn<(args: unknown) => Promise<unknown>>(async () => ({ data: { session: signUpSession, user: {} }, error: null })),
      updateUser: vi.fn(async ({ data }: { data?: Record<string, unknown> }) => {
        if (state.session && data) {
          state.session = { ...state.session, user: { ...state.session.user, user_metadata: { ...state.session.user.user_metadata, ...data } } };
          listeners.forEach((l) => l("USER_UPDATED", state.session));
        }
        return { data: {}, error: null };
      }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null })) },
    },
  };
}

const renderWith = (client: ReturnType<typeof fakeClient>, ui: ReactNode) =>
  render(
    <AuthProvider client={client as never}>
      <AntApp>
        <MemoryRouter>{ui}</MemoryRouter>
      </AntApp>
    </AuthProvider>,
  );

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const pickPicture = () =>
  fireEvent.change(screen.getByLabelText("Profile picture", { selector: "input" }), {
    target: { files: [new File(["x"], "me.png", { type: "image/png" })] },
  });

describe("Registration", () => {
  beforeEach(() => {
    avatar.pending.clear();
    avatar.upload.mockClear();
  });

  async function fillSignUp() {
    fireEvent.click(await screen.findByRole("button", { name: /Create (one|an account|account)|Sign up/i }));
    await screen.findByLabelText("First name");
    type("First name", " Tanya ");
    type("Last name", "Moyo");
    type(/^Email/, "tanya@example.com");
    type(/^Phone number/, "+263 77 123 4567");
    type(/^Password/, "correct horse");
    type(/^Confirm password/, "correct horse");
  }

  it("asks for first and last name, phone and an optional picture, and saves them on the account", async () => {
    const client = fakeClient(null);
    renderWith(client, <SignInPage />);
    await fillSignUp();
    pickPicture();
    await screen.findByRole("button", { name: /Change picture/ });
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));

    await waitFor(() => expect(client.auth.signUp).toHaveBeenCalled());
    const call = client.auth.signUp.mock.calls[0]![0] as { options: { data: Record<string, unknown> } };
    expect(call.options.data).toEqual({ first_name: "Tanya", last_name: "Moyo", full_name: "Tanya Moyo", phone: "+263 77 123 4567" });
    // No session until the email is confirmed: the picture waits on the device.
    expect(avatar.pending.get("tanya@example.com")).toMatch(/^data:image\/webp/);
    expect(avatar.upload).not.toHaveBeenCalled();
  });

  it("needs the names but not the phone or picture", async () => {
    const client = fakeClient(null);
    renderWith(client, <SignInPage />);
    await fillSignUp();
    type("First name", "");
    type(/^Phone number/, "");
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
    expect(await screen.findByText("Enter your first name.")).toBeTruthy();
    expect(client.auth.signUp).not.toHaveBeenCalled();

    type("First name", "Tanya");
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
    await waitFor(() => expect(client.auth.signUp).toHaveBeenCalled());
    const call = client.auth.signUp.mock.calls[0]![0] as { options: { data: Record<string, unknown> } };
    expect(call.options.data.phone).toBeNull();
    expect(avatar.pending.size).toBe(0);
  });
});

describe("Profile", () => {
  const signedIn = (): Session => ({
    access_token: "t",
    user: { id: "u1", email: "tanya@example.com", user_metadata: { first_name: "Tanya", last_name: "Moyo", phone: "+263 77 123 4567" } },
  });

  it("shows what was given at registration and saves edits", async () => {
    const client = fakeClient(signedIn());
    renderWith(client, <ProfileCard />);
    await waitFor(() => expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Tanya"));
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("Moyo");
    expect((screen.getByLabelText(/^Phone number/) as HTMLInputElement).value).toBe("+263 77 123 4567");

    type("Last name", "Moyo-Chipuka");
    fireEvent.click(screen.getByRole("button", { name: /Save profile/ }));
    await waitFor(() =>
      expect(client.auth.updateUser).toHaveBeenCalledWith({
        data: { first_name: "Tanya", last_name: "Moyo-Chipuka", full_name: "Tanya Moyo-Chipuka", phone: "+263 77 123 4567" },
      }),
    );
    expect(await screen.findByText("Tanya Moyo-Chipuka")).toBeTruthy();
  });

  it("uploads a new picture straight away", async () => {
    const client = fakeClient(signedIn());
    renderWith(client, <ProfileCard />);
    await screen.findByLabelText("First name");
    pickPicture();
    await waitFor(() => expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { avatar_url: "https://cdn.example/avatars/u/1.webp" } }));
    expect(avatar.upload).toHaveBeenCalledWith(expect.stringMatching(/^data:image/), "t");
    expect(await screen.findByRole("button", { name: /Remove/ })).toBeTruthy();
  });
});
