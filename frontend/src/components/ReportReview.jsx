import { useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function ReportReview({ reviewId }) {
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('spam');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || !['customer', 'owner'].includes(user.role)) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await axiosInstance.post(
        `/api/reviews/${reviewId}/reports`,
        { reason, note },
        {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        }
      );

      setSubmitted(true);
      setShowForm(false);
      setMessage('Report submitted successfully.');
    } catch (error) {
      setMessage(
        error.response?.data?.message || 'Failed to submit report.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      {!submitted && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-red-600 underline"
        >
          Report Review
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 p-4 border rounded">
          <label className="block mb-2">
            Reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="block border rounded p-2 mt-1 w-full"
            >
              <option value="spam">Spam</option>
              <option value="offensive">Offensive content</option>
              <option value="fake">Fake review</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block mb-3">
            Additional details (optional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="block border rounded p-2 mt-1 w-full"
              rows={3}
            />
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && (
        <p role="status" className="mt-2">
          {message}
        </p>
      )}
    </div>
  );
}

export default ReportReview;