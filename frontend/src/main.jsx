import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {
  ToastContainer
} from "react-toastify";

import "react-toastify/dist/ReactToastify.css";

import {
  ThemeProvider
} from "./context/ThemeContext";
import {
  StockProvider
} from "./context/StockContext";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <StockProvider>
        <App />
      </StockProvider>
    </ThemeProvider>
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      closeOnClick
      pauseOnHover
    />
  </StrictMode>,
)
