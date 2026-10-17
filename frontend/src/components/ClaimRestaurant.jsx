import { useRef, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function ClaimRestaurant({ restaurantId }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

  if (user?.role !== 'owner') return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionInFlight.current) return;

    submissionInFlight.current = true;
    setSubmitting(true);
    setFeedback('');
    setError('');

    try {
      const response = await axiosInstance.post(
        `/api/restaurants/${restaurantId}/claims`,
        { message },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setFeedback(response.data.message || 'Claim submitted for administrator review.');
      setMessage('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit the ownership claim.');
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Claim this restaurant</h2>
      <label className="block mb-3">
        <span className="block mb-1">Supporting message (optional)</span>
        <textarea
          value={message}
          maxLength={500}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full p-2 border rounded"
          rows="3"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting claim...' : 'Submit ownership claim'}
      </button>
      {feedback && <p role="status" className="mt-3 text-green-700">{feedback}</p>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </form>
  );
}

export default ClaimRestaurant;
