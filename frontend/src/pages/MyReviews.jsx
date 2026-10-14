import { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function MyReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
const [editRatings, setEditRatings] = useState({});
const [editComment, setEditComment] = useState('');

  useEffect(() => {
    if (user?.role !== 'customer' || !user?.token) {
      setLoading(false);
      return;
    }

    const loadReviews = async () => {
      try {
        const response = await axiosInstance.get('/api/reviews/mine', {
          headers: { Authorization: `Bearer ${user.token}` }
        });

        setReviews(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load reviews.');
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [user?.role, user?.token]);
    const handleDelete = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;

    try {
        await axiosInstance.delete(`/api/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
        });

        setReviews(current =>
        current.filter(review => review._id !== reviewId)
        );
    } catch (err) {
        setError(err.response?.data?.message || 'Could not delete review.');
    }
    };

const startEdit = (review) => {
            setEditingId(review._id);
            setEditRatings({
                food: review.ratings.food,
                service: review.ratings.service,
                ambience: review.ratings.ambience,
                value: review.ratings.value
            });
            setEditComment(review.comment);
            setError('');
            };

            const handleSave = async (reviewId) => {
            try {
                const response = await axiosInstance.put(
                `/api/reviews/${reviewId}`,
                {
                    ratings: editRatings,
                    comment: editComment
                },
                {
                    headers: { Authorization: `Bearer ${user.token}` }
                }
                );

                setReviews(current =>
                current.map(review =>
                    review._id === reviewId ? response.data : review
                )
                );

                setEditingId(null);
                setError('');
            } catch (err) {
                setError(err.response?.data?.message || 'Could not update review.');
            }
            };

  if (!user || user.role !== 'customer') {
    return <p className="p-6">Please log in as a customer to view your reviews.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Reviews</h1>

      {loading && <p>Loading reviews...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <p>You have not written any reviews yet.</p>
      )}

      {reviews.map(review => (
        <div key={review._id} className="bg-white p-4 mb-4 rounded shadow">
          <p className="text-sm text-gray-600">
            Restaurant: {review.restaurantId}
          </p>


        {editingId === review._id ? (
        <div className="mt-3">
            {['food', 'service', 'ambience', 'value'].map(field => (
            <label key={field} className="block mb-3">
                <span className="block capitalize mb-1">{field}</span>
                <select
                value={editRatings[field]}
                onChange={e => setEditRatings({
                    ...editRatings,
                    [field]: Number(e.target.value)
                })}
                className="border rounded p-2"
                >
                {[1, 2, 3, 4, 5].map(value => (
                    <option key={value} value={value}>
                    {value} stars
                    </option>
                ))}
                </select>
            </label>
            ))}

            <textarea
            value={editComment}
            onChange={e => setEditComment(e.target.value)}
            className="w-full border rounded p-2 mb-3"
            rows="3"
            />

            <button
            onClick={() => handleSave(review._id)}
            className="bg-green-600 text-white px-4 py-2 rounded mr-2"
            >
            Save
            </button>

    <button
      onClick={() => setEditingId(null)}
      className="bg-gray-500 text-white px-4 py-2 rounded"
    >
      Cancel
    </button>
  </div>
) : (
  <>
    <p className="font-bold mt-2">
      Overall rating: {review.score} / 5
    </p>

    <p>
      Food: {review.ratings.food} |
      Service: {review.ratings.service} |
      Ambience: {review.ratings.ambience} |
      Value: {review.ratings.value}
    </p>

    <p className="mt-2">{review.comment}</p>

    <button
      onClick={() => startEdit(review)}
      className="mt-3 bg-blue-600 text-white px-4 py-2 rounded mr-2"
    >
      Edit
    </button>

    <button
      onClick={() => handleDelete(review._id)}
      className="mt-3 bg-red-600 text-white px-4 py-2 rounded"
    >
      Delete
    </button>
  </>
)}

        </div>
      ))}
    </div>
  );
}

export default MyReviews;