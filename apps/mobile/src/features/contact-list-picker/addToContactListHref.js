/** The Add to lists sheet for these contacts. */
export default function addToContactListHref(contactIds) {
  return { pathname: '/add-to-contact-list', params: { contactIds: contactIds.join(',') } };
}
