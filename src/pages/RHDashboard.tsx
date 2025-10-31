import { useEffect, useState, useCallback } from 'react';
import type { Offer, User } from '../types';
import OffersSection from '../components/dashboard/OffersSection';
import ApplicationsSummary from '../components/dashboard/ApplicationsSummary';
import DepartmentProjectManagement from '../components/dashboard/DepartmentProjectManagement';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import Swal from 'sweetalert2';

const RHDashboard = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeTab, setActiveTab] = useState<'offers' | 'applications' | 'management'>('offers');
  const [error, setError] = useState('');
  const { t } = useI18n();
  
  // Get user from localStorage to determine role
  const getUser = (): User | null => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return null;
    }
  };
  
  const user = getUser();

  // Set default tab based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'comite_ouverture') {
        setActiveTab('applications');
      } else if (user.role === 'comite_ajout') {
        setActiveTab('offers');
      }
    }
  }, [user]);

  // Get available tabs based on user role
  const getAvailableTabs = () => {
    if (!user) return [];
    
    const tabs = [];
    if (user.role === 'comite_ajout') {
      tabs.push('offers', 'management');
    } else if (user.role === 'comite_ouverture') {
      tabs.push('applications');
    }
    return tabs;
  };

  const availableTabs = getAvailableTabs();

  const fetchOffers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/offers/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setOffers(data);
    } catch {
      setError(t('rh.error.fetchOffers'));
    }
  }, [t]);

  useEffect(() => {
    const load = async () => {
      await fetchOffers();
    };
    load();
  }, [fetchOffers]);
  
  const handleSaveOffer = async (data: Offer) => {
    const token = localStorage.getItem('token');
    const url = data.id ? `${API_BASE_URL}/offers/${data.id}` : `${API_BASE_URL}/offers`;
    const method = data.id ? 'PUT' : 'POST';
    const formDataToSend = new FormData();
    
    // Convert Offer data to FormData
    Object.keys(data).forEach(key => {
      const value = data[key as keyof Offer];
      if (value !== null && value !== undefined) {
        if (key === 'notification_emails' && typeof value === 'string') {
          formDataToSend.append(key, value);
        } else if (typeof value === 'string') {
          formDataToSend.append(key, value);
        } else if (typeof value === 'number') {
          formDataToSend.append(key, value.toString());
        }
      }
    });
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataToSend,
      });
      
      if (res.ok) {
        await fetchOffers();
      } else {
        setError(t('rh.error.saveOffer'));
      }
    } catch {
      setError(t('rh.error.saveOffer'));
    }
  };
  
  const handleDeleteOffer = async (id: number) => {
    const result = await Swal.fire({
      title: t('rh.confirm.deleteOffer'),
      text: t('rh.confirm.deleteOfferText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('rh.confirm.deleteOffer'),
      cancelButtonText: t('rh.swal.archiveCancel')
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/offers/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          await fetchOffers();
        } else {
          setError(t('rh.error.deleteOffer'));
        }
      } catch {
        setError(t('rh.error.deleteOffer'));
      }
    }
  };

  const handleArchiveOffer = async (offerId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/applications/archive/${offerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Download the archive file
        const downloadRes = await fetch(`${API_BASE_URL}/applications/archive/${result.archiveFile}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (downloadRes.ok) {
          const blob = await downloadRes.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = result.archiveFile;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        }
        
        // Show detailed success message
        let message = result.message;
        if (result.newlyArchivedCount > 0) {
          message += `\n\n${result.newlyArchivedCount} new applications were marked as archived.`;
        }
        
        if (result.allowReArchive) {
          message += '\n\nYou can archive again if new applications are submitted.';
        } else {
          message += '\n\nAll applications have been archived. You can still create new archives if needed.';
        }
        
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: message,
          confirmButtonText: t('rh.swal.great')
        });
        
        // Refresh offers to update status
        await fetchOffers();
      } else {
        const error = await response.json();
        await Swal.fire({
          icon: 'error',
          title: t('rh.swal.archiveFailedTitle'),
          text: t('rh.swal.generalError').replace('{error}', error.error),
          confirmButtonText: t('rh.swal.ok')
        });
      }
    } catch (err) {
      console.error('Archive error:', err);
        await Swal.fire({
          icon: 'error',
          title: t('rh.swal.archiveFailedTitle'),
          text: t('rh.swal.archiveError'),
          confirmButtonText: t('rh.swal.ok')
        });
    }
  };
  
  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile Tab Selector */}
        <div className="sm:hidden mb-6">
          <select 
            value={activeTab} 
            onChange={e => setActiveTab(e.target.value as 'offers' | 'applications' | 'management')} 
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 font-medium"
          >
            {availableTabs.includes('offers') && (
              <option value="offers">{t('rh.tabs.offers')}</option>
            )}
            {availableTabs.includes('applications') && (
              <option value="applications">{t('rh.tabs.applications')}</option>
            )}
            {availableTabs.includes('management') && (
              <option value="management">{t('rh.management.title')}</option>
            )}
          </select>
        </div>
        
        {/* Desktop Tabs */}
        <div className="hidden sm:flex mb-8">
          <nav className="flex space-x-8 border-b border-gray-200 w-full">
            {availableTabs.includes('offers') && (
              <button 
                onClick={() => setActiveTab('offers')} 
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'offers' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                  </svg>
                  <span>{t('rh.tabs.offers')}</span>
                  <span className="bg-gray-200 text-gray-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {offers.length}
                  </span>
                </div>
              </button>
            )}
            {availableTabs.includes('applications') && (
              <button 
                onClick={() => setActiveTab('applications')} 
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'applications' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>{t('rh.tabs.applications')}</span>
                </div>
              </button>
            )}
            {availableTabs.includes('management') && (
              <button 
                onClick={() => setActiveTab('management')} 
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'management' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{t('rh.management.title')}</span>
                </div>
              </button>
            )}
          </nav>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}
        
        {/* Tab Content */}
        {activeTab === 'offers' && (
          <OffersSection
            offers={offers}
            onSaveOffer={handleSaveOffer}
            onDeleteOffer={handleDeleteOffer}
            onArchiveOffer={handleArchiveOffer}
          />
        )}
        
        {activeTab === 'applications' && (
          <ApplicationsSummary showAllOffers={user?.role === 'comite_ouverture'} />
        )}
        
        {activeTab === 'management' && (
          <DepartmentProjectManagement />
        )}
      </div>
    </div>
  );
};

export default RHDashboard;
