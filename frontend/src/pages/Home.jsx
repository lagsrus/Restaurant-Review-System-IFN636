import { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await axiosInstance.get('/api/tasks/all');
        setReviews(response.data);
      } catch (error) {
        console.error('Failed to fetch reviews', error);
      }
    };

    fetchReviews();
  }, []);

  const handleDelete = async (id) => {
    if (!user || !user.isAdmin) return;

    try {
      await axiosInstance.delete(`/api/tasks/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      setReviews((prev) => prev.filter((review) => review._id !== id));
    } catch (error) {
      alert('Failed to delete review.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">All Reviews</h1>

      {reviews.length === 0 ? (
        <p>No reviews yet.</p>
      ) : (
        reviews.map((review) => (
          <div key={review._id} className="bg-white shadow-md rounded p-5 mb-4">
            <h2 className="text-2xl font-bold">{review.title}</h2>
            <p className="text-gray-600">{review.cuisine}</p>
            <p><strong>Location:</strong> {review.location}</p>
            <p><strong>Wait Time:</strong> {review.waitTime}</p>
            <p><strong>Cost:</strong> {review.cost}</p>
            <p><strong>Rating:</strong> {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
            <p className="mt-3">{review.description}</p>

            {user && user.isAdmin && (
              <button
                onClick={() => handleDelete(review._id)}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default Home;