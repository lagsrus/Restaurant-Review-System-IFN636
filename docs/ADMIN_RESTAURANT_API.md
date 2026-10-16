# RRP-29 / FR-15 Admin restaurant management

Related NFR: NFR-02 (server-side input validation).

All endpoints below require a Bearer token and the `admin` role. Missing or invalid
authentication returns 401; a customer or owner receives 403.

| Method | Endpoint | Success |
| --- | --- | --- |
| GET | `/api/admin/restaurants` | 200, restaurant array ordered by name and ID |
| POST | `/api/admin/restaurants` | 201, saved restaurant |
| PATCH | `/api/admin/restaurants/:restaurantId` | 200, updated restaurant |
| DELETE | `/api/admin/restaurants/:restaurantId` | 200, confirmation message |

The UI is at `/admin/restaurants`, accessible through the admin navigation.
Deletion requires a separate confirmation describing the related data removed.

## Editable fields

`name` is required on creation, following the existing Restaurant model. On edit,
omitted fields remain unchanged, including individual fields within `location`.
Provided text is trimmed. Optional text may be cleared with an empty string.

These limits are implementation choices for NFR-02, not additional assessment rules:

| Field | Validation |
| --- | --- |
| name | Non-blank text, at most 120 characters |
| cuisine | Text, at most 80 characters |
| description | Text, at most 2000 characters |
| phone | Text, at most 50 characters |
| openingHours | Text, at most 500 characters |
| priceLevel | Integer from 1 to 3 |
| location.address / suburb | Text, at most 300 / 100 characters |
| location.latitude / longitude | Number within -90..90 / -180..180, or null |
| location.mapsUrl, menuUrl, websiteUrl | Absolute HTTP(S) URL without credentials or whitespace, at most 2048 characters, or empty |
| imageUrls | Array of up to 10 non-empty URLs with the same URL rules; empty array clears images |

Unsupported fields (including `ownerId`, `ratingSummary`, MongoDB operators and
audit fields) are rejected. Ownership and ratings retain their existing workflows.
Invalid input or malformed IDs return 400 with a JSON `message`, without saving.
Missing restaurants return 404. Database errors return a generic 500 message.

## Deletion and integration

The deletion service uses one MongoDB transaction for the restaurant, its reviews
(published and hidden, including embedded replies), ownership claims, and reports
whose review IDs belong to those reviews. Other restaurants and users are retained.
A replica set is required for transactions (Atlas supports this).

The transaction makes this deletion atomic. It does not serialize independent
creation requests in other modules: review/claim/report writers must coordinate
their parent-existence checks with deletion if concurrent creation is supported.
The integration checks below cover existing related records and rollback, not
concurrent inserts from those other modules.

## Local verification

From the repository root:

```sh
npm --prefix backend test
CI=true npm --prefix frontend test -- --watchAll=false --runInBand --runTestsByPath src/pages/AdminRestaurants.test.jsx --setupFilesAfterEnv=react-dom/test-utils
npm --prefix frontend run build
```

The focused frontend suite uses the existing React utilities because the legacy
`setupTests.js` imports `jest-dom`, which is not in the current dependencies.

For real database checks, from `backend`, run
`node test/integration/adminRestaurant.local.js` with `mongod` on PATH. It starts a
temporary replica set bound to 127.0.0.1, creates isolated data, tests persistence,
permissions, cascade deletion and rollback, then removes its own temporary data.
It never uses `MONGO_URI` or seeds the shared Atlas database.
