import { useEffect, useState } from 'react';
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

  const [filters, setFilters] = useState({
    search: '',
    cuisine: '',
    suburb: '',
    priceLevel: '',
    minRating: '',
  });
  const [meta, setMeta] = useState({ cuisines: [], suburbs: [] });

  // Load the cuisine and suburb options for the filter dropdowns once.
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const response = await axiosInstance.get('/api/restaurants/meta');
        setMeta(response.data);
      } catch (error) {
        console.error('Failed to fetch filter options', error);
      }
    };

    fetchMeta();
  }, []);

  // Load the restaurants whenever the page or the filters change.
  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        // Only send filter values that are set.
        const params = { page };
        Object.keys(filters).forEach((key) => {
          if (filters[key] !== '') {
            params[key] = filters[key];
          }
        });

        const response = await axiosInstance.get('/api/restaurants', { params });
        setRestaurants(response.data.data);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Failed to fetch restaurants', error);
      }
      setLoading(false);
    };

    fetchRestaurants();
  }, [page, filters]);

  // When a filter changes, go back to the first page.
  const handleFilterChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Restaurants</h1>

      <RestaurantFilterBar filters={filters} meta={meta} onChange={handleFilterChange} />

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

      {/* Simple next and previous paging */}
      {!loading && restaurants.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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
