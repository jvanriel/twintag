/**
 * ZAZA.rocks SDK.
 *
 * @packageDocumentation
 */

import { environment } from './environment'


/**
 * SetHost allows you to overwrite the ZAZA domain.
 * 
 * @hidden
 */
export function setHost(host: string): void {
  environment.host = host;
}

/**
 * SetAdminHost allows you to overwrite the ZAZA Enterprise domain.
 * 
 * @hidden
 */
export function setAdminHost(host: string): void {
  environment.adminHost = host;
}

/**
 * setCachingHost allows you to overwrite the ZAZA caching domain.
 * 
 * @hidden
 */
export function setCachingHost(host: string): void {
    environment.cachingHost = host;
}  