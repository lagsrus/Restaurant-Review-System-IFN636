// Focused suite: npm test -- --watchAll=false --runInBand --runTestsByPath src/components/ClaimRestaurant.test.jsx --setupFilesAfterEnv=react-dom/test-utils
// The legacy setupTests.js imports jest-dom, which is absent from this project's dependencies.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import ClaimRestaurant from './ClaimRestaurant';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

jest.mock('../axiosConfig', () => ({ post: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  useAuth.mockReturnValue({ user: { role: 'owner', token: 'owner-token' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

const mount = async () => {
  await act(async () => {
    root.render(<ClaimRestaurant restaurantId="restaurant-1" />);
  });
};

test('owners can submit a claim with the optional supporting message', async () => {
  axiosInstance.post.mockResolvedValue({
    data: { message: 'Claim submitted for administrator review.' }
  });
  await mount();
  const textarea = container.querySelector('textarea');
  await act(async () => {
    Simulate.change(textarea, { target: { value: 'I operate this restaurant.' } });
  });
  await act(async () => {
    Simulate.submit(container.querySelector('form'));
  });

  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/api/restaurants/restaurant-1/claims',
    { message: 'I operate this restaurant.' },
    { headers: { Authorization: 'Bearer owner-token' } }
  );
  expect(container.querySelector('[role="status"]').textContent)
    .toBe('Claim submitted for administrator review.');
});

test('non-owners do not see the claim submission form', async () => {
  useAuth.mockReturnValue({ user: { role: 'customer', token: 'customer-token' } });
  await mount();
  expect(container.querySelector('form')).toBeNull();
});

test('displays an API error without showing a success confirmation', async () => {
  axiosInstance.post.mockRejectedValue({
    response: { status: 409, data: { message: 'This restaurant already has an owner.' } }
  });
  await mount();
  await act(async () => {
    Simulate.submit(container.querySelector('form'));
  });

  expect(container.querySelector('[role="alert"]').textContent)
    .toBe('This restaurant already has an owner.');
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test('prevents duplicate submissions while the request is in flight', async () => {
  let finish;
  axiosInstance.post.mockReturnValue(new Promise(resolve => {
    finish = resolve;
  }));
  await mount();

  await act(async () => {
    Simulate.submit(container.querySelector('form'));
    Simulate.submit(container.querySelector('form'));
  });

  expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  expect(container.querySelector('button').disabled).toBe(true);
  await act(async () => {
    finish({ data: { message: 'Claim submitted for administrator review.' } });
  });
});
