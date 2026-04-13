import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';

jest.mock('../api', () => ({
  authApi: {
    me: jest.fn(() => Promise.resolve({ id: 1, name: 'A', role: 'admin' })),
    login: jest.fn(() => Promise.resolve({ token: 't1', refreshToken: 'r1', user: { id: 2, name: 'B', role: 'staff' } })),
    logout: jest.fn(() => Promise.resolve({ message: 'ok' })),
  },
}));

function Consumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.name || ''}</span>
      <button type="button" onClick={() => login('e@example.com', 'pass')}>login</button>
      <button type="button" onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads user on boot and updates tokens on login', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('A');

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('t1');
      expect(localStorage.getItem('refreshToken')).toBe('r1');
    });
  });

  it('clears tokens on logout', async () => {
    localStorage.setItem('token', 'stale');
    localStorage.setItem('refreshToken', 'stale-r');

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });
});
