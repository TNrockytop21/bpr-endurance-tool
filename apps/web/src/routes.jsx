import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SingleDriverPage } from './pages/SingleDriverPage';
import { FuelPage } from './pages/FuelPage';
import { StintCalendarPage } from './pages/StintCalendarPage';
import { StandingsPage } from './pages/StandingsPage';
import { LivePage } from './pages/LivePage';
import { DriverDetailPage } from './pages/DriverDetailPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { CoachingPage } from './pages/CoachingPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <SingleDriverPage /> },
      { path: 'fuel', element: <FuelPage /> },
      { path: 'stints', element: <StintCalendarPage /> },
      { path: 'standings', element: <StandingsPage /> },
      { path: 'grid', element: <LivePage /> },
      { path: 'driver/:driverId', element: <DriverDetailPage /> },
      { path: 'compare', element: <ComparisonPage /> },
      { path: 'coaching', element: <CoachingPage /> },
    ],
  },
]);
