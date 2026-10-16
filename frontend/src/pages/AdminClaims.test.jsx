// Run this focused suite with the existing React test utilities:
// npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/AdminClaims.test.jsx --setupFilesAfterEnv=react-dom/test-utils
// The legacy setupTests.js imports jest-dom, which is absent from this project's dependencies.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminClaims from './AdminClaims';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

jest.mock('../axiosConfig', () => ({ get: jest.fn(), patch: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const claim = {
  _id: 'claim-1', restaurantId: { name: 'Test Kitchen' },
  userId: { name: 'Owner', email: 'owner@example.test' },
  message: 'Ownership details', createdAt: '2026-10-16T00:00:00Z'
};
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  useAuth.mockReturnValue({ user: { role: 'admin', token: 'test-token' } });
  axiosInstance.get.mockResolvedValue({ data: [claim] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const mount = async () => { await act(async () => { root.render(<AdminClaims />); }); };
const button = label => [...container.querySelectorAll('button')].find(item => item.textContent === label);

for (const [label, decision] of [['Approve', 'approved'], ['Reject', 'rejected']]) {
  test(`${label} sends the selected decision and refreshes the pending list`, async () => {
    axiosInstance.patch.mockResolvedValue({ data: { status: decision } });
    await mount();
    axiosInstance.get.mockResolvedValue({ data: [] });
    await act(async () => { button(label).click(); });
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/claims/claim-1', { decision }, {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(container.textContent).toContain(`Claim for Test Kitchen ${decision}.`);
    expect(container.textContent).toContain('No pending ownership claims.');
    expect(axiosInstance.get).toHaveBeenCalledTimes(2);
  });
}

test('disables decision buttons during a request and prevents double submission', async () => {
  let finish;
  axiosInstance.patch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await mount();
  const approve = button('Approve');
  await act(async () => { approve.click(); approve.click(); });
  expect(axiosInstance.patch).toHaveBeenCalledTimes(1);
  expect(button('Approve').disabled).toBe(true);
  expect(button('Reject').disabled).toBe(true);
  expect(button('Refresh claims').disabled).toBe(true);
  axiosInstance.get.mockResolvedValue({ data: [] });
  await act(async () => { finish({ data: {} }); });
});

test('keeps the claim visible and displays a failed decision without claiming success', async () => {
  axiosInstance.patch.mockRejectedValue({ response: { status: 500, data: { message: 'Could not save the claim decision.' } } });
  await mount();
  await act(async () => { button('Approve').click(); });
  expect(container.querySelector('[role="alert"]').textContent).toContain('Could not save');
  expect(container.querySelector('article')).not.toBeNull();
  expect(button('Approve').disabled).toBe(false);
  expect(container.textContent).not.toContain('Claim for Test Kitchen approved.');
});

test('refreshes a stale claim after a conflict while preserving the explanation', async () => {
  axiosInstance.patch.mockRejectedValue({ response: { status: 409, data: { message: 'This claim has already been decided.' } } });
  await mount();
  axiosInstance.get.mockResolvedValue({ data: [] });
  await act(async () => { button('Reject').click(); });
  expect(container.textContent).toContain('This claim has already been decided.');
  expect(container.textContent).toContain('No pending ownership claims.');
});
