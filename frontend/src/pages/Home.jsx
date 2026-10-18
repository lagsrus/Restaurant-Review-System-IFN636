import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import RestaurantFilterBar from '../components/RestaurantFilterBar';

// FR-03: the home page shows restaurants as cards.
// FR-04: the home page can search and filter the restaurants.
// Guests can browse, so no login is needed here.

// Show the price level as dollar signs.
const priceLabel = (level) => '$'.repeat(level || 1);

const Home = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    cuisine: '',
    suburb: '',
    priceLevel: '',
    minRating: '',
  });
  const [meta, setMeta] = useState({ cuisines: [], suburbs: [] });

  // Track the latest load. Each load takes the next number, and when its
  // response comes back we only use it if it is still the latest. This stops a
  // slow earlier search from landing after a newer one and showing results that
  // do not match what the user last typed.
  const latestRequestRef = useRef(0);

  // Load one page of restaurants for the given filters. The page number is only
  // changed after a successful load, so the page shown always matches the
  // restaurants on screen. If the load fails we show a clear message and keep
  // the last good page and its restaurants, so nothing becomes inconsistent.
  const loadPage = async (target, activeFilters) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    setLoading(true);
    setError('');
    try {
      // Only send filter values that are set.
      const params = { page: target };
      Object.keys(activeFilters).forEach((key) => {
        if (activeFilters[key] !== '') {
          params[key] = activeFilters[key];
        }
      });

      const response = await axiosInstance.get('/api/restaurants', { params });

      // A newer load started while we waited, so ignore this stale response.
      if (requestId !== latestRequestRef.current) {
        return;
      }

      setRestaurants(response.data.data);
      setTotalPages(response.data.totalPages);
      setPage(target);
    } catch (err) {
      if (requestId !== latestRequestRef.current) {
        return;
      }
      console.error('Failed to fetch restaurants', err);
      setError('Could not load restaurants. Please try again.');
    }

    if (requestId === latestRequestRef.current) {
      setLoading(false);
    }
  };

  // Load the cuisine and suburb options for the filter dropdowns once.
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const response = await axiosInstance.get('/api/restaurants/meta');
        setMeta(response.data);
      } catch (err) {
        console.error('Failed to fetch filter options', err);
      }
    };

    fetchMeta();
  }, []);

  // Load the first page of restaurants on first render.
  useEffect(() => {
    loadPage(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a filter changes, reload from the first page with the new filters.
  const handleFilterChange = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    loadPage(1, next);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Restaurants</h1>

      <RestaurantFilterBar filters={filters} meta={meta} onChange={handleFilterChange} />

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

      {/* Simple next and previous paging. Each click loads that page with the
          current filters and only moves the page number if the load succeeds. */}
      {!loading && restaurants.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => loadPage(page - 1, filters)}
            disabled={page <= 1}
            className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => loadPage(page + 1, filters)}
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
