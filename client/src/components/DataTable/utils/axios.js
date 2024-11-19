import axios from 'axios';

export const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 60000,
  maxContentLength: 100 * 1024 * 1024,
}); 