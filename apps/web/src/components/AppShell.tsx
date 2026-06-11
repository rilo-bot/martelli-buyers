import { Navbar } from './Navbar';
import { Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
