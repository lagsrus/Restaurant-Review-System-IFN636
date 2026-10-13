# Review API Contract

Sprint 0 baseline for the A2 Review domain.

## Review endpoints

### Get current user's reviews
GET /api/reviews/mine

### Get reviews for a restaurant
GET /api/restaurants/:restaurantId/reviews

### Create a review
POST /api/restaurants/:restaurantId/reviews

Required review data:
- food rating: 1-5
- service rating: 1-5
- ambience rating: 1-5
- value rating: 1-5
- comment

The review is linked to the authenticated user and restaurant.

### Update own review
PUT /api/reviews/:id

### Delete own review
DELETE /api/reviews/:id

## Requirement alignment

- FR-06: restaurant reviews displayed with restaurant details
- FR-07: customer creates one four-dimension review per restaurant
- FR-08: customer views, edits and deletes own reviews

Full feature implementation and automated/Postman testing will be completed in the relevant feature stories.

## Legacy A1 dependencies identified

The following A1 Task-domain files and references remain temporarily while the Review feature is implemented:

- backend/models/Task.js
- backend/controllers/taskController.js
- backend/routes/taskRoutes.js
- backend/server.js `/api/tasks`
- frontend/src/components/TaskForm.jsx
- frontend/src/components/TaskList.jsx
- frontend/src/pages/Tasks.jsx
- frontend `/api/tasks` references
- `/tasks` route and navigation link

These dependencies should only be removed after the Review API and replacement UI are available.