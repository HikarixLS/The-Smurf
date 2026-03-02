import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '@/utils/constants';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth headers here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Return response data directly
    return response.data;
  },
  (error) => {
    // Global error handling
    if (error.response) {
      // Server responded with error status
      const { status } = error.response;
      switch (status) {
        case 404:
          return Promise.reject(new Error('Không tìm thấy dữ liệu'));
        case 500:
          return Promise.reject(new Error('Lỗi server, vui lòng thử lại sau'));
        case 503:
          return Promise.reject(new Error('Dịch vụ tạm thời không khả dụng'));
        default:
          return Promise.reject(new Error('Đã xảy ra lỗi, vui lòng thử lại'));
      }
    } else if (error.request) {
      // Request made but no response received — log URL only, not the entire XMLHttpRequest
      const url = error.config?.url || 'unknown';
      console.warn(`[API] No response from: ${url}`);
      return Promise.reject(new Error('Không thể kết nối đến server'));
    } else {
      return Promise.reject(error);
    }
  }
);

export default apiClient;
