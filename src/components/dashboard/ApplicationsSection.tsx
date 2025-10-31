import { useState } from 'react';
import type { Application } from '../../types';
import { getOfferTypeInfo } from '../../utils/offerType';
import { API_BASE_URL } from '../../config';
import { useI18n } from '../../i18n';
import Swal from 'sweetalert2';

interface ApplicationsSectionProps {
  applications: Application[];
  onDeleteApplication: (id: number) => Promise<void>;
  onDownloadDocument: (url: string, filename: string) => Promise<void>;
}

const ApplicationsSection = ({ 
  applications, 
  onDeleteApplication, 
  onDownloadDocument 
}: ApplicationsSectionProps) => {
  const { t } = useI18n();
  const [selectedApplications, setSelectedApplications] = useState<number[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    offerType: '',
    department: '',
    applicantCountry: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.full_name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         app.email.toLowerCase().includes(filters.search.toLowerCase()) ||
                         app.offer_title.toLowerCase().includes(filters.search.toLowerCase());
    const matchesOfferType = filters.offerType ? app.offer_type === filters.offerType : true;
    const matchesDepartment = filters.department ? app.offer_department === filters.department : true;
    const matchesCountry = filters.applicantCountry ? app.applicant_country === filters.applicantCountry : true;
    
    return matchesSearch && matchesOfferType && matchesDepartment && matchesCountry;
  });

  const uniqueOfferTypes = Array.from(new Set(applications.map(app => app.offer_type)));
  const uniqueAppCountries = Array.from(new Set(applications.map(app => app.applicant_country)));
  const uniqueAppDepartments = Array.from(new Set(applications.map(app => app.offer_department)));

  const toggleApplicationSelection = (appId: number) => {
    setSelectedApplications(prev => 
      prev.includes(appId) 
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  const selectAllApplications = () => {
    setSelectedApplications(filteredApplications.map(app => app.id));
  };

  const clearAllSelections = () => {
    setSelectedApplications([]);
  };

  const downloadMultipleProfiles = async () => {
    if (selectedApplications.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Selection',
        text: t('rh.alert.noApplicationsSelected'),
        confirmButtonText: 'OK'
      });
      return;
    }

    setIsDownloading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Create a zip file using JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const appId of selectedApplications) {
        const app = applications.find(a => a.id === appId);
        if (!app) continue;
        
        // Create folder structure: OfferName/CandidateName/
        const folderName = `${app.offer_title.replace(/[^a-zA-Z0-9]/g, '_')}/${app.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Download each document
        const documents = [
          { url: app.cv_url, filename: app.cv_filename, type: 'CV' },
          { url: app.diplome_url, filename: app.diplome_filename, type: 'Diploma' },
          { url: app.id_card_url, filename: app.id_card_filename, type: 'ID_Card' },
          { url: app.cover_letter_url, filename: app.cover_letter_filename, type: 'Cover_Letter' },
          { url: app.declaration_sur_honneur_url, filename: app.declaration_sur_honneur_filename, type: 'Declaration_Honneur' },
          { url: app.fiche_de_referencement_url, filename: app.fiche_de_referencement_filename, type: t('form.ficheReferencement') },
          { url: app.extrait_registre_url, filename: app.extrait_registre_filename, type: 'Extrait_Registre' },
          { url: app.note_methodologique_url, filename: app.note_methodologique_filename, type: 'Note_Methodologique' },
          { url: app.liste_references_url, filename: app.liste_references_filename, type: t('form.listeReferences') },
          { url: app.offre_financiere_url, filename: app.offre_financiere_filename, type: 'Offre_Financiere' }
        ];
        
        for (const doc of documents) {
          if (doc.url && doc.filename) {
            try {
              const response = await fetch(`${API_BASE_URL}${doc.url}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (response.ok) {
                const blob = await response.blob();
                const fileExtension = doc.filename.split('.').pop();
                const cleanFilename = `${doc.type}.${fileExtension}`;
                zip.file(`${folderName}/${cleanFilename}`, blob);
              }
            } catch (error) {
              console.error(`Error downloading ${doc.type} for ${app.full_name}:`, error);
            }
          }
        }
        
        // Add a summary text file for each candidate
        const summaryText = `
Candidate Information:
- Name: ${app.full_name}
- Email: ${app.email}
- Phone: ${app.tel_number}
- Country: ${app.applicant_country}
- Applied for: ${app.offer_title}
- Offer Type: ${app.offer_type}
- Department: ${app.offer_department}
- Application Date: ${new Date(app.created_at || Date.now()).toLocaleDateString()}
`;
        zip.file(`${folderName}/candidate_info.txt`, summaryText);
      }
      
      // Generate and download the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `selected_applications_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Clear selections after download
      setSelectedApplications([]);
      
    } catch (error) {
      console.error('Error creating bulk download:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: t('rh.alert.bulkDownloadError'),
        confirmButtonText: 'OK'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      offerType: '',
      department: '',
      applicantCountry: ''
    });
  };

  const handleViewDetails = (application: Application) => {
    setSelectedApplication(application);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('rh.tabs.applications')}</h2>
          <p className="text-gray-600 mt-1">{t('rh.dashboard.applicationsSubtitle')}</p>
        </div>
        
        {/* Bulk Actions */}
        <div className="flex items-center space-x-3">
          {selectedApplications.length > 0 && (
            <>
              <span className="text-sm text-gray-600">
                {selectedApplications.length} {t('rh.selected')}
              </span>
              <button
                onClick={clearAllSelections}
                className="inline-flex items-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                {t('rh.clearSelection')}
              </button>
              <button
                onClick={downloadMultipleProfiles}
                disabled={isDownloading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('rh.downloading')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('rh.downloadSelected')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">{t('rh.filter.applications')}</h3>
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
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.search')}</label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    name="search"
                    placeholder={t('rh.search.applications.placeholder')}
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
                <label htmlFor="offerType" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.type')}</label>
                <select
                  id="offerType"
                  name="offerType"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.offerType}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allTypes')}</option>
                  {uniqueOfferTypes.map(type => (
                    <option key={type} value={type}>
                      {getOfferTypeInfo(type).name}
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
                  {uniqueAppDepartments.map(department => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="applicantCountry" className="block text-sm font-medium text-gray-700 mb-1">{t('rh.country')}</label>
                <select
                  id="applicantCountry"
                  name="applicantCountry"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={filters.applicantCountry}
                  onChange={handleFilterChange}
                >
                  <option value="">{t('rh.allCountries')}</option>
                  {uniqueAppCountries.map(country => (
                    <option key={country} value={country}>
                      {country}
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

      {/* Selection Controls */}
      {filteredApplications.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedApplications.length === filteredApplications.length && filteredApplications.length > 0}
                  onChange={(e) => e.target.checked ? selectAllApplications() : clearAllSelections()}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {selectedApplications.length === filteredApplications.length && filteredApplications.length > 0 
                    ? t('rh.deselectAll') 
                    : t('rh.selectAll')
                  }
                </span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedApplications.length} of {filteredApplications.length} selected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('rh.noApplications.title')}</h3>
          <p className="text-gray-600">{t('rh.noApplications.subtitle')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedApplications.length === filteredApplications.length && filteredApplications.length > 0}
                      onChange={(e) => e.target.checked ? selectAllApplications() : clearAllSelections()}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('rh.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('rh.department')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedApplications.includes(application.id)}
                        onChange={() => toggleApplicationSelection(application.id)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {application.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{application.full_name}</div>
                          <div className="text-sm text-gray-500">{application.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{application.offer_title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getOfferTypeInfo(application.offer_type).color
                      }`}>
                        {getOfferTypeInfo(application.offer_type).name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {application.offer_department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(application.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(application)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('rh.viewDetails')}
                        </button>
                        <button
                          onClick={() => onDeleteApplication(application.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('rh.table.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {t('rh.modal.appFrom')} {selectedApplication.full_name}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {t('rh.modal.appliedFor')} {selectedApplication.offer_title}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Contact Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.label.email')}</label>
                      <p className="text-gray-900">{selectedApplication.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.label.phone')}</label>
                      <p className="text-gray-900">{selectedApplication.tel_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.label.country')}</label>
                      <p className="text-gray-900">{selectedApplication.applicant_country}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Application Details</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.label.offerType')}</label>
                      <p className="text-gray-900">{getOfferTypeInfo(selectedApplication.offer_type).name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.department')}</label>
                      <p className="text-gray-900">{selectedApplication.offer_department}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('rh.deadlineLabel')}</label>
                      <p className="text-gray-900">{new Date(selectedApplication.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">{t('rh.documents.title')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: t('form.cv'), filename: selectedApplication.cv_filename, url: selectedApplication.cv_url },
                    { name: t('form.diploma'), filename: selectedApplication.diplome_filename, url: selectedApplication.diplome_url },
                    { name: t('form.idCard'), filename: selectedApplication.id_card_filename, url: selectedApplication.id_card_url },
                    { name: t('form.coverLetter'), filename: selectedApplication.cover_letter_filename, url: selectedApplication.cover_letter_url },
                    { name: t('form.declarationHonneur'), filename: selectedApplication.declaration_sur_honneur_filename, url: selectedApplication.declaration_sur_honneur_url },
                    { name: t('form.ficheReferencement'), filename: selectedApplication.fiche_de_referencement_filename, url: selectedApplication.fiche_de_referencement_url },
                    { name: t('form.extraitRegistre'), filename: selectedApplication.extrait_registre_filename, url: selectedApplication.extrait_registre_url },
                    { name: t('form.noteMethodologique'), filename: selectedApplication.note_methodologique_filename, url: selectedApplication.note_methodologique_url },
                    { name: t('form.listeReferences'), filename: selectedApplication.liste_references_filename, url: selectedApplication.liste_references_url },
                    { name: t('form.offreFinanciere'), filename: selectedApplication.offre_financiere_filename, url: selectedApplication.offre_financiere_url }
                  ].filter(doc => doc.filename && doc.url).map((doc, index) => (
                    <button
                      key={index}
                      onClick={() => onDownloadDocument(doc.url!, doc.filename!)}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{doc.filename}</div>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('rh.modal.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsSection;