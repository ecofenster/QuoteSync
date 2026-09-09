export const INTERNAL_PORTAL_NAVIGATION_EVENT="quotesuite:open-client-portal";
export type InternalPortalNavigationDetail={clientId?:string|null;projectId?:string|null;source:"directory"|"client"|"estimate"|"order"|"rejected"};
export function openInternalClientPortal(detail:InternalPortalNavigationDetail){window.dispatchEvent(new CustomEvent<InternalPortalNavigationDetail>(INTERNAL_PORTAL_NAVIGATION_EVENT,{detail}));}
