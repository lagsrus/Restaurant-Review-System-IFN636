import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const AUTH_STORAGE_KEY = 'restaurant-review-user';
const testUser = {
  id: 'user-1',
  name: 'Test Owner',
  email: 'owner@example.test',
  role: 'owner',
  token: 'test-token'
};

function AuthState() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="current-user">{user ? `${user.name}:${user.role}` : 'guest'}</p>
      <button onClick={() => login(testUser)}>Log in</button>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('persists login in the current tab and restores it after remount', () => {
  const view = render(
    <AuthProvider>
      <AuthState />
    </AuthProvider>
  );

  act(() => screen.getByRole('button', { name: 'Log in' }).click());
  expect(screen.getByTestId('current-user')).toHaveTextContent('Test Owner:owner');
  expect(JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY))).toEqual(testUser);

  view.unmount();
  render(
    <AuthProvider>
      <AuthState />
    </AuthProvider>
  );

  expect(screen.getByTestId('current-user')).toHaveTextContent('Test Owner:owner');
});

test('clears the saved login when logging out', () => {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(testUser));
  render(
    <AuthProvider>
      <AuthState />
    </AuthProvider>
  );

  act(() => screen.getByRole('button', { name: 'Log out' }).click());

  expect(screen.getByTestId('current-user')).toHaveTextContent('guest');
  expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
});

test('clears and reports malformed saved login data', () => {
  sessionStorage.setItem(AUTH_STORAGE_KEY, '{broken');

  render(
    <AuthProvider>
      <AuthState />
    </AuthProvider>
  );

  expect(screen.getByTestId('current-user')).toHaveTextContent('guest');
  expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  expect(console.error).toHaveBeenCalledWith(
    'Could not restore the saved login session:',
    expect.any(SyntaxError)
  );
});
