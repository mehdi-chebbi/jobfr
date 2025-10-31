import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { showAlert } from '../../utils/sweetalertConfig';
import { getOfferTypeInfo } from '../../utils/offerType';
import { API_BASE_URL } from '../../config';
import { useI18n } from '../../i18n';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'comite_ajout' | 'comite_ouverture' | 'rh';
}

interface ApplicationsSummaryProps {
  showAllOffers?: boolean;
}

interface OfferSummary {
  offer_id: number;
  offer_title: string;
  offer_type: string;
  offer_department: string;
  offer_project?: string;
  deadline: string;
  application_count: number;
  offer_status: 'expired' | 'active';
  archive_window_status: 'archive_window_open' | 'archive_window_closed' | 'active';
  hours_since_expiry: number;
  status?: 'actif' | 'sous_evaluation' | 'resultat';
  winner_name?: string | null;
}

const ApplicationsSummary = ({ showAllOffers = false }: ApplicationsSummaryProps) => {
  const [offerSummaries, setOfferSummaries] = useState<OfferSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState<number | null>(null);
  const [settingCandidate, setSettingCandidate] = useState<number | null>(null);
  const { t, currentLangPrefix } = useI18n();
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    department: '',
    status: ''
  });
  const [showFilters, setShowFilters] = useState(false);

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
  const isComiteOuverture = user?.role === 'comite_ouverture';

  useEffect(() => {
    fetchOfferSummaries();
  }, []);

  const fetchOfferSummaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/applications/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setOfferSummaries(data);
      } else {
        setError(t('rh.error.fetchApplicationSummary'));
      }
    } catch {
      setError(t('rh.error.fetchApplicationSummary'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSummaries = offerSummaries.filter(summary => {
    const matchesSearch = filters.search === '' || 
      summary.offer_title.toLowerCase().includes(filters.search.toLowerCase());
    const matchesType = filters.type === '' || summary.offer_type === filters.type;
    const matchesDepartment = filters.department === '' || summary.offer_department === filters.department;
    const matchesStatus = filters.status === '' || summary.offer_status === filters.status;
    
    // If showAllOffers is true (for comite_ouverture), show all offers regardless of archive status
    // Otherwise, only show offers with applications and within archive window (for comite_ajout)
    const showBasedOnArchiveStatus = showAllOffers || 
      (summary.application_count > 0 && summary.archive_window_status !== 'archive_window_closed');
    
    return matchesSearch && matchesType && matchesDepartment && matchesStatus && showBasedOnArchiveStatus;
  });

  const uniqueTypes = Array.from(new Set(offerSummaries.map(summary => summary.offer_type)));
  const uniqueDepartments = Array.from(new Set(offerSummaries.map(summary => summary.offer_department)));

  const statusOptions = [
    { value: 'active', label: t('rh.status.actif') },
    { value: 'expired', label: t('offer.expired') }
  ];

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      department: '',
      status: ''
    });
  };

  const handleArchive = async (offerId: number, offerTitle: string) => {
    const result = await showAlert.confirm(
      t('rh.swal.archiveTitle'),
      t('rh.swal.archiveConfirmation').replace('{offerTitle}', offerTitle),
      t('rh.swal.archiveConfirm'),
      t('rh.swal.archiveCancel')
    );

    if (!result.isConfirmed) {
      return;
    }

    setArchiving(offerId);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/applications/archive/${offerId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        
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
        
        // Refresh the summaries
        await fetchOfferSummaries();
        
        // Show detailed success message
        let message = t('rh.success.archivedApplications')
          .replace('{count}', result.applicationsCount.toString())
          .replace('{offerTitle}', offerTitle);
        
        if (result.newlyArchivedCount > 0) {
          message += `\n\n${result.newlyArchivedCount} new applications were marked as archived.`;
        }
        
        if (result.allowReArchive) {
          message += '\n\nYou can archive again if new applications are submitted.';
        } else {
          message += '\n\nAll applications have been archived. You can still create new archives if needed.';
        }
        
        await showAlert.success(t('rh.swal.archiveCompleteTitle'), message.replace(/\n/g, '<br>'));
      } else {
        const errorData = await res.json();
        await showAlert.error(t('rh.swal.archiveFailedTitle'), `${t('rh.error.archiveApplications')}: ${errorData.error}`);
      }
    } catch {
      console.error('Archive error');
      await showAlert.error(t('rh.swal.archiveFailedTitle'), t('rh.error.archiveApplications'));
    } finally {
      setArchiving(null);
    }
  };

  const handleSetCandidate = async (offerId: number, offerTitle: string) => {
    const { value: candidateName } = await showAlert.input(
      t('rh.candidateModal.title'),
      t('rh.candidateModal.namePlaceholder')
    );

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
        await showAlert.success(t('rh.swal.selectionCompleteTitle'), t('rh.swal.selectionCompleteText')
            .replace('{successMessage}', t('rh.candidateModal.success'))
            .replace('{candidate}', candidateName)
            .replace('{offerTitle}', offerTitle));
        // Refresh the summaries to show the updated status
        await fetchOfferSummaries();
      } else {
        const errorData = await response.json();
        await showAlert.error(t('rh.swal.selectionFailedTitle'), `${t('rh.candidateModal.error')}: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error setting candidate:', error);
      await showAlert.error(t('rh.swal.selectionFailedTitle'), t('rh.candidateModal.error'));
    } finally {
      setSettingCandidate(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('rh.tabs.applications')}</h2>
          <p className="text-gray-600 mt-1">{t('rh.applications.subtitle')}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            {t('rh.statistics.totalOffers')} {offerSummaries.length}
          </div>
          <div className="text-sm text-gray-600">
            {t('rh.statistics.activeOffers')} {offerSummaries.filter(s => s.offer_status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">
            {t('rh.statistics.expiredOffers')} {offerSummaries.filter(s => s.offer_status === 'expired').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">{t('rh.filterApplications')}</h3>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.searchLabel')}</label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    name="search"
                    placeholder={t('rh.searchOffersPlaceholder')}
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
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.offerTypeLabel')}</label>
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
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.departmentLabel')}</label>
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
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.statusLabel')}</label>
                <select
                  id="status"
                  name="status"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allStatuses')}</option>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('rh.clearAllFilters')}
            </button>
          </>
        )}
      </div>

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

      {filteredSummaries.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('rh.noApplicationsFound')}</h3>
          <p className="text-gray-600">{t('rh.noApplicationsDescription')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSummaries.map((summary) => {
            const deadlineDate = new Date(summary.deadline);
            // Use the status from backend instead of calculating locally
            const isExpired = summary.offer_status === 'expired';
            const daysLeft = Math.ceil((deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={summary.offer_id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getOfferTypeInfo(summary.offer_type).color
                      }`}>
                        {getOfferTypeInfo(summary.offer_type).name}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 mt-2 line-clamp-2">{summary.offer_title}</h3>
                    </div>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {isExpired ? t('offer.expired') : t('rh.status.actif')}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('rh.departmentLabel')}</span>
                      <span className="text-sm font-medium text-gray-900">{summary.offer_department}</span>
                    </div>
                    
                    {summary.offer_project && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{t('rh.projectLabel')}</span>
                        <span className="text-sm font-medium text-gray-900">{summary.offer_project}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('rh.applicationsLabel')}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {summary.application_count} candidats{summary.application_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className={`flex items-center justify-between ${
                      isExpired ? 'text-red-600' : daysLeft <= 7 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      <span className="text-sm">{t('rh.deadlineLabel')}</span>
                      <span className="text-sm font-medium">
                        {isExpired ? t('offer.expired') : `${daysLeft} ${t('rh.daysLeft')}`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Comité d'Ouverture Action Buttons - Always show all 3 buttons */}
                  {isComiteOuverture && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      
                      {/* 1. Answer Questions Button */}
                      <div>
                        <Link
                          to={`${currentLangPrefix}/answer-questions/${summary.offer_id}`}
                          className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            summary.offer_status === 'active' && summary.status === 'actif'
                              ? 'bg-teal-600 text-white hover:bg-teal-700'
                              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          }`}
                          onClick={(e) => {
                            if (summary.offer_status !== 'active' || summary.status !== 'actif') {
                              e.preventDefault();
                            }
                          }}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {t('answerQuestions.button')}
                        </Link>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          {summary.offer_status === 'active' && summary.status === 'actif' 
                            ? t('rh.button.answerQuestions') 
                            : summary.offer_status === 'expired' 
                              ? t('rh.button.offerExpired') 
                              : t('rh.button.questionsNotAvailable')
                          }
                        </p>
                      </div>

                      {/* 2. Archive Button */}
                      <div>
                        <button
                          onClick={() => handleArchive(summary.offer_id, summary.offer_title)}
                          disabled={archiving === summary.offer_id || summary.archive_window_status === 'archive_window_closed' || summary.offer_status === 'active'}
                          className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            summary.archive_window_status === 'archive_window_closed' || summary.offer_status === 'active'
                              ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}
                        >
                          {archiving === summary.offer_id ? (
                            <>
                              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {t('rh.button.archiving')}
                            </>
                          ) : summary.archive_window_status === 'archive_window_closed' ? (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('rh.button.archiveClosed')}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                              {t('rh.archiveApplications')}
                            </>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          {summary.offer_status === 'active'
                            ? t('rh.button.archiveDisabled')
                            : summary.archive_window_status === 'archive_window_closed'
                              ? t('rh.archiveWindow.closedDescription')
                              : t('rh.button.downloadDocuments')
                          }
                        </p>
                      </div>

                      {/* 3. Select Candidate Button */}
                      <div>
                        <button
                          onClick={() => handleSetCandidate(summary.offer_id, summary.offer_title)}
                          disabled={settingCandidate === summary.offer_id || summary.status !== 'sous_evaluation' || !!summary.winner_name}
                          className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            summary.status === 'sous_evaluation' && !summary.winner_name
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          {settingCandidate === summary.offer_id ? (
                            <>
                              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Setting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('rh.selectCandidate')}
                            </>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          {summary.status === 'sous_evaluation' && !summary.winner_name
                            ? t('rh.selectCandidate')
                            : summary.winner_name
                              ? t('rh.button.candidateSelected').replace('{candidate}', summary.winner_name || '')
                              : summary.status === 'actif'
                                ? t('rh.button.offerMustExpire')
                                : t('rh.button.candidateNotAvailable')
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Archive functionality for non-Comité d'Ouverture users */}
                  {!isComiteOuverture && isExpired && summary.application_count > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleArchive(summary.offer_id, summary.offer_title)}
                        disabled={archiving === summary.offer_id || summary.archive_window_status === 'archive_window_closed'}
                        className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          summary.archive_window_status === 'archive_window_closed'
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {archiving === summary.offer_id ? (
                          <>
                            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                            </svg>
                              {t('rh.button.archiving')}
                          </>
                        ) : summary.archive_window_status === 'archive_window_closed' ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                              {t('rh.button.archiveClosed')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            {t('rh.archiveApplications')}
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {summary.archive_window_status === 'archive_window_closed'
                          ? t('rh.archiveWindow.closedDescription')
                          : t('rh.button.downloadDocuments')
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicationsSummary;