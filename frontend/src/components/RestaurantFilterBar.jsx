// FR-04: a small filter bar for the home page.
// It has a search box and dropdowns for cuisine, suburb, price and rating.
// The cuisine and suburb options come from the backend meta endpoint.

const priceOptions = [
  { value: '', label: 'Any price' },
  { value: '1', label: '$' },
  { value: '2', label: '$$' },
  { value: '3', label: '$$$' },
];

const ratingOptions = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3 and up' },
  { value: '4', label: '4 and up' },
  { value: '4.5', label: '4.5 and up' },
];

const RestaurantFilterBar = ({ filters, meta, onChange }) => {
  return (
    <div className="bg-white shadow-md rounded p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input
        type="text"
        placeholder="Search by name"
        value={filters.search}
        onChange={(e) => onChange('search', e.target.value)}
        className="border rounded p-2"
      />

      <select
        value={filters.cuisine}
        onChange={(e) => onChange('cuisine', e.target.value)}
        className="border rounded p-2"
      >
        <option value="">All cuisines</option>
        {meta.cuisines.map((cuisine) => (
          <option key={cuisine} value={cuisine}>{cuisine}</option>
        ))}
      </select>

      <select
        value={filters.suburb}
        onChange={(e) => onChange('suburb', e.target.value)}
        className="border rounded p-2"
      >
        <option value="">All suburbs</option>
        {meta.suburbs.map((suburb) => (
          <option key={suburb} value={suburb}>{suburb}</option>
        ))}
      </select>

      <select
        value={filters.priceLevel}
        onChange={(e) => onChange('priceLevel', e.target.value)}
        className="border rounded p-2"
      >
        {priceOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <select
        value={filters.minRating}
        onChange={(e) => onChange('minRating', e.target.value)}
        className="border rounded p-2"
      >
        {ratingOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};

export default RestaurantFilterBar;
