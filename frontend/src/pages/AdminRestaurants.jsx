import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import RestaurantProfileForm, {
  emptyRestaurantForm,
  restaurantFormToPayload,
  restaurantToForm
} from '../components/RestaurantProfileForm';

export default function AdminRestaurants() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyRestaurantForm);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const formHeading = useRef(null);

  useEffect(() => {
    if (user?.role !== 'admin' || !user?.token) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    axiosInstance.get('/api/admin/restaurants', {
      headers: { Authorization: `Bearer ${user.token}` }
    }).then(response => {
      if (active) setRestaurants(response.data);
    }).catch(err => {
      if (active) setLoadError(err.response?.data?.message || 'Could not load restaurants.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, user?.token, refreshCount]);

  function resetForm() {
    setEditing(null);
    setForm(emptyRestaurantForm());
  }

  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const options = { headers: { Authorization: `Bearer ${user.token}` } };
      if (editing) await axiosInstance.patch(`/api/admin/restaurants/${editing}`, restaurantFormToPayload(form), options);
      else await axiosInstance.post('/api/admin/restaurants', restaurantFormToPayload(form), options);
      setNotice(editing ? 'Restaurant updated.' : 'Restaurant created.');
      resetForm();
      setRefreshCount(count => count + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the restaurant.');
      if (err.response?.status === 404) setRefreshCount(count => count + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (inFlight.current || !deleting) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/api/admin/restaurants/${deleting._id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setNotice(`${deleting.name} and its related records were deleted.`);
      setRestaurants(items => items.filter(item => item._id !== deleting._id));
      if (editing === deleting._id) resetForm();
      setDeleting(null);
      setRefreshCount(count => count + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the restaurant.');
      if (err.response?.status === 404) {
        if (editing === deleting._id) resetForm();
        setDeleting(null);
        setRefreshCount(count => count + 1);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!user?.token) return <p className="p-6">Please <Link to="/login" className="text-blue-600 underline">log in</Link> as an admin to manage restaurants.</p>;
  if (user.role !== 'admin') return <p role="alert" className="p-6">Only administrators can manage restaurants.</p>;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Manage Restaurants</h1>
      {notice && <p role="status" className="mb-4 text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}

      {deleting && (
        <section role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-description" className="border border-red-400 rounded p-4 mb-6 bg-red-50">
          <h2 id="delete-title" className="font-bold">Delete {deleting.name}?</h2>
          <p id="delete-description" className="my-3">This permanently removes the restaurant and all related reviews, ownership claims and reports. This cannot be undone.</p>
          <button autoFocus disabled={busy} onClick={() => setDeleting(null)} className="border rounded px-4 py-2 mr-3 disabled:opacity-50">Cancel deletion</button>
          <button disabled={busy} onClick={confirmDelete} className="bg-red-700 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Deleting...' : 'Confirm deletion'}</button>
        </section>
      )}

      <RestaurantProfileForm
        form={form}
        onChange={(key, value) => setForm(current => ({ ...current, [key]: value }))}
        onSubmit={save}
        heading={editing ? 'Edit restaurant' : 'Create restaurant'}
        saveLabel={editing ? 'Save changes' : 'Create restaurant'}
        busy={busy}
        disabled={!!deleting}
        headingRef={formHeading}
        onCancel={editing ? () => { resetForm(); setError(''); } : undefined}
      />

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Restaurants</h2>
          <button disabled={busy || loading || !!deleting} onClick={() => setRefreshCount(count => count + 1)} className="border rounded px-4 py-2 disabled:opacity-50">Refresh restaurants</button>
        </div>
        {loading && <p role="status">Loading restaurants...</p>}
        {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
        {!loading && !loadError && restaurants.length === 0 && <p>No restaurants yet.</p>}
        {!loading && !loadError && restaurants.map(restaurant => (
          <article key={restaurant._id} className="border rounded p-4 mb-3 flex flex-wrap justify-between gap-4">
            <div>
              <Link to={`/restaurants/${restaurant._id}`} className="text-lg font-semibold text-blue-700 underline">{restaurant.name}</Link>
              <p>{[restaurant.cuisine, restaurant.location?.suburb].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex gap-3 items-center">
              <button disabled={busy || !!deleting} onClick={() => {
                setEditing(restaurant._id); setForm(restaurantToForm(restaurant)); setError(''); setNotice('');
                formHeading.current?.focus();
              }} className="border rounded px-4 py-2 disabled:opacity-50">Edit</button>
              <button disabled={busy || !!deleting} onClick={() => { setDeleting(restaurant); setError(''); setNotice(''); }} className="border border-red-700 text-red-700 rounded px-4 py-2 disabled:opacity-50">Delete</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
