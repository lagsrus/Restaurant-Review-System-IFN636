import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

const emptyForm = () => ({
  name: '', cuisine: '', priceLevel: '1', description: '', phone: '', openingHours: '',
  address: '', suburb: '', latitude: '', longitude: '', mapsUrl: '',
  imageUrls: '', menuUrl: '', websiteUrl: ''
});
const fields = [
  ['name', 'Restaurant name', 120], ['cuisine', 'Cuisine', 80],
  ['phone', 'Phone', 50], ['openingHours', 'Opening hours', 500],
  ['address', 'Address', 300], ['suburb', 'Suburb', 100],
  ['latitude', 'Latitude', null, 'number'], ['longitude', 'Longitude', null, 'number'],
  ['mapsUrl', 'Map URL', 2048, 'url'], ['menuUrl', 'Menu URL', 2048, 'url'],
  ['websiteUrl', 'Website URL', 2048, 'url']
];

function toForm(restaurant) {
  const result = emptyForm();
  for (const key of ['name', 'cuisine', 'priceLevel', 'description', 'phone', 'openingHours', 'menuUrl', 'websiteUrl']) {
    result[key] = String(restaurant[key] ?? result[key]);
  }
  for (const key of ['address', 'suburb', 'latitude', 'longitude', 'mapsUrl']) {
    result[key] = String(restaurant.location?.[key] ?? '');
  }
  result.imageUrls = (restaurant.imageUrls || []).join('\n');
  return result;
}

function toPayload(form) {
  return {
    name: form.name, cuisine: form.cuisine, priceLevel: Number(form.priceLevel),
    description: form.description, phone: form.phone, openingHours: form.openingHours,
    location: {
      address: form.address, suburb: form.suburb, mapsUrl: form.mapsUrl,
      latitude: form.latitude.trim() === '' ? null : Number(form.latitude),
      longitude: form.longitude.trim() === '' ? null : Number(form.longitude)
    },
    imageUrls: form.imageUrls.split('\n').map(url => url.trim()).filter(Boolean),
    menuUrl: form.menuUrl, websiteUrl: form.websiteUrl
  };
}

export default function AdminRestaurants() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
    setForm(emptyForm());
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
      if (editing) await axiosInstance.patch(`/api/admin/restaurants/${editing}`, toPayload(form), options);
      else await axiosInstance.post('/api/admin/restaurants', toPayload(form), options);
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

      <section className="border rounded p-5 mb-8 bg-white">
        <h2 ref={formHeading} tabIndex={-1} className="text-xl font-bold mb-4">{editing ? 'Edit restaurant' : 'Create restaurant'}</h2>
        <form onSubmit={save}>
          <fieldset disabled={busy || !!deleting}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(([key, label, maxLength, type = 'text']) => (
                <label key={key} className="block" htmlFor={`restaurant-${key}`}>
                  <span className="block mb-1">{label}{key === 'name' ? ' (required)' : ''}</span>
                  <input
                    id={`restaurant-${key}`} name={key} type={type} required={key === 'name'}
                    maxLength={maxLength || undefined} step={type === 'number' ? 'any' : undefined}
                    min={key === 'latitude' ? -90 : key === 'longitude' ? -180 : undefined}
                    max={key === 'latitude' ? 90 : key === 'longitude' ? 180 : undefined}
                    value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
                    className="border rounded w-full p-2"
                  />
                </label>
              ))}
              <label htmlFor="restaurant-priceLevel">Price level
                <select id="restaurant-priceLevel" value={form.priceLevel} onChange={event => setForm(current => ({ ...current, priceLevel: event.target.value }))} className="block border rounded w-full p-2 mt-1">
                  <option value="1">$</option><option value="2">$$</option><option value="3">$$$</option>
                </select>
              </label>
            </div>
            <label htmlFor="restaurant-description" className="block mt-4">Description
              <textarea id="restaurant-description" maxLength={2000} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="block border rounded w-full p-2 mt-1" />
            </label>
            <label htmlFor="restaurant-imageUrls" className="block mt-4">Image URLs (one per line, up to 10)
              <textarea id="restaurant-imageUrls" rows={3} value={form.imageUrls} onChange={event => setForm(current => ({ ...current, imageUrls: event.target.value }))} className="block border rounded w-full p-2 mt-1" />
            </label>
            <div className="flex gap-3 mt-4">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{busy ? 'Saving...' : editing ? 'Save changes' : 'Create restaurant'}</button>
              {editing && <button type="button" onClick={() => { resetForm(); setError(''); }} className="border rounded px-4 py-2">Cancel edit</button>}
            </div>
          </fieldset>
        </form>
      </section>

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
                setEditing(restaurant._id); setForm(toForm(restaurant)); setError(''); setNotice('');
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
