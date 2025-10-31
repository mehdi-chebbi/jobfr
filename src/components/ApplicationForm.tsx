import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

const ApplicationForm = ({ offerId, offerType, onClose }: { offerId: number; offerType: string; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    tel_number: '',
    applicant_country: '',
    cv: null as File | null,
    diplome: null as File | null,
    id_card: null as File | null,
    cover_letter: null as File | null,
    declaration_sur_honneur: null as File | null,
    fiche_de_referencement: null as File | null,
    extrait_registre: null as File | null,
    note_methodologique: null as File | null,
    liste_references: null as File | null,
    offre_financiere: null as File | null,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [customRequiredDocuments, setCustomRequiredDocuments] = useState<Array<{id: number; document_name: string; document_key: string; required: boolean}>>([]);
  const [otherDocuments, setOtherDocuments] = useState<Array<{name: string; file: File}>>([]);
  const { t } = useI18n();
  
  // Fetch custom required documents for this offer
  useEffect(() => {
    const fetchCustomDocuments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/offers/${offerId}`);
        if (response.ok) {
          const offer = await response.json();
          if (offer.custom_required_documents && Array.isArray(offer.custom_required_documents)) {
            setCustomRequiredDocuments(offer.custom_required_documents);
          }
        }
      } catch (error) {
        console.error('Error fetching custom documents:', error);
      }
    };
    
    fetchCustomDocuments();
  }, [offerId]);
  
  // Country dropdown state
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [highlightedCountryIndex, setHighlightedCountryIndex] = useState(-1);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countryInputRef = useRef<HTMLInputElement>(null);

  // List of countries with their country codes
  const countries = [
    { name: "Afghanistan", code: "+93" },
    { name: "Albania", code: "+355" },
    { name: "Algeria", code: "+213" },
    { name: "Andorra", code: "+376" },
    { name: "Angola", code: "+244" },
    { name: "Antigua and Barbuda", code: "+1-268" },
    { name: "Argentina", code: "+54" },
    { name: "Armenia", code: "+374" },
    { name: "Australia", code: "+61" },
    { name: "Austria", code: "+43" },
    { name: "Azerbaijan", code: "+994" },
    { name: "Bahamas", code: "+1-242" },
    { name: "Bahrain", code: "+973" },
    { name: "Bangladesh", code: "+880" },
    { name: "Barbados", code: "+1-246" },
    { name: "Belarus", code: "+375" },
    { name: "Belgium", code: "+32" },
    { name: "Belize", code: "+501" },
    { name: "Benin", code: "+229" },
    { name: "Bhutan", code: "+975" },
    { name: "Bolivia", code: "+591" },
    { name: "Bosnia and Herzegovina", code: "+387" },
    { name: "Botswana", code: "+267" },
    { name: "Brazil", code: "+55" },
    { name: "Brunei", code: "+673" },
    { name: "Bulgaria", code: "+359" },
    { name: "Burkina Faso", code: "+226" },
    { name: "Burundi", code: "+257" },
    { name: "Cabo Verde", code: "+238" },
    { name: "Cambodia", code: "+855" },
    { name: "Cameroon", code: "+237" },
    { name: "Canada", code: "+1" },
    { name: "Central African Republic", code: "+236" },
    { name: "Chad", code: "+235" },
    { name: "Chile", code: "+56" },
    { name: "China", code: "+86" },
    { name: "Colombia", code: "+57" },
    { name: "Comoros", code: "+269" },
    { name: "Congo, Democratic Republic of the", code: "+243" },
    { name: "Congo, Republic of the", code: "+242" },
    { name: "Costa Rica", code: "+506" },
    { name: "Cote d'Ivoire", code: "+225" },
    { name: "Croatia", code: "+385" },
    { name: "Cuba", code: "+53" },
    { name: "Cyprus", code: "+357" },
    { name: "Czech Republic", code: "+420" },
    { name: "Denmark", code: "+45" },
    { name: "Djibouti", code: "+253" },
    { name: "Dominica", code: "+1-767" },
    { name: "Dominican Republic", code: "+1-809" },
    { name: "Ecuador", code: "+593" },
    { name: "Egypt", code: "+20" },
    { name: "El Salvador", code: "+503" },
    { name: "Equatorial Guinea", code: "+240" },
    { name: "Eritrea", code: "+291" },
    { name: "Estonia", code: "+372" },
    { name: "Eswatini", code: "+268" },
    { name: "Ethiopia", code: "+251" },
    { name: "Fiji", code: "+679" },
    { name: "Finland", code: "+358" },
    { name: "France", code: "+33" },
    { name: "Gabon", code: "+241" },
    { name: "Gambia", code: "+220" },
    { name: "Georgia", code: "+995" },
    { name: "Germany", code: "+49" },
    { name: "Ghana", code: "+233" },
    { name: "Greece", code: "+30" },
    { name: "Grenada", code: "+1-473" },
    { name: "Guatemala", code: "+502" },
    { name: "Guinea", code: "+224" },
    { name: "Guinea-Bissau", code: "+245" },
    { name: "Guyana", code: "+592" },
    { name: "Haiti", code: "+509" },
    { name: "Honduras", code: "+504" },
    { name: "Hungary", code: "+36" },
    { name: "Iceland", code: "+354" },
    { name: "India", code: "+91" },
    { name: "Indonesia", code: "+62" },
    { name: "Iran", code: "+98" },
    { name: "Iraq", code: "+964" },
    { name: "Ireland", code: "+353" },
    { name: "Israel", code: "+972" },
    { name: "Italy", code: "+39" },
    { name: "Jamaica", code: "+1-876" },
    { name: "Japan", code: "+81" },
    { name: "Jordan", code: "+962" },
    { name: "Kazakhstan", code: "+7" },
    { name: "Kenya", code: "+254" },
    { name: "Kiribati", code: "+686" },
    { name: "Korea, North", code: "+850" },
    { name: "Korea, South", code: "+82" },
    { name: "Kosovo", code: "+383" },
    { name: "Kuwait", code: "+965" },
    { name: "Kyrgyzstan", code: "+996" },
    { name: "Laos", code: "+856" },
    { name: "Latvia", code: "+371" },
    { name: "Lebanon", code: "+961" },
    { name: "Lesotho", code: "+266" },
    { name: "Liberia", code: "+231" },
    { name: "Libya", code: "+218" },
    { name: "Liechtenstein", code: "+423" },
    { name: "Lithuania", code: "+370" },
    { name: "Luxembourg", code: "+352" },
    { name: "Madagascar", code: "+261" },
    { name: "Malawi", code: "+265" },
    { name: "Malaysia", code: "+60" },
    { name: "Maldives", code: "+960" },
    { name: "Mali", code: "+223" },
    { name: "Malta", code: "+356" },
    { name: "Marshall Islands", code: "+692" },
    { name: "Mauritania", code: "+222" },
    { name: "Mauritius", code: "+230" },
    { name: "Mexico", code: "+52" },
    { name: "Micronesia", code: "+691" },
    { name: "Moldova", code: "+373" },
    { name: "Monaco", code: "+377" },
    { name: "Mongolia", code: "+976" },
    { name: "Montenegro", code: "+382" },
    { name: "Morocco", code: "+212" },
    { name: "Mozambique", code: "+258" },
    { name: "Myanmar", code: "+95" },
    { name: "Namibia", code: "+264" },
    { name: "Nauru", code: "+674" },
    { name: "Nepal", code: "+977" },
    { name: "Netherlands", code: "+31" },
    { name: "New Zealand", code: "+64" },
    { name: "Nicaragua", code: "+505" },
    { name: "Niger", code: "+227" },
    { name: "Nigeria", code: "+234" },
    { name: "North Macedonia", code: "+389" },
    { name: "Norway", code: "+47" },
    { name: "Oman", code: "+968" },
    { name: "Pakistan", code: "+92" },
    { name: "Palau", code: "+680" },
    { name: "Palestine", code: "+970" },
    { name: "Panama", code: "+507" },
    { name: "Papua New Guinea", code: "+675" },
    { name: "Paraguay", code: "+595" },
    { name: "Peru", code: "+51" },
    { name: "Philippines", code: "+63" },
    { name: "Poland", code: "+48" },
    { name: "Portugal", code: "+351" },
    { name: "Qatar", code: "+974" },
    { name: "Romania", code: "+40" },
    { name: "Russia", code: "+7" },
    { name: "Rwanda", code: "+250" },
    { name: "Saint Kitts and Nevis", code: "+1-869" },
    { name: "Saint Lucia", code: "+1-758" },
    { name: "Saint Vincent and the Grenadines", code: "+1-784" },
    { name: "Samoa", code: "+685" },
    { name: "San Marino", code: "+378" },
    { name: "Sao Tome et Principe", code: "+239" },
    { name: "Saudi Arabia", code: "+966" },
    { name: "Senegal", code: "+221" },
    { name: "Serbia", code: "+381" },
    { name: "Seychelles", code: "+248" },
    { name: "Sierra Leone", code: "+232" },
    { name: "Singapore", code: "+65" },
    { name: "Slovakia", code: "+421" },
    { name: "Slovenia", code: "+386" },
    { name: "Solomon Islands", code: "+677" },
    { name: "Somalia", code: "+252" },
    { name: "South Africa", code: "+27" },
    { name: "South Sudan", code: "+211" },
    { name: "Spain", code: "+34" },
    { name: "Sri Lanka", code: "+94" },
    { name: "Sudan", code: "+249" },
    { name: "Suriname", code: "+597" },
    { name: "Sweden", code: "+46" },
    { name: "Switzerland", code: "+41" },
    { name: "Syria", code: "+963" },
    { name: "Taiwan", code: "+886" },
    { name: "Tajikistan", code: "+992" },
    { name: "Tanzania", code: "+255" },
    { name: "Thailand", code: "+66" },
    { name: "Timor-Leste", code: "+670" },
    { name: "Togo", code: "+228" },
    { name: "Tonga", code: "+676" },
    { name: "Trinidad and Tobago", code: "+1-868" },
    { name: "Tunisia", code: "+216" },
    { name: "Turkey", code: "+90" },
    { name: "Turkmenistan", code: "+993" },
    { name: "Tuvalu", code: "+688" },
    { name: "Uganda", code: "+256" },
    { name: "Ukraine", code: "+380" },
    { name: "United Arab Emirates", code: "+971" },
    { name: "United Kingdom", code: "+44" },
    { name: "United States", code: "+1" },
    { name: "Uruguay", code: "+598" },
    { name: "Uzbekistan", code: "+998" },
    { name: "Vanuatu", code: "+678" },
    { name: "Vatican City", code: "+379" },
    { name: "Venezuela", code: "+58" },
    { name: "Vietnam", code: "+84" },
    { name: "Yemen", code: "+967" },
    { name: "Zambia", code: "+260" },
    { name: "Zimbabwe", code: "+263" }
  ];
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Get country code from phone number
  const getCountryCode = () => {
    if (!formData.applicant_country) return '';
    
    const selectedCountry = countries.find(c => c.name === formData.applicant_country);
    if (selectedCountry) {
      return selectedCountry.code;
    }
    
    return '';
  };
  
  // Get phone number without country code
  const getPhoneNumberWithoutCode = () => {
    const countryCode = getCountryCode();
    if (!countryCode) return formData.tel_number;
    
    // Check if the phone number starts with the country code
    if (formData.tel_number.startsWith(countryCode)) {
      return formData.tel_number.substring(countryCode.length).trim();
    }
    
    return formData.tel_number;
  };
  
  // Handle phone number input changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const countryCode = getCountryCode();
    
    if (countryCode) {
      // Only update the number part, not the country code
      setFormData(prev => ({ 
        ...prev, 
        tel_number: countryCode + (value ? ' ' + value : '')
      }));
    } else {
      // If no country is selected, just update the value
      setFormData(prev => ({ ...prev, tel_number: value }));
    }
  };
  
  // Handle country input changes
  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, applicant_country: value }));
    
    if (value) {
      const filtered = countries.filter(country => 
        country.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCountries(filtered.slice(0, 6).map(c => c.name)); // Limit to 6 options
      setShowCountryDropdown(true);
    } else {
      // Show first countries when input is empty
      setFilteredCountries(countries.slice(0, 6).map(c => c.name));
      setShowCountryDropdown(true);
    }
    setHighlightedCountryIndex(-1);
  };
  
  // Handle country key navigation
  const handleCountryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCountryDropdown) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedCountryIndex(prev => 
          prev < filteredCountries.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedCountryIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (highlightedCountryIndex >= 0) {
          e.preventDefault();
          selectCountry(filteredCountries[highlightedCountryIndex]);
        }
        break;
      case 'Escape':
        setShowCountryDropdown(false);
        break;
      default:
        break;
    }
  };
  
  // Select a country from the dropdown
  const selectCountry = (countryName: string) => {
    const selectedCountry = countries.find(c => c.name === countryName);
    if (selectedCountry) {
      // Extract the current phone number without any country code
      const currentPhoneWithoutCode = formData.tel_number.replace(/^\+\d+(\s|-)?/, '');
      
      setFormData(prev => ({ 
        ...prev, 
        applicant_country: countryName,
        tel_number: selectedCountry.code + (currentPhoneWithoutCode ? ' ' + currentPhoneWithoutCode : '')
      }));
    }
    setShowCountryDropdown(false);
    setHighlightedCountryIndex(-1);
    
    // Focus on the phone input after country selection
    setTimeout(() => {
      document.getElementById('tel_number')?.focus();
    }, 0);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current && 
        !countryDropdownRef.current.contains(event.target as Node) && 
        countryInputRef.current !== event.target
      ) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [name]: e.target.files![0] }));
    }
  };
  
  // Handle custom document file changes
  const handleCustomDocumentChange = (documentKey: string, file: File) => {
    setFormData(prev => ({ ...prev, [documentKey]: file }));
  };
  
  // Handle other documents
  const handleOtherDocumentAdd = (name: string, file: File) => {
    setOtherDocuments(prev => [...prev, { name, file }]);
  };
  
  const handleOtherDocumentRemove = (index: number) => {
    setOtherDocuments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CRITICAL: Check if deadline has passed before submitting
    try {
      const offerResponse = await fetch(`${API_BASE_URL}/offers/${offerId}`);
      if (offerResponse.ok) {
        const offer = await offerResponse.json();
        const now = new Date();
        const deadline = new Date(offer.deadline);
        
        if (now >= deadline) {
          setError(t('form.error.deadlinePassed'));
          return;
        }
      } else {
        setError(t('form.error.offerExpired'));
        return;
      }
    } catch (error) {
      setError(t('form.error.offerExpired'));
      return;
    }
    
    const requiredFields = ['cv', 'diplome', 'id_card', 'cover_letter'];
    for (const field of requiredFields) {
      if (!formData[field as keyof typeof formData]) {
        setError(`${t('form.error.required')} ${field.replace('_', ' ')} PDF`);
        return;
      }
    }
    
    const additionalRequiredFields: string[] = [];
    if (['manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation'].includes(offerType)) {
      additionalRequiredFields.push(
        'declaration_sur_honneur',
        'fiche_de_referencement',
        'extrait_registre',
        'note_methodologique',
        'liste_references',
        'offre_financiere'
      );
    }
    
    for (const field of additionalRequiredFields) {
      if (!formData[field as keyof typeof formData]) {
        setError(`${t('form.error.additionalRequired')} ${field.replace(/_/g, ' ')} ${t('form.error.forOfferType')}`);
        return;
      }
    }
    
    // Validate custom required documents
    for (const customDoc of customRequiredDocuments) {
      if (customDoc.required && !formData[customDoc.document_key as keyof typeof formData]) {
        setError(`${t('form.error.required')} ${customDoc.document_name}`);
        return;
      }
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('offer_id', offerId.toString());
      formDataToSend.append('full_name', formData.full_name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('tel_number', formData.tel_number);
      formDataToSend.append('applicant_country', formData.applicant_country);
      
      if (formData.cv) formDataToSend.append('cv', formData.cv);
      if (formData.diplome) formDataToSend.append('diplome', formData.diplome);
      if (formData.id_card) formDataToSend.append('id_card', formData.id_card);
      if (formData.cover_letter) formDataToSend.append('cover_letter', formData.cover_letter);
      if (formData.declaration_sur_honneur) formDataToSend.append('declaration_sur_honneur', formData.declaration_sur_honneur);
      if (formData.fiche_de_referencement) formDataToSend.append('fiche_de_referencement', formData.fiche_de_referencement);
      if (formData.extrait_registre) formDataToSend.append('extrait_registre', formData.extrait_registre);
      if (formData.note_methodologique) formDataToSend.append('note_methodologique', formData.note_methodologique);
      if (formData.liste_references) formDataToSend.append('liste_references', formData.liste_references);
      if (formData.offre_financiere) formDataToSend.append('offre_financiere', formData.offre_financiere);
      
      // Add custom documents
      for (const customDoc of customRequiredDocuments) {
        if (formData[customDoc.document_key as keyof typeof formData]) {
          formDataToSend.append(customDoc.document_key, formData[customDoc.document_key as keyof typeof formData] as File);
        }
      }
      
      // Add other documents
      otherDocuments.forEach((doc, index) => {
        formDataToSend.append(`other_doc_${index}`, doc.file);
        formDataToSend.append(`other_doc_name_${index}`, doc.name);
      });
      
      const response = await fetch(`${API_BASE_URL}/apply`, {
        method: 'POST',
        body: formDataToSend,
      });
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || t('form.error.applicationFailed'));
      }
    } catch (err) {
      setError(t('form.error.submitFailed'));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (success) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-3 text-lg font-medium text-gray-900">{t('apply.submitted.title')}</h3>
        <p className="mt-2 text-sm text-gray-500">{t('apply.submitted.text')}</p>
      </div>
    );
  }
  
  const requireAdditionalFields = ['manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation'].includes(offerType);
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
      
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">{t('form.fullName')}</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500"
          value={formData.full_name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('form.email')}</label>
        <input
          type="email"
          id="email"
          name="email"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      
      {/* Country field moved before phone number */}
      <div className="relative" ref={countryDropdownRef}>
        <label htmlFor="applicant_country" className="block text-sm font-medium text-gray-700">{t('form.country')}</label>
        <input
          ref={countryInputRef}
          type="text"
          id="applicant_country"
          name="applicant_country"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500"
          value={formData.applicant_country}
          onChange={handleCountryChange}
          onKeyDown={handleCountryKeyDown}
          onFocus={() => {
            // Show first countries when focused and empty
            if (!formData.applicant_country) {
              setFilteredCountries(countries.slice(0, 6).map(c => c.name));
              setShowCountryDropdown(true);
            } else {
              // Filter countries if there's already a value
              const filtered = countries.filter(country => 
                country.name.toLowerCase().includes(formData.applicant_country.toLowerCase())
              );
              setFilteredCountries(filtered.slice(0, 6).map(c => c.name));
              setShowCountryDropdown(true);
            }
          }}
          placeholder={t('form.country.placeholder')}
          required
        />
        
        {showCountryDropdown && filteredCountries.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
            {filteredCountries.map((country, index) => (
              <div
                key={country}
                className={`px-4 py-2 cursor-pointer ${
                  index === highlightedCountryIndex 
                    ? 'bg-green-500 text-white' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => selectCountry(country)}
              >
                {country}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Phone number field with country code */}
      <div>
        <label htmlFor="tel_number" className="block text-sm font-medium text-gray-700">
          {t('form.phoneNumber')}
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          {/* Country code input (disabled) */}
          <span
            className={`inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-500 text-sm ${
              !formData.applicant_country ? 'cursor-not-allowed' : ''
            }`}
          >
            {getCountryCode() || 'Code'}
          </span>

          {/* Phone number input */}
          <input
            type="tel"
            id="tel_number"
            name="tel_number"
            className={`flex-1 min-w-0 block w-full border border-gray-300 rounded-r-md py-2 px-3 focus:outline-none focus:ring-green-500 ${
              !formData.applicant_country ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            value={getPhoneNumberWithoutCode()}
            onChange={(e) => {
              // Just update the phone number part without the country code
              const numbersOnly = e.target.value.replace(/\D/g, '');
              const countryCode = getCountryCode();
              
              if (countryCode) {
                setFormData(prev => ({ 
                  ...prev, 
                  tel_number: countryCode + (numbersOnly ? ' ' + numbersOnly : '')
                }));
              }
            }}
            placeholder={formData.applicant_country ? t('form.phoneNumber.placeholder') : t('form.country.selectFirst')}
            disabled={!formData.applicant_country}
            required
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="cv" className="block text-sm font-medium text-gray-700">{t('form.cv')}</label>
        <input
          type="file"
          id="cv"
          name="cv"
          accept=".pdf"
          onChange={handleFileChange}
          className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          required
        />
      </div>
      
      <div>
        <label htmlFor="diplome" className="block text-sm font-medium text-gray-700">{t('form.diploma')}</label>
        <input
          type="file"
          id="diplome"
          name="diplome"
          accept=".pdf"
          onChange={handleFileChange}
          className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          required
        />
      </div>
      
      <div>
        <label htmlFor="id_card" className="block text-sm font-medium text-gray-700">{t('form.idCard')}</label>
        <input
          type="file"
          id="id_card"
          name="id_card"
          accept=".pdf"
          onChange={handleFileChange}
          className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          required
        />
      </div>
      
      <div>
        <label htmlFor="cover_letter" className="block text-sm font-medium text-gray-700">{t('form.coverLetter')}</label>
        <input
          type="file"
          id="cover_letter"
          name="cover_letter"
          accept=".pdf"
          onChange={handleFileChange}
          className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          required
        />
      </div>
      
      {requireAdditionalFields && (
        <>
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('form.additionalDocs')}</h3>
            
            <div>
              <label htmlFor="declaration_sur_honneur" className="block text-sm font-medium text-gray-700">{t('form.declarationHonneur')}</label>
              <input
                type="file"
                id="declaration_sur_honneur"
                name="declaration_sur_honneur"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
            
            <div>
              <label htmlFor="fiche_de_referencement" className="block text-sm font-medium text-gray-700">{t('form.ficheReferencement')}</label>
              <input
                type="file"
                id="fiche_de_referencement"
                name="fiche_de_referencement"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
            
            <div>
              <label htmlFor="extrait_registre" className="block text-sm font-medium text-gray-700">{t('form.extraitRegistre')}</label>
              <input
                type="file"
                id="extrait_registre"
                name="extrait_registre"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
            
            <div>
              <label htmlFor="note_methodologique" className="block text-sm font-medium text-gray-700">{t('form.noteMethodologique')}</label>
              <input
                type="file"
                id="note_methodologique"
                name="note_methodologique"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
            
            <div>
              <label htmlFor="liste_references" className="block text-sm font-medium text-gray-700">{t('form.listeReferences')}</label>
              <input
                type="file"
                id="liste_references"
                name="liste_references"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
            
            <div>
              <label htmlFor="offre_financiere" className="block text-sm font-medium text-gray-700">{t('form.offreFinanciere')}</label>
              <input
                type="file"
                id="offre_financiere"
                name="offre_financiere"
                accept=".pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
            </div>
          </div>
        </>
      )}
      
      {/* Custom Required Documents Section */}
      {customRequiredDocuments.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('form.customDocuments.title')}</h3>
          <div className="space-y-4">
            {customRequiredDocuments.map((customDoc) => (
              <div key={customDoc.id}>
                <label htmlFor={customDoc.document_key} className="block text-sm font-medium text-gray-700">
                  {customDoc.document_name}
                  {customDoc.required && <span className="text-red-500 ml-1">*</span>}
                  {!customDoc.required && <span className="text-gray-500 ml-1">({t('form.customDocuments.optional')})</span>}
                </label>
                <input
                  type="file"
                  id={customDoc.document_key}
                  name={customDoc.document_key}
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCustomDocumentChange(customDoc.document_key, e.target.files[0]);
                    }
                  }}
                  className="mt-1 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required={customDoc.required}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Other Documents Section */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('form.otherDocuments.title')}</h3>
        <p className="text-sm text-gray-600 mb-4">{t('form.otherDocuments.description')}</p>
        
        <div className="space-y-3">
          {otherDocuments.map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div>
                  <input
                    type="text"
                    value={doc.name}
                    onChange={(e) => {
                      const newDocs = [...otherDocuments];
                      newDocs[index].name = e.target.value;
                      setOtherDocuments(newDocs);
                    }}
                    className="text-sm font-medium text-gray-700 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                    placeholder={t('form.otherDocuments.namePlaceholder')}
                  />
                  <p className="text-xs text-gray-500">{doc.file.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOtherDocumentRemove(index)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
          
          <div className="flex items-center space-x-3">
            <input
              type="file"
              id="other_document"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const fileName = e.target.files[0].name.replace('.pdf', '');
                  handleOtherDocumentAdd(fileName, e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('other_document')?.click()}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>{t('form.otherDocuments.addButton')}</span>
            </button>
            <span className="text-sm text-gray-500">{t('form.otherDocuments.help')}</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          {t('form.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {isSubmitting ? t('form.submitting') : t('form.submit')}
        </button>
      </div>
    </form>
  );
};

export default ApplicationForm;