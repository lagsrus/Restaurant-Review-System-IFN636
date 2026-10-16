import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.resetAllMocks();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

for (const role of ['admin', 'customer', 'owner', null]) {
  test(`${role || 'guest'} navigation preserves the integrated admin access rules`, () => {
    useAuth.mockReturnValue({ user: role ? { role } : null, logout: jest.fn() });
    act(() => root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Navbar />
      </MemoryRouter>
    ));
    const links = [...container.querySelectorAll('a')].map(link => [link.getAttribute('href'), link.textContent]);
    const adminLinks = links.filter(([href]) => href.startsWith('/admin/'));
    expect(adminLinks).toEqual(role === 'admin' ? [
      ['/admin/claims', 'Owner Claims'],
      ['/admin/restaurants', 'Manage Restaurants'],
      ['/admin/reports', 'Review Moderation']
    ] : []);
    expect(links.some(([href]) => href === '/my-reviews')).toBe(role === 'customer');
    expect(links.some(([href]) => href === '/login')).toBe(role === null);
  });
}
