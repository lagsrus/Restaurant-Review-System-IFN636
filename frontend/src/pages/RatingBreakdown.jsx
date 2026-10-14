import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../axiosConfig';

const fields = ['food', 'service', 'ambience', 'value'];

function RatingBreakdown({ restaurantId: suppliedId }) {
  const { restaurantId: routeId } = useParams();
  const restaurantId = suppliedId || routeId;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!restaurantId) return;

    let cancelled = false;

    axiosInstance.get(`/api/restaurants/${restaurantId}/ratings`)
      .then(response => {
        if (!cancelled) setData(response.data);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not load ratings.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading ratings...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        Rating Breakdown — {data.restaurantName}
      </h1>

      <div className="bg-white p-5 rounded shadow mb-4">
        <p className="text-3xl font-bold">
          {Number(data.avgRating).toFixed(1)} / 5
        </p>
        <p>{data.reviewCount} published reviews</p>
      </div>

      {data.reviewCount === 0 ? (
        <p>No ratings yet.</p>
      ) : (
        <>
          <div className="bg-white p-5 rounded shadow mb-4">
            <h2 className="text-xl font-bold mb-3">
              Rating Dimensions
            </h2>

            {fields.map(field => (
              <div key={field} className="flex justify-between mb-2">
                <span className="capitalize">{field}</span>
                <strong>
                  {Number(data.dimensions[field]).toFixed(1)} / 5
                </strong>
              </div>
            ))}
          </div>

          <div className="bg-white p-5 rounded shadow mb-4">
            <h2 className="text-xl font-bold mb-3">
              Star Distribution
            </h2>

            {[5, 4, 3, 2, 1].map(star => {
              const count = data.distribution[star] || 0;
              const percentage = count / data.reviewCount * 100;

              return (
                <div key={star} className="flex items-center gap-3 mb-3">
                  <span className="w-16">{star} stars</span>

                  <div className="flex-1 bg-gray-200 rounded h-4">
                    <div
                      className="bg-blue-600 rounded h-4"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-white p-5 rounded shadow">
            <h2 className="text-xl font-bold mb-3">
              Strengths and Weaknesses
            </h2>

            {data.strongest && data.weakest ? (
              <>
                <p><strong>Strongest:</strong> {data.strongest}</p>
                <p><strong>Weakest:</strong> {data.weakest}</p>
              </>
            ) : (
              <p>All four dimensions are equally rated.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RatingBreakdown;