// Uses installed React test utilities; run with --setupFilesAfterEnv=react-dom/test-utils.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AdminReports from './AdminReports';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

jest.mock('../axiosConfig', () => ({ get: jest.fn(), patch: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
const report = {
  _id: 'report-1', reason: 'spam', note: 'Repeated advertising', createdAt: '2026-10-16T00:00:00Z',
  reporterId: { name: 'Reporter' }, reviewId: {
    restaurantId: { name: 'Test Kitchen' }, userId: { name: 'Reviewer' }, status: 'published',
    ratings: { food: 1, service: 2, ambience: 3, value: 4 }, comment: 'Review content',
    ownerReply: { text: 'Owner reply content' }
  }
};
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  useAuth.mockReturnValue({ user: { role: 'admin', token: 'test-token' } });
  axiosInstance.get.mockResolvedValue({ data: [report] });
  axiosInstance.patch.mockResolvedValue({ data: { message: 'Report processed.' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const mount = async () => { await act(async () => {
  root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminReports /></MemoryRouter>);
}); };
const button = label => [...container.querySelectorAll('button')].find(el => el.textContent === label);
const click = async label => { await act(async () => { button(label).click(); }); };

test('loads reports with authentication and displays report, review and owner reply', async () => {
  await mount();
  expect(axiosInstance.get).toHaveBeenCalledWith('/api/admin/reports', { headers: { Authorization: 'Bearer test-token' } });
  for (const text of ['Test Kitchen', 'Repeated advertising', 'Review content', 'Owner reply content', 'Reporter', 'Reviewer']) {
    expect(container.textContent).toContain(text);
  }
});
for (const [label, action] of [['Dismiss report', 'dismiss'], ['Hide review', 'hide']]) {
  test(`${label} sends only action and refreshes the queue`, async () => {
    await mount();
    axiosInstance.get.mockResolvedValue({ data: [] });
    await click(label);
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/reports/report-1', { action }, {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(container.textContent).toContain('Report processed.');
    expect(container.textContent).toContain('No open reports.');
    expect(container.querySelector('article')).toBeNull();
  });
}
test('delete requires confirmation and cancellation does not send a request', async () => {
  await mount(); await click('Delete review');
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain('cannot be undone');
  expect(axiosInstance.patch).not.toHaveBeenCalled();
  await click('Cancel');
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  expect(axiosInstance.patch).not.toHaveBeenCalled();
});
test('confirmed deletion sends delete and reloads the queue', async () => {
  await mount(); await click('Delete review');
  axiosInstance.get.mockResolvedValue({ data: [] });
  await click('Confirm deletion');
  expect(axiosInstance.patch.mock.calls[0][1]).toEqual({ action: 'delete' });
  expect(container.querySelector('article')).toBeNull();
});
test('partial failure displays the server message, reloads current data and permits retry', async () => {
  await mount();
  axiosInstance.patch.mockRejectedValueOnce({ response: { data: { message: 'Review may already be hidden. Retry the same action.' } } });
  axiosInstance.get.mockResolvedValue({ data: [{ ...report, reviewId: { ...report.reviewId, status: 'hidden' } }] });
  await click('Hide review');
  expect(container.querySelector('[role="alert"]').textContent).toContain('Retry the same action');
  expect(container.textContent).toContain('Visibility: hidden');
  expect(container.textContent).not.toContain('Report processed.');
  expect(button('Hide review').disabled).toBe(false);
  await click('Hide review');
  expect(axiosInstance.patch).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Report processed.');
});
test('unknown network result never displays success', async () => {
  await mount();
  axiosInstance.patch.mockRejectedValue(new Error('offline'));
  await click('Dismiss report');
  expect(container.querySelector('[role="alert"]').textContent).toContain('could not be confirmed');
  expect(container.textContent).not.toContain('Report processed.');
});
test('missing review shows explanation and permits only dismissal', async () => {
  axiosInstance.get.mockResolvedValue({ data: [{ ...report, reviewId: null }] });
  await mount();
  expect(container.textContent).toContain('review is no longer available');
  expect(button('Hide review').disabled).toBe(true);
  expect(button('Delete review').disabled).toBe(true);
  expect(button('Dismiss report').disabled).toBe(false);
});
test('duplicate action clicks send only one request', async () => {
  await mount();
  let finish;
  axiosInstance.patch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => { button('Hide review').click(); button('Hide review').click(); });
  expect(axiosInstance.patch).toHaveBeenCalledTimes(1);
  expect(button('Refresh reports').disabled).toBe(true);
  await act(async () => { finish({ data: { message: 'Review hidden.' } }); });
});
test('failed queue load is not displayed as an empty queue; refresh retries', async () => {
  axiosInstance.get.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(container.textContent).toContain('Could not load reports.');
  expect(container.textContent).not.toContain('No open reports.');
  await click('Refresh reports');
  expect(container.querySelector('article')).not.toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
for (const role of ['customer', 'owner', null]) {
  test(`${role || 'guest'} cannot load or operate the queue`, async () => {
    useAuth.mockReturnValue({ user: role ? { role, token: 'test-token' } : null });
    await mount();
    expect(axiosInstance.get).not.toHaveBeenCalled();
    expect(button('Hide review')).toBeUndefined();
  });
}
test('logging out clears the queue and ignores an old pending response', async () => {
  let finish;
  axiosInstance.get.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await mount();
  useAuth.mockReturnValue({ user: null });
  await mount();
  await act(async () => { finish({ data: [report] }); });
  expect(container.textContent).not.toContain('Review content');
  expect(container.textContent).toContain('log in');
});

test('processed reports show distinct decisions, actor and time without moderation buttons', async () => {
  await mount();
  axiosInstance.get.mockResolvedValue({ data: ['dismiss', 'hide', 'delete'].map(decision => ({
    ...report, _id: decision, decision, status: decision === 'dismiss' ? 'dismissed' : 'actioned',
    reviewId: decision === 'delete' ? null : report.reviewId,
    resolvedBy: { name: 'Admin Alice' }, resolvedAt: '2026-10-16T10:00:00Z'
  })) });
  await click('Processed reports');
  expect(axiosInstance.get).toHaveBeenLastCalledWith('/api/admin/reports/history', { headers: { Authorization: 'Bearer test-token' } });
  for (const text of ['Report dismissed', 'Review hidden', 'Review deleted', 'Admin Alice', 'Processed at:', 'decision is retained']) {
    expect(container.textContent).toContain(text);
  }
  expect(button('Delete review')).toBeUndefined();
  expect(button('Hide review')).toBeUndefined();
  axiosInstance.get.mockResolvedValue({ data: [report] });
  await click('Open reports');
  expect(button('Hide review')).toBeDefined();
});
test('legacy history does not guess a decision or admin', async () => {
  await mount();
  axiosInstance.get.mockResolvedValue({ data: [{ ...report, decision: null, resolvedBy: null, resolvedAt: null }] });
  await click('Processed reports');
  expect(container.textContent).toContain('Decision not recorded');
  expect(container.textContent).toContain('Administrator unavailable');
  expect(container.textContent).toContain('Time not recorded');
});
test('empty history and failed history load are distinct', async () => {
  await mount();
  axiosInstance.get.mockResolvedValueOnce({ data: [] });
  await click('Processed reports');
  expect(container.textContent).toContain('No processed reports.');
  axiosInstance.get.mockRejectedValueOnce({ response: { data: { message: 'Could not load report history.' } } });
  await click('Refresh reports');
  expect(container.querySelector('[role="alert"]').textContent).toBe('Could not load report history.');
  expect(container.textContent).not.toContain('No processed reports.');
});
test('pending deleted review offers delete retry and prevents relabelling as dismissal', async () => {
  axiosInstance.get.mockResolvedValue({ data: [{ ...report, reviewId: null, decision: 'delete' }] });
  await mount();
  expect(button('Dismiss report').disabled).toBe(true);
  expect(button('Hide review').disabled).toBe(true);
  expect(button('Delete review').disabled).toBe(false);
  await click('Delete review');
  await click('Confirm deletion');
  expect(axiosInstance.patch.mock.calls[0][1]).toEqual({ action: 'delete' });
});
