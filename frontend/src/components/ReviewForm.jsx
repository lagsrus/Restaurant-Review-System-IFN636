import { useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

const fields = ['food', 'service', 'ambience', 'value'];

const ReviewForm = ({ restaurantId, onCreated }) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState({
    food: '', service: '', ambience: '', value: ''
  });
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!restaurantId || user?.role !== 'customer' || !user.token) {
      setMessage('Please log in as a customer to submit a review.');
      return;
    }

    setSaving(true);

    try {
      const response = await axiosInstance.post(
        `/api/restaurants/${restaurantId}/reviews`,
        { ratings, comment },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setMessage('Review submitted successfully.');
      if (onCreated) onCreated(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not submit review.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'customer') {
    return <p>Please log in as a customer to write a review.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 shadow-md rounded max-w-lg">
      <h2 className="text-2xl font-bold mb-4">Write a Review</h2>

      {fields.map((field) => (
        <label key={field} className="block mb-4">
          <span className="block capitalize mb-1">{field}</span>
          <select
            required
            value={ratings[field]}
            onChange={(e) => setRatings({
              ...ratings,
              [field]: Number(e.target.value)
            })}
            className="w-full p-2 border rounded"
          >
            <option value="">Select rating</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>{value} stars</option>
            ))}
          </select>
        </label>
      ))}

      <label className="block mb-4">
        <span className="block mb-1">Comment</span>
        <textarea
          required
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
          rows="4"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Submitting...' : 'Submit Review'}
      </button>

      {message && <p role="status" className="mt-3">{message}</p>}
    </form>
  );
};

export default ReviewForm;
