import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';

// FR-03: the home page shows restaurants as cards.
// Guests can browse, so no login is needed here.

// Show the price level as dollar signs.
const priceLabel = (level) => '$'.repeat(level || 1);

const Home = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load one page of restaurants. The page number is only changed after a
  // successful load, so the page shown always matches the restaurants on
  // screen. If the load fails we show a clear message and keep the last good
  // page and its restaurants, so nothing becomes inconsistent.
  const loadPage = async (target) => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/api/restaurants', {
        params: { page: target },
      });
      setRestaurants(response.data.data);
      setTotalPages(response.data.totalPages);
      setPage(target);
    } catch (err) {
      console.error('Failed to fetch restaurants', err);
      setError('Could not load restaurants. Please try again.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Restaurants</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : restaurants.length === 0 ? (
        <p>No restaurants found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant._id}
              to={`/restaurants/${restaurant._id}`}
              className="bg-white shadow-md rounded p-5 hover:shadow-lg"
            >
              {restaurant.image ? (
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              ) : null}
              <h2 className="text-xl font-bold">{restaurant.name}</h2>
              <p className="text-gray-600">
                {restaurant.cuisine} · {restaurant.suburb}
              </p>
              <p className="text-gray-600">{priceLabel(restaurant.priceLevel)}</p>
              <p className="mt-2">
                <span className="text-yellow-500">★</span> {restaurant.avgRating} ({restaurant.reviewCount})
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Simple next and previous paging. Each click loads that page and only
          moves the page number if the load succeeds. */}
      {!loading && restaurants.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1}
            className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => loadPage(page + 1)}
            disabled={page >= totalPages}
            className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
