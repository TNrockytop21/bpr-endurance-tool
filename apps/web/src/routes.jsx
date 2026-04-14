import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { BroadcastDashboard } from './pages/BroadcastDashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <BroadcastDashboard /> },
    ],
  },
]);
