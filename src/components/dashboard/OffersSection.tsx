import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Offer } from '../../types';
import { getOfferTypeInfo } from '../../utils/offerType';
import { useI18n } from '../../i18n';
import { API_BASE_URL } from '../../config';
import Swal from 'sweetalert2';

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

interface OffersSectionProps {
  offers: Offer[];
  onSaveOffer: (data: Offer) => Promise<void>;
  onDeleteOffer: (id: number) => Promise<void>;
  onArchiveOffer?: (id: number) => Promise<void>;
}

const OffersSection = ({ offers, onSaveOffer, onDeleteOffer, onArchiveOffer }: OffersSectionProps) => {
  const langNavigate = useLanguageNavigate();
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    country: '',
    department: '',
    status: 'actif'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [settingCandidate, setSettingCandidate] = useState<number | null>(null);

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                         offer.description.toLowerCase().includes(filters.search.toLowerCase());
    const matchesType = filters.type ? offer.type === filters.type : true;
    const matchesCountry = filters.country ? offer.country === filters.country : true;
    const matchesDepartment = filters.department ? offer.department_name === filters.department : true;
    
    // Handle status filtering
    let matchesStatus = true;
    if (filters.status === 'actif') {
      matchesStatus = offer.status === 'actif';
    } else if (filters.status === 'cloture') {
      matchesStatus = offer.status === 'sous_evaluation' || offer.status === 'resultat';
    }
    
    return matchesSearch && matchesType && matchesCountry && matchesDepartment && matchesStatus;
  });

  const uniqueTypes = Array.from(new Set(offers.map(offer => offer.type)));
  const uniqueCountries = Array.from(new Set(offers.map(offer => offer.country)));
  const uniqueDepartments = Array.from(new Set(offers.map(offer => offer.department_name)));

  const statusOptions = [
    { value: 'actif', label: t('rh.status.actif') },
    { value: 'cloture', label: t('rh.status.cloture') }
  ];

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      country: '',
      department: '',
      status: 'actif'
    });
  };

  const handleCreateOffer = () => {
    langNavigate('/create-offer');
  };

  const handleEditOffer = (offer: Offer) => {
    langNavigate(`/edit-offer/${offer.id}`);
  };

  const handleSetCandidate = async (offerId: number, offerTitle: string) => {
    const { value: candidateName } = await Swal.fire({
      title: t('rh.candidateModal.title'),
      text: t('rh.candidateModal.subtitle'),
      input: 'text',
      inputLabel: t('rh.candidateModal.nameLabel'),
      inputPlaceholder: t('rh.candidateModal.namePlaceholder'),
      showCancelButton: true,
      confirmButtonText: t('rh.candidateModal.submit'),
      cancelButtonText: t('rh.candidateModal.cancel'),
      inputValidator: (value) => {
        if (!value) {
          return t('rh.swal.pleaseEnterCandidateName');
        }
        return null;
      }
    });

    if (!candidateName || !candidateName.trim()) {
      return;
    }

    setSettingCandidate(offerId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/set-candidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ candidate_name: candidateName.trim() })
      });

      if (response.ok) {
        const result = await response.json();
        await Swal.fire({
          icon: 'success',
          title: t('rh.swal.selectionCompleteTitle'),
          text: `${t('rh.candidateModal.success')}: ${candidateName}`,
          confirmButtonText: t('rh.swal.great')
        });
        // Refresh the offers list to show the updated status
        window.location.reload();
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: t('rh.swal.selectionFailedTitle'),
          text: `${t('rh.candidateModal.error')}: ${errorData.error}`,
          confirmButtonText: t('rh.swal.ok')
        });
      }
    } catch (error) {
      console.error('Error setting candidate:', error);
      await Swal.fire({
        icon: 'error',
        title: t('rh.swal.selectionFailedTitle'),
        text: t('rh.candidateModal.error'),
        confirmButtonText: t('rh.swal.ok')
      });
    } finally {
      setSettingCandidate(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('rh.manage.title')}</h2>
          <p className="text-gray-600 mt-1">{t('rh.manage.subtitle')}</p>
        </div>
        <button
          onClick={handleCreateOffer}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('rh.createNew')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">{t('rh.filter.offers')}</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {showFilters ? t('rh.toggle.hide') : t('rh.toggle.show')}
          </button>
        </div>

        {showFilters && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.search')}</label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    name="search"
                    placeholder={t('rh.search.offers.placeholder')}
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
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.type')}</label>
                <select
                  id="type"
                  name="type"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.type}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allTypes')}</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>
                      {getOfferTypeInfo(type).name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.country')}</label>
                <select
                  id="country"
                  name="country"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.country}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allCountries')}</option>
                  {uniqueCountries.map(country => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.department')}</label>
                <select
                  id="department"
                  name="department"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allDepartments')}</option>
                  {uniqueDepartments.map(department => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.status')}</label>
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

            <button
              onClick={clearFilters}
              className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('rh.clearAll')}
            </button>
          </>
        )}
      </div>

      {/* Offers Grid */}
      {filteredOffers.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('rh.noOffers.title')}</h3>
          <p className="text-gray-600 mb-6">{t('rh.noOffers.subtitle')}</p>
          <button
            onClick={handleCreateOffer}
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('rh.createNew')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map(offer => {
            const deadlineDate = new Date(offer.deadline);
            const today = new Date();
            const isActif = offer.status === 'actif';
            const isSousEvaluation = offer.status === 'sous_evaluation';
            const isResultat = offer.status === 'resultat';
            const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={offer.id} className={`bg-white rounded-xl shadow-lg border overflow-hidden hover:shadow-xl transition-shadow ${
                isActif ? 'border-green-200' : isSousEvaluation ? 'border-yellow-200' : 'border-purple-200'
              }`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getOfferTypeInfo(offer.type).color
                      }`}>
                        {getOfferTypeInfo(offer.type).name}
                      </span>
                      
                      {/* Status badges */}
                      {!isActif && (
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isSousEvaluation ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isSousEvaluation ? t('rh.status.sousEvaluation') : t('rh.status.resultat')}
                        </span>
                      )}
                      
                      <h3 className="text-lg font-semibold text-gray-900 mt-2 line-clamp-2">{offer.title}</h3>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEditOffer(offer)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('rh.table.edit')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      {/* Archive button for expired offers */}
                      {!isActif && onArchiveOffer && offer.can_archive && (
                        <button
                          onClick={() => onArchiveOffer(offer.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title={t('rh.archiveApplications')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Select Candidate button for sous_evaluation offers (when no candidate selected yet) */}
                      {isSousEvaluation && !isResultat && (
                        <button
                          onClick={() => handleSetCandidate(offer.id, offer.title)}
                          disabled={settingCandidate === offer.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t('rh.selectCandidate')}
                        >
                          {settingCandidate === offer.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => onDeleteOffer(offer.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('rh.table.delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{offer.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {offer.country}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {offer.department_name}
                    </div>
                    <div className={`flex items-center ${
                      isActif ? (daysLeft <= 7 ? 'text-yellow-600' : 'text-green-600') : 
                              isSousEvaluation ? 'text-yellow-600' : 'text-purple-600'
                    }`}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {isActif ? `${t('offer.closes')} ${deadlineDate.toLocaleDateString()}` : 
                       isSousEvaluation ? t('rh.status.sousEvaluation') : 
                       t('rh.status.resultat')}
                    </div>
                    
                    {/* Show selected candidate if status is resultat */}
                    {isResultat && offer.winner_name && (
                      <div className="flex items-center text-purple-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('rh.candidateDisplay.label')} {offer.winner_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OffersSection;