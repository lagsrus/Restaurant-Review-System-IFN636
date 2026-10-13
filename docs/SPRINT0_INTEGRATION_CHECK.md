# Sprint 0 Integration Check

RRP-13 is complete only when the following checks pass from a clean clone.

## Clean setup

- Clone the repository and checkout the Sprint 0 branch.
- Install backend dependencies with `npm ci`.
- Install frontend dependencies with `npm ci`.
- Create backend `.env` from `.env.example` and provide valid local credentials.

## Backend

- `npm test` passes.
- `npm run seed` creates the known A2 seed dataset.
- `npm run dev` starts the backend.
- Backend reports successful MongoDB connection.

## Frontend

- `npm run build` completes successfully.
- `npm start` loads the application.
- Frontend communicates with the backend.

## Smoke test

Verify:
- customer registration;
- login;
- authenticated navigation;
- profile display/update;
- existing review create/edit/delete flow.

## CI

- GitHub Actions runs on the pull request.
- Backend tests pass.
- Frontend build passes.
- The workflow finishes successfully.

Do not mark RRP-13 Done until every check above has been verified.
