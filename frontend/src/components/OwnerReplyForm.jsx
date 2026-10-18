import { useRef, useState } from 'react';
import axiosInstance from '../axiosConfig';

function OwnerReplyForm({ reviewId, token, onReplyPosted }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

  const handleSubmit = async event => {
    event.preventDefault();
    if (submissionInFlight.current) return;

    submissionInFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await axiosInstance.post(
        `/api/reviews/${reviewId}/reply`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onReplyPosted(response.data);
      setText('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not post the owner reply.');
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t pt-4">
      <label className="block">
        <span className="block mb-1 font-semibold">Reply to this review</span>
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          maxLength={2000}
          required
          rows={3}
          className="w-full p-2 border rounded"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || !text.trim()}
        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Posting reply...' : 'Post public reply'}
      </button>
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </form>
  );
}

export default OwnerReplyForm;
