import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Offer } from '../types';
import OfferForm from '../components/forms/OfferForm';
import { useI18n } from '../i18n';

// Language-aware navigation hook
const useLanguageNavigate = () => {
  const navigate = useNavigate();
  const { currentLangPrefix } = useI18n();
  
  return (path: string, options?: any) => {
    const isAbsolute = path.startsWith('http');
    const languagePath = isAbsolute ? path : `${currentLangPrefix}${path === '/' ? '' : path}`;
    navigate(languagePath, options);
  };
};

const OfferCreationPage = () => {
  const langNavigate = useLanguageNavigate();
  const [error, setError] = useState('');
  const { t } = useI18n();

  const handleSaveOffer = async (data: Offer) => {
    // Navigate back to the comite ajout dashboard
    langNavigate('/comite-ajout-dashboard');
  };

  const handleCancel = () => {
    // Navigate back to the comite ajout dashboard
    langNavigate('/comite-ajout-dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('rh.offer.createTitle')}</h1>
              <p className="text-gray-600 mt-2">{t('rh.offer.createSubtitle')}</p>
            </div>
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('rh.offer.backToDashboard')}
            </button>
          </div>
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

        {/* Form Container */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <OfferForm
            onSave={handleSaveOffer}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
};

export default OfferCreationPage;