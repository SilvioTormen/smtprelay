import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Remove loader when app starts
document.querySelector('.loader')?.classList.remove('active');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);