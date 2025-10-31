export const getOfferTypeInfo = (type: string) => {
  switch (type) {
    case 'candidature':
      return { name: 'Candidature', color: 'bg-blue-100 text-blue-800' };
    case 'manifestation':
      return { name: 'Manifestation', color: 'bg-purple-100 text-purple-800' };
    case 'appel_d_offre_service':
      return { name: "Appel d'Offre (Service)", color: 'bg-yellow-100 text-yellow-800' };
    case 'appel_d_offre_equipement':
      return { name: "Appel d'Offre (Equipement)", color: 'bg-orange-100 text-orange-800' };
    case 'consultation':
      return { name: 'Consultation', color: 'bg-green-100 text-green-800' };
    default:
      return { name: type, color: 'bg-gray-100 text-gray-800' };
  }
};