import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function AdminClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin' || !user?.token) return;

    let active = true;
    setLoading(true);
    setError('');
    setClaims([]);

    const loadClaims = async () => {
      try {
        const response = await axiosInstance.get('/api/admin/claims', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (active) setClaims(response.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || 'Could not load ownership claims.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadClaims();
    return () => { active = false; };
  }, [user?.role, user?.token, refreshCount]);

  if (!user?.token) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Please <Link to="/login" className="text-blue-600 underline">log in</Link> as an admin to view ownership claims.</p>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return <p role="alert" className="p-6">Only administrators can view ownership claims.</p>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Pending Ownership Claims</h1>
        <button
          onClick={() => setRefreshCount(count => count + 1)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Refresh claims
        </button>
      </div>

      {loading && <p role="status">Loading claims...</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!loading && !error && claims.length === 0 && (
        <p>No pending ownership claims.</p>
      )}

      {!loading && !error && claims.map(claim => (
        <article key={claim._id} className="bg-white border rounded p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">
            {claim.restaurantId?.name || 'Restaurant no longer available'}
          </h2>
          <p><strong>Applicant:</strong> {claim.userId?.name || 'Applicant no longer available'}</p>
          {claim.userId?.email && <p><strong>Email:</strong> {claim.userId.email}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words">
            <strong>Message:</strong> {claim.message || 'No supporting message.'}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Submitted: {new Date(claim.createdAt).toLocaleString()}
          </p>
        </article>
      ))}
    </main>
  );
}

export default AdminClaims;
