import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import AuctionDetail from './pages/AuctionDetail';
import SellerConsole from './pages/SellerConsole';
import { AlertTriangle, Home as HomeIcon } from 'lucide-react';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auction/:id" element={<AuctionDetail />} />
          <Route path="/seller" element={<SellerConsole />} />
          
          <Route path="*" element={
            <div className="container py-16">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <AlertTriangle className="h-8 w-8 text-slate-600" />
                </div>
                <h1 className="mt-4 text-2xl font-bold text-slate-900">
                  Page Not Found
                </h1>
                <p className="mt-2 text-slate-600">
                  The page you're looking for doesn't exist.
                </p>
                <a 
                  href="/" 
                  className="mt-6 btn btn-primary btn-md inline-flex items-center"
                >
                  <HomeIcon className="h-4 w-4 mr-2" />
                  Go back to Home
                </a>
              </div>
            </div>
          } />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
