# Restaurant-Review-System-IFN636

## Prerequisites
- Node.js
- MongoDB

## Setup
- Clone the repository
- Create a MongoDB cluster, or use the team cluster
- Enter the Mongo connection URI into the backend .env file
- Decide whether to run the application locally or in the cloud

### Local Deployment
- Run npm start in the backend and frontend folders
- Visit the local URL provided
- Create user accounts and access the system. Admin accounts are set by changing the role to admin on an existing account in the database.

### Cloud Deployment (AWS, Assessment 2)
The application runs on two EC2 instances behind an AWS Application Load Balancer, with deployment automated through GitHub Actions.
- CI/CD: a push to the main branch runs the tests and deploys to both instances through a self hosted GitHub Actions runner on each instance (.github/workflows/ci.yml).
- Each instance runs the backend and the frontend under PM2, with Nginx on port 80 reverse proxying to the frontend and forwarding /api to the backend.
- The load balancer distributes traffic across the two instances on port 80.
- The frontend API address is set at build time with the REACT_APP_API_URL environment variable in the workflow, pointing at the load balancer, so no manual edit of axiosConfig is needed.
- Secrets (MONGO_URI, JWT_SECRET, PORT) are stored in GitHub and written to the server .env at deploy time.

## Architecture Summary
- MongoDB database with Mongoose schemas
- Frontend: React
- Backend: Express
- Authentication: JWT with role checks
- Deployment: two EC2 instances behind an AWS Application Load Balancer, Nginx and PM2 on each, CI/CD with GitHub Actions

## Known Limitations
- The frontend does not fully match the Figma prototype, but the core functionality is implemented
- Admins cannot delete users, only reviews. Users are removed through the database.

## Deployment URL
- Live through the load balancer (Assessment 2): http://MyGroup3AppLB-1551883173.ap-southeast-2.elb.amazonaws.com
- Instance 1 direct access: http://54.206.187.126
