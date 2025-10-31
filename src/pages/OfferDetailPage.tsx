import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Offer } from '../types';
import ApplicationForm from '../components/ApplicationForm';
import FAQModal from '../components/FAQModal';
import { getOfferTypeInfo } from '../utils/offerType';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import { showAlert } from '../utils/sweetalertConfig';

// Translation cache to avoid repeated API calls
const translationCache = new Map<string, string>();

// Free translation API function using ftapi.pythonanywhere.com
const translateText = async (text: string): Promise<string> => {
  if (!text || text.trim() === '') return text;
  
  // Check cache first
  const cacheKey = `fr-en:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    // Using CORS proxy + ftapi
    const apiUrl = `https://ftapi.pythonanywhere.com/translate?sl=fr&dl=en&text=${encodeURIComponent(text)}`;
    const response = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`
    );

    if (!response.ok) {
      throw new Error('Translation API request failed');
    }

    const data = await response.json();
    
    if (data['destination-text']) {
      const translatedText = data['destination-text'];
      
      // Cache the translation
      translationCache.set(cacheKey, translatedText);
      
      return translatedText;
    } else {
      throw new Error('Translation failed');
    }
  } catch (error) {
    console.error('Translation failed for:', text, error);
    return text; // Return original text if translation fails
  }
};

// Function to translate an offer with API calls
const translateOfferAsync = async (offer: Offer): Promise<Offer> => {
  try {
    const [translatedTitle, translatedDescription, translatedCountry, translatedDepartment] = await Promise.all([
      translateText(offer.title),
      translateText(offer.description),
      translateText(offer.country),
      translateText(offer.department_name || ''),
    ]);

    return {
      ...offer,
      title: translatedTitle,
      description: translatedDescription,
      country: translatedCountry,
      department_name: translatedDepartment,
    };
  } catch (error) {
    console.error('Failed to translate offer:', error);
    return offer; // Return original offer if translation fails
  }
};

// Function to format time remaining
const formatTimeRemaining = (milliseconds: number, t: (key: string) => string): string => {
  if (milliseconds <= 0) return t('offer.countdown.expired');
  
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  
  if (days > 0) {
    return `${days} ${t('offer.countdown.days')} ${hours} ${t('offer.countdown.hours')} ${minutes} ${t('offer.countdown.minutes')}`;
  } else if (hours > 0) {
    return `${hours} ${t('offer.countdown.hours')} ${minutes} ${t('offer.countdown.minutes')} ${seconds} ${t('offer.countdown.seconds')}`;
  } else if (minutes > 0) {
    return `${minutes} ${t('offer.countdown.minutes')} ${seconds} ${t('offer.countdown.seconds')}`;
  } else {
    return `${seconds} ${t('offer.countdown.seconds')}`;
  }
};

const OfferDetailPage = () => {
  const { t, currentLangPrefix, lang } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [translatedOffer, setTranslatedOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Real-time deadline checker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Check if deadline has passed
  useEffect(() => {
    const checkDeadline = async () => {
      if (offer) {
        const deadline = new Date(offer.deadline);
        const now = currentTime;
        const justExpired = now >= deadline && !isDeadlinePassed;
        
        setIsDeadlinePassed(now >= deadline);
        
        // If deadline just passed, update backend status immediately
        if (justExpired) {
          try {
            await fetch(`${API_BASE_URL}/offers/${offer.id}/update-expired-status`, {
              method: 'POST',
            });
            console.log('Backend status updated immediately after deadline');
          } catch (error) {
            console.error('Failed to update backend status:', error);
          }
        }
        
        // Close application form if deadline passes while it's open
        if (now >= deadline && showApplicationForm) {
          setShowApplicationForm(false);
          showAlert.warning(t('form.error.deadlinePassed'));
        }
      }
    };
    
    checkDeadline();
  }, [offer, currentTime, showApplicationForm, t, isDeadlinePassed]);
  
  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/offers/${id}`);
        if (response.ok) {
          const data = await response.json();
          setOffer(data);
        } else {
          console.error('Failed to fetch offer');
        }
      } catch (err) {
        console.error('Error fetching offer:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchOffer();
    }
  }, [id]);

  // Effect to handle translation when language changes
  useEffect(() => {
    const handleTranslation = async () => {
      if (offer && lang === 'en') {
        setIsTranslating(true);
        try {
          const translated = await translateOfferAsync(offer);
          setTranslatedOffer(translated);
        } catch (error) {
          console.error('Translation failed:', error);
          setTranslatedOffer(offer); // Fallback to original offer
        } finally {
          setIsTranslating(false);
        }
      } else if (offer) {
        // If French, use original offer
        setTranslatedOffer(offer);
      }
    };

    handleTranslation();
  }, [offer, lang]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
      </div>
    );
  }
  
  if (!offer) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('detail.notFound.title')}</h2>
          <p className="text-gray-600 mb-6">{t('detail.notFound.text')}</p>
          <Link
            to={currentLangPrefix || '/'}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            {t('detail.backToHome')}
          </Link>
        </div>
      </div>
    );
  }

  const displayOffer = translatedOffer || offer;
  const deadlineDate = new Date(displayOffer.deadline);
  const isExpired = isDeadlinePassed; // Use real-time deadline check
  const offerTypeInfo = getOfferTypeInfo(displayOffer.type);
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link
            to={currentLangPrefix || '/'}
            className="inline-flex items-center text-green-600 hover:text-green-800"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('detail.backToOpps')}
          </Link>
        </div>

        {isTranslating ? (
          <div className="flex justify-center items-center py-32">
            <div className="animate-spin h-16 w-16 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap gap-3 mb-4">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${offerTypeInfo.color}`}>
                  {offerTypeInfo.name}
                </span>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {isExpired ? t('offer.expired') : `${t('offer.closes')} ${deadlineDate.toLocaleDateString()} at ${deadlineDate.toLocaleTimeString()}`}
                </span>
                {!isExpired && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                    {t('offer.countdown.expiresIn')}: {formatTimeRemaining(deadlineDate.getTime() - currentTime.getTime(), t)}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{displayOffer.title}</h1>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('detail.details')}</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('label.reference')}</p>
                      <p className="font-medium text-gray-900">{displayOffer.reference}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('label.country')}</p>
                      <p className="font-medium text-gray-900">{displayOffer.country}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('label.department')}</p>
                      <p className="font-medium text-gray-900">{displayOffer.department_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('label.deadline')}</p>
                      <p className="font-medium text-gray-900">{deadlineDate.toLocaleDateString()} at {deadlineDate.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('label.description')}</h3>
                  <div className="bg-gray-50 rounded-lg p-4 h-full">
                    <p className="text-gray-700 whitespace-pre-line">{displayOffer.description}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('label.project')} Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 w-72">
                  <p className="text-gray-700 whitespace-pre-line">{displayOffer.project_name}</p>
                </div>
              </div>
              
              {/* Selected Candidate Information - Show only if status is 'resultat' and winner_name exists */}
              {displayOffer.status === 'resultat' && displayOffer.winner_name && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('rh.candidateDisplay.title')}</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-800 font-medium">{t('rh.candidateDisplay.label')}</p>
                    </div>
                    <p className="text-green-700 mt-2">{t('rh.candidateInfo').replace('{candidate}', displayOffer.winner_name || '')}</p>
                  </div>
                </div>
              )}
              
              {displayOffer.tdr_url && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('label.documents')}</h3>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const response = await fetch(`${API_BASE_URL}${displayOffer.tdr_url}`);
                        if (!response.ok) throw new Error('fetch_fail');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `TDR_${displayOffer.title}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        showAlert.error(t('offer.downloadTdr.error'));
                        console.error(err);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('offer.downloadTdr')}
                  </button>
                </div>
              )}
              
              <div className="flex flex-wrap gap-4">
                <Link
                  to={currentLangPrefix || '/'}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  {t('detail.backToOpps')}
                </Link>
                
                {/* FAQ Button - Always show */}
                <button
                  onClick={() => setShowFAQModal(true)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  {t('faq.button')}
                </button>
                
                {/* Show apply button only if no candidate has been selected (status is not 'resultat') */}
                {displayOffer.status !== 'resultat' && (
                  <button
                    onClick={() => setShowApplicationForm(true)}
                    className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    {t('apply.button')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showApplicationForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={() => setShowApplicationForm(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{t('apply.submit.title')}</h3>
                  </div>
                  <button
                    onClick={() => setShowApplicationForm(false)}
                    className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <ApplicationForm 
                  offerId={parseInt(id!)} 
                  offerType={offer.type} 
                  onClose={() => setShowApplicationForm(false)} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* FAQ Modal */}
      {showFAQModal && offer && (
        <FAQModal
          offerId={offer.id}
          isOpen={showFAQModal}
          onClose={() => setShowFAQModal(false)}
        />
      )}
    </div>
  );
};

export default OfferDetailPage;