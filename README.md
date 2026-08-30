# Restaurant-Review-System-IFN636

## Prerequisites
- Nodejs
- MongoDB

## Setup 
- Clone the repository
- Create a fresh MongoDB cluster
- Enter personal Mongo connection URI into backend .env file
- Determine whether application should be accessed locally OR in cloud:

### Local Deployment
- Run npm start in backend and frontend folders of the project
- Visit local url provided
- Create user account/s and access the system. Admin user accounts are created by manually changing the "isAdmin" attribute to true on an existing account in the MongoDB view.

### Cloud Deployment
- Ensure local backend .env file has your personal MongoDB connection string
- Ensure security rules allow ports 3000 and 5001 on the remote instance. Configure rules to allow inbound traffic from devices you wish to access the app with.
- Find axiosConfig.jsx in the project folder
- Comment out "baseURL: 'http://localhost:5001',"
- Uncomment "baseURL: 'http://<YOUR_PUBLIC_IP_HERE>:5001'," -> Without this step, backend won't work when accessing remotely
- Run npm start in the project folder
- Visit site from external device by pasting public IP of instance + port 3000 into browser, e.g http://15.135.186.175:3000

## Architecture Summary
- MongoDB database, Mongoose schema
- Frontend: ReactJS
- Backend: Express
- Authentication: JWT, role checks

## Known Limitations
- Frontend isn't matched with Figma prototype, however basic functionality is implemented
- Admins cannot delete users, only their reviews. Users must be deleted through the database

## Deployment URL: 
- http://15.135.186.175:3000/
