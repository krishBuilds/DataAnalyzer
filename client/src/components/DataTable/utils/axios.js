import axios from 'axios';

export const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 300000,
  maxContentLength: 100 * 1024 * 1024,
}); 