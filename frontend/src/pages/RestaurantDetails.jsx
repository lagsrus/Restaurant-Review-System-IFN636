import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import RatingBreakdown from './RatingBreakdown';

const dimensions = ['food', 'service', 'ambience', 'value'];

function RestaurantDetails() {
  const { restaurantId } = useParams();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    axiosInstance.get(`/api/restaurants/${restaurantId}/details`)
      .then(response => {
        if (cancelled) return;

        setRestaurant(response.data.restaurant);
        setReviews(response.data.reviews);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;

        setError(err.response?.data?.message || 'Could not load restaurant.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (loading) return <p className="p-6">Loading restaurant...</p>;
  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!restaurant) return null;

  const links = [
    ['View Map', restaurant.location?.mapsUrl],
    ['View Menu', restaurant.menuUrl],
    ['Website', restaurant.websiteUrl]
  ].filter(([, url]) => /^https?:\/\//i.test(url || ''));

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded shadow p-6 mb-6">
        <h1 className="text-3xl font-bold mb-3">
          {restaurant.name}
        </h1>

        {restaurant.imageUrls?.[0] && (
          <img
            src={restaurant.imageUrls[0]}
            alt={restaurant.name}
            className="w-full max-h-80 object-cover rounded mb-4"
          />
        )}

        <p><strong>Cuisine:</strong> {restaurant.cuisine || 'Not specified'}</p>

        <p>
          <strong>Price level:</strong> {'$'.repeat(restaurant.priceLevel || 1)}
        </p>

        <p>
          <strong>Address:</strong>{' '}
          {[restaurant.location?.address, restaurant.location?.suburb]
            .filter(Boolean)
            .join(', ') || 'Not provided'}
        </p>

        {restaurant.description && (
          <p className="mt-3">{restaurant.description}</p>
        )}

        {restaurant.phone && (
          <p className="mt-3">
            <strong>Phone:</strong> {restaurant.phone}
          </p>
        )}

        {restaurant.openingHours && (
          <p>
            <strong>Opening hours:</strong> {restaurant.openingHours}
          </p>
        )}

        <div className="flex flex-wrap gap-4 mt-4">
          {links.map(([label, url]) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              {label}
            </a>
          ))}
        </div>

        {user?.role === 'customer' && (
          <Link
            to={`/restaurants/${restaurantId}/review`}
            className="inline-block mt-5 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Write a Review
          </Link>
        )}
      </div>

      <RatingBreakdown restaurantId={restaurantId} />

      <section className="mt-6">
        <h2 className="text-2xl font-bold mb-4">
          Customer Reviews ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <p>No published reviews yet.</p>
        ) : (
          reviews.map(review => (
            <article
              key={review._id}
              className="bg-white rounded shadow p-5 mb-4"
            >
              <div className="flex justify-between mb-3">
                <strong>{Number(review.score).toFixed(1)} / 5</strong>

                <span className="text-gray-600">
                  {new Date(review.createdAt).toLocaleDateString()}
                  {review.edited ? ' (edited)' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {dimensions.map(field => (
                  <p key={field} className="capitalize">
                    {field}: {review.ratings[field]} / 5
                  </p>
                ))}
              </div>

              <p>{review.comment}</p>

              {review.ownerReply?.text && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <p className="font-bold mb-1">Owner Reply</p>
                  <p>{review.ownerReply.text}</p>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default RestaurantDetails;