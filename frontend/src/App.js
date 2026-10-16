import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import CreateReview from './pages/CreateReview';
import MyReviews from './pages/MyReviews';
import RatingBreakdown from './pages/RatingBreakdown';
import AdminClaims from './pages/AdminClaims';


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/restaurants/:restaurantId/review" element={<CreateReview />} />
        <Route path="/my-reviews" element={<MyReviews />} />
        <Route path="/restaurants/:restaurantId/ratings" element={<RatingBreakdown />} />
        <Route path="/admin/claims" element={<AdminClaims />} />
      </Routes>
    </Router>
  );
}

export default App;
