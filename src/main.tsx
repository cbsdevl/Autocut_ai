import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AuthGuard } from './components/auth/AuthGuard.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGuard>
        <App />
      </AuthGuard>
    </AuthProvider>
  </StrictMode>,
);
