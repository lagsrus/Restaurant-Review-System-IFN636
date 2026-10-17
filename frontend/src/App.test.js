import { render, screen } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import axiosInstance from './axiosConfig';

jest.mock('./axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

test('renders the home page for a guest', async () => {
  axiosInstance.get.mockResolvedValue({ data: [] });

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  expect(screen.getByRole('heading', { name: 'All Reviews' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
  expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
});
