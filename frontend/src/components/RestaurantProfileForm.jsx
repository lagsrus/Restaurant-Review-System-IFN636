export const emptyRestaurantForm = () => ({
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

export function restaurantToForm(restaurant) {
  const result = emptyRestaurantForm();
  for (const key of ['name', 'cuisine', 'priceLevel', 'description', 'phone', 'openingHours', 'menuUrl', 'websiteUrl']) {
    result[key] = String(restaurant[key] ?? result[key]);
  }
  for (const key of ['address', 'suburb', 'latitude', 'longitude', 'mapsUrl']) {
    result[key] = String(restaurant.location?.[key] ?? '');
  }
  result.imageUrls = (restaurant.imageUrls || []).join('\n');
  return result;
}

export function restaurantFormToPayload(form) {
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

export default function RestaurantProfileForm({
  form,
  onChange,
  onSubmit,
  heading,
  saveLabel,
  busy = false,
  disabled = false,
  onCancel,
  cancelLabel = 'Cancel edit',
  headingRef
}) {
  return (
    <section className="border rounded p-5 mb-8 bg-white">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold mb-4">{heading}</h2>
      <form onSubmit={onSubmit}>
        <fieldset disabled={busy || disabled}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([key, label, maxLength, type = 'text']) => (
              <label key={key} className="block" htmlFor={`restaurant-${key}`}>
                <span className="block mb-1">{label}{key === 'name' ? ' (required)' : ''}</span>
                <input
                  id={`restaurant-${key}`} name={key} type={type} required={key === 'name'}
                  maxLength={maxLength || undefined} step={type === 'number' ? 'any' : undefined}
                  min={key === 'latitude' ? -90 : key === 'longitude' ? -180 : undefined}
                  max={key === 'latitude' ? 90 : key === 'longitude' ? 180 : undefined}
                  value={form[key]} onChange={event => onChange(key, event.target.value)}
                  className="border rounded w-full p-2"
                />
              </label>
            ))}
            <label htmlFor="restaurant-priceLevel">Price level
              <select id="restaurant-priceLevel" value={form.priceLevel} onChange={event => onChange('priceLevel', event.target.value)} className="block border rounded w-full p-2 mt-1">
                <option value="1">$</option><option value="2">$$</option><option value="3">$$$</option>
              </select>
            </label>
          </div>
          <label htmlFor="restaurant-description" className="block mt-4">Description
            <textarea id="restaurant-description" maxLength={2000} rows={3} value={form.description} onChange={event => onChange('description', event.target.value)} className="block border rounded w-full p-2 mt-1" />
          </label>
          <label htmlFor="restaurant-imageUrls" className="block mt-4">Image URLs (one per line, up to 10)
            <textarea id="restaurant-imageUrls" rows={3} value={form.imageUrls} onChange={event => onChange('imageUrls', event.target.value)} className="block border rounded w-full p-2 mt-1" />
          </label>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{busy ? 'Saving...' : saveLabel}</button>
            {onCancel && <button type="button" onClick={onCancel} className="border rounded px-4 py-2">{cancelLabel}</button>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
