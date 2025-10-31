import { useState, useEffect } from 'react';
import OfferCard from '../components/OfferCard';
import type { Offer } from '../types';
import { getOfferTypeInfo } from '../utils/offerType';
import { useI18n } from '../i18n';

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

const HomePage = ({ offers }: { offers: Offer[] }) => {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    locationType: '',
    status: 'actif' // Changed back to 'actif' as default
  });
  
  const [translatedOffers, setTranslatedOffers] = useState<Offer[]>(offers);
  const [isTranslating, setIsTranslating] = useState(false);
  
  useEffect(() => {
  window.scrollTo(0, 0);
}, []);

  // Effect to handle translation when language changes
  useEffect(() => {
    const handleTranslation = async () => {
      if (lang === 'en') {
        setIsTranslating(true);
        try {
          // Translate all offers in parallel with a small delay to avoid rate limiting
          const translated = await Promise.all(
            offers.map((offer, index) => 
              new Promise<Offer>(resolve => 
                setTimeout(() => translateOfferAsync(offer).then(resolve), index * 100)
              )
            )
          );
          setTranslatedOffers(translated);
        } catch (error) {
          console.error('Translation failed:', error);
          setTranslatedOffers(offers); // Fallback to original offers
        } finally {
          setIsTranslating(false);
        }
      } else {
        // If French, use original offers
        setTranslatedOffers(offers);
      }
    };

    handleTranslation();
  }, [offers, lang]);
  
  const uniqueCategories = Array.from(new Set(translatedOffers.map(offer => offer.type)));
  const uniqueLocationTypes = Array.from(new Set(translatedOffers.map(offer => offer.country === 'Tunisia' ? 'National' : 'International')));
  
  const statusOptions = [
    { value: 'actif', label: t('filters.status.actif') },
    { value: 'sous_evaluation', label: t('filters.status.sousEvaluation') },
    { value: 'resultat', label: t('filters.status.resultat') }
  ];
  
  const filteredOffers = translatedOffers.filter(offer => {
    const matchesSearch = offer.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                         offer.description.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCategory = filters.category ? offer.type === filters.category : true;
    const matchesLocationType = filters.locationType ? 
      (filters.locationType === 'National' ? offer.country === 'Tunisia' : offer.country !== 'Tunisia') : true;
    const matchesStatus = filters.status ? offer.status === filters.status : true;
    
    return matchesSearch && matchesCategory && matchesLocationType && matchesStatus;
  });
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      locationType: '',
      status: 'actif' // Changed back to 'actif'
    });
  };
  
  return (
   <div className="bg-gradient-to-b from-green-50 to-blue-50">
    
      
      <div id="opportunities" className="py-20 bg-gradient-to-b from-green-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
              {t('home.section.title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{t('home.section.subtitle')}</p>
            <div className="w-24 h-1 bg-gradient-to-r from-green-500 to-blue-500 mx-auto rounded-full mt-6"></div>
          </div>

          {isTranslating ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin h-16 w-16 border-4 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">{t('filters.title')}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">{t('filters.search')}</label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    name="search"
                    placeholder={t('filters.search.placeholder')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={filters.search}
                    onChange={handleFilterChange}
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  id="category"
                  name="category"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>
                      {getOfferTypeInfo(category).name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="locationType" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  id="locationType"
                  name="locationType"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.locationType}
                  onChange={handleFilterChange}
                >
                  <option value="">All Types</option>
                  {uniqueLocationTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">{t('filters.status')}</label>
                <select
                  id="status"
                  name="status"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.search && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {t('filters.search')}: {filters.search}
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                    className="ml-2 text-blue-600 hover:text-blue-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  Category: {getOfferTypeInfo(filters.category).name}
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, category: '' }))}
                    className="ml-2 text-purple-600 hover:text-purple-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.locationType && (
                <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Type: {filters.locationType}
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, locationType: '' }))}
                    className="ml-2 text-green-600 hover:text-green-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  {t('filters.status')}: {statusOptions.find(opt => opt.value === filters.status)?.label}
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
                    className="ml-2 text-indigo-600 hover:text-indigo-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
            
            {(filters.search || filters.category || filters.locationType || filters.status !== '') && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear All Filters
              </button>
            )}
          </div>
          
          <div className="mb-6 text-gray-600">
            Showing <span className="font-semibold">{filteredOffers.length}</span> of <span className="font-semibold">{offers.length}</span> opportunities
            {filters.status && (
              <span> (Status: {statusOptions.find(opt => opt.value === filters.status)?.label})</span>
            )}
          </div>
          
          {filteredOffers.length === 0 ? (
            <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-green-100">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No opportunities match your filters</h3>
              <p className="text-gray-600 mb-6">Try adjusting your filter criteria or check back later for new opportunities</p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-medium rounded-lg hover:from-green-700 hover:to-green-800 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredOffers.map(offer => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
            </>
          )}
        </div>
      </div>
      
      
    </div>
  );
};

export default HomePage;