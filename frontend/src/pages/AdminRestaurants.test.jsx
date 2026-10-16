// Focused suite: npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/AdminRestaurants.test.jsx --setupFilesAfterEnv=react-dom/test-utils
// Uses installed React utilities; the legacy setupTests.js requires missing jest-dom.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Simulate } from 'react-dom/test-utils';
import AdminRestaurants from './AdminRestaurants';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

jest.mock('../axiosConfig', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
const restaurant = {
  _id: 'restaurant-1', name: 'Test Kitchen', cuisine: 'Thai', priceLevel: 2,
  location: { address: 'Main St', suburb: 'Brisbane', latitude: -27, longitude: 153 },
  imageUrls: ['https://example.test/photo.jpg'], ownerId: 'owner-1', ratingSummary: { avgRating: 4 }
};
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  useAuth.mockReturnValue({ user: { role: 'admin', token: 'test-token' } });
  axiosInstance.get.mockResolvedValue({ data: [restaurant] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const mount = async () => { await act(async () => { root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminRestaurants /></MemoryRouter>); }); };
const button = label => [...container.querySelectorAll('button')].find(item => item.textContent === label);
const click = async label => { await act(async () => { button(label).click(); }); };
const change = async (key, value) => {
  await act(async () => { Simulate.change(container.querySelector(`#restaurant-${key}`), { target: { value } }); });
};
const submit = async () => { await act(async () => { Simulate.submit(container.querySelector('form')); }); };

test('creates a restaurant with numeric price/coordinates and refreshes the saved list', async () => {
  await mount();
  await change('name', 'New Kitchen');
  await change('latitude', '-27.5');
  axiosInstance.post.mockResolvedValue({ data: {} });
  await submit();
  expect(axiosInstance.post).toHaveBeenCalledWith('/api/admin/restaurants', expect.objectContaining({
    name: 'New Kitchen', priceLevel: 1, location: expect.objectContaining({ latitude: -27.5, longitude: null })
  }), { headers: { Authorization: 'Bearer test-token' } });
  expect(container.textContent).toContain('Restaurant created.');
  expect(axiosInstance.get).toHaveBeenCalledTimes(2);
  expect(container.querySelector('#restaurant-name').value).toBe('');
});
test('loads existing details for editing without sending ownership or ratings', async () => {
  await mount();
  await click('Edit');
  expect(container.querySelector('#restaurant-address').value).toBe('Main St');
  await change('name', 'Updated Kitchen');
  axiosInstance.patch.mockResolvedValue({ data: {} });
  await submit();
  const [url, body] = axiosInstance.patch.mock.calls[0];
  expect(url).toBe('/api/admin/restaurants/restaurant-1');
  expect(body.name).toBe('Updated Kitchen');
  expect(body.location.latitude).toBe(-27);
  expect(body.ownerId).toBeUndefined();
  expect(body.ratingSummary).toBeUndefined();
  expect(container.textContent).toContain('Restaurant updated.');
});
test('cancel edit clears the form without an API mutation', async () => {
  await mount(); await click('Edit'); await click('Cancel edit');
  expect(container.querySelector('#restaurant-name').value).toBe('');
  expect(axiosInstance.patch).not.toHaveBeenCalled();
});
test('delete requires confirmation and cancellation never sends a delete', async () => {
  await mount(); await click('Delete');
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain('all related reviews, ownership claims and reports');
  expect(axiosInstance.delete).not.toHaveBeenCalled();
  await click('Cancel deletion');
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  expect(axiosInstance.delete).not.toHaveBeenCalled();
});
test('confirmed deletion removes the restaurant from the refreshed list', async () => {
  await mount(); await click('Delete');
  axiosInstance.delete.mockResolvedValue({ data: {} });
  axiosInstance.get.mockResolvedValue({ data: [] });
  await click('Confirm deletion');
  expect(axiosInstance.delete).toHaveBeenCalledWith('/api/admin/restaurants/restaurant-1', {
    headers: { Authorization: 'Bearer test-token' }
  });
  expect(container.querySelector('article')).toBeNull();
  expect(container.textContent).toContain('No restaurants yet.');
});
test('failed deletion keeps the restaurant and allows retry', async () => {
  await mount(); await click('Delete');
  axiosInstance.delete.mockRejectedValue({ response: { data: { message: 'Could not delete.' } } });
  await click('Confirm deletion');
  expect(container.querySelector('[role="alert"]').textContent).toBe('Could not delete.');
  expect(container.querySelector('article')).not.toBeNull();
  expect(button('Confirm deletion').disabled).toBe(false);
});
test('failed validation preserves entered data for correction', async () => {
  await mount(); await change('name', 'Keep my input');
  axiosInstance.post.mockRejectedValue({ response: { status: 400, data: { message: 'Invalid image URL.' } } });
  await submit();
  expect(container.querySelector('#restaurant-name').value).toBe('Keep my input');
  expect(container.querySelector('[role="alert"]').textContent).toBe('Invalid image URL.');
  expect(container.textContent).not.toContain('Restaurant created.');
});
test('guards duplicate save requests while awaiting a response', async () => {
  await mount(); await change('name', 'New Kitchen');
  let finish;
  axiosInstance.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => {
    Simulate.submit(container.querySelector('form'));
    Simulate.submit(container.querySelector('form'));
  });
  expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  expect(container.querySelector('fieldset').disabled).toBe(true);
  await act(async () => { finish({ data: {} }); });
});
test('load failure displays an error instead of an empty-list success', async () => {
  axiosInstance.get.mockRejectedValue(new Error('offline'));
  await mount();
  expect(container.textContent).toContain('Could not load restaurants.');
  expect(container.textContent).not.toContain('No restaurants yet.');
});
for (const role of ['customer', 'owner', null]) {
  test(`${role || 'signed-out'} user cannot access the management form`, async () => {
    useAuth.mockReturnValue({ user: role ? { role, token: 'test-token' } : null });
    await mount();
    expect(container.querySelector('form')).toBeNull();
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });
}
