// Focused suite: npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/RestaurantDetails.test.jsx --setupFilesAfterEnv=react-dom/test-utils
// The legacy setupTests.js imports jest-dom, which is absent from this project's dependencies.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RestaurantDetails from './RestaurantDetails';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

jest.mock('../axiosConfig', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./RatingBreakdown', () => () => null);
jest.mock('../components/ReportReview', () => () => null);

const restaurant = {
  _id: 'restaurant-1',
  name: 'Test Kitchen',
  ownerId: null,
  ratingSummary: { avgRating: 0, reviewCount: 0 }
};
let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  axiosInstance.get.mockResolvedValue({
    data: { restaurant: { ...restaurant }, reviews: [] }
  });
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
    root.render(
      <MemoryRouter initialEntries={['/restaurants/restaurant-1']}>
        <Routes>
          <Route path="/restaurants/:restaurantId" element={<RestaurantDetails />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

test('shows the claim form to an owner when the restaurant is unclaimed', async () => {
  await mount();
  expect(container.textContent).toContain('Claim this restaurant');
  expect(container.querySelector('form')).not.toBeNull();
});

test('hides the claim form when the restaurant already has an owner', async () => {
  axiosInstance.get.mockResolvedValue({
    data: {
      restaurant: { ...restaurant, ownerId: 'existing-owner' },
      reviews: []
    }
  });
  await mount();
  expect(container.textContent).not.toContain('Claim this restaurant');
  expect(container.querySelector('form')).toBeNull();
});

test('does not show the owner claim form to customers', async () => {
  useAuth.mockReturnValue({ user: { role: 'customer', token: 'customer-token' } });
  await mount();
  expect(container.textContent).not.toContain('Claim this restaurant');
  expect(container.querySelector('form')).toBeNull();
});

test('allows the assigned owner to post a public reply to a published review', async () => {
  const review = {
    _id: 'review-1',
    score: 4,
    createdAt: '2026-10-17T00:00:00.000Z',
    ratings: { food: 4, service: 4, ambience: 4, value: 4 },
    comment: 'A good meal'
  };
  useAuth.mockReturnValue({ user: { id: 'owner-1', role: 'owner', token: 'owner-token' } });
  axiosInstance.get.mockResolvedValue({
    data: {
      restaurant: { ...restaurant, ownerId: 'owner-1' },
      reviews: [review]
    }
  });
  axiosInstance.post.mockResolvedValue({
    data: { _id: review._id, ownerReply: { text: 'Thank you for visiting.' } }
  });
  await mount();

  expect(container.textContent).toContain('Reply to this review');
  await act(async () => {
    Simulate.change(container.querySelector('textarea'), { target: { value: '  Thank you for visiting.  ' } });
  });
  await act(async () => {
    Simulate.submit(container.querySelector('form'));
  });

  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/api/reviews/review-1/reply',
    { text: '  Thank you for visiting.  ' },
    { headers: { Authorization: 'Bearer owner-token' } }
  );
  expect(container.textContent).toContain('Thank you for visiting.');
  expect(container.textContent).not.toContain('Reply to this review');
});

test('does not offer owner replies to customers or owners of another restaurant', async () => {
  const review = {
    _id: 'review-1',
    score: 4,
    createdAt: '2026-10-17T00:00:00.000Z',
    ratings: { food: 4, service: 4, ambience: 4, value: 4 },
    comment: 'A good meal'
  };
  axiosInstance.get.mockResolvedValue({
    data: {
      restaurant: { ...restaurant, ownerId: 'owner-1' },
      reviews: [review]
    }
  });

  useAuth.mockReturnValue({ user: { id: 'customer-1', role: 'customer', token: 'customer-token' } });
  await mount();
  expect(container.textContent).not.toContain('Reply to this review');

  useAuth.mockReturnValue({ user: { id: 'owner-2', role: 'owner', token: 'other-token' } });
  await mount();
  expect(container.textContent).not.toContain('Reply to this review');
});
