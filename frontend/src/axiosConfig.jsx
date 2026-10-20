import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://54.206.187.126:5001', // live
});

export default axiosInstance;
