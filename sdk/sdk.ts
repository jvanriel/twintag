/**
 * ZAZA.rocks SDK.
 *
 * @packageDocumentation
 */

import { environment } from './environment.ts'


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

/**
 * setCachingHost allows you to overwrite the ZAZA caching domain.
 * 
 * @param logLevel
 * * none: no logging
* single: shows a single line with method, path and status
* headers: shows request method, path headers and response status and headers
* body: same as headers but also shows request/response body when body is json
* return the previous level
 * 
 * @hidden
 */
 export function setLogLevel(logLevel: 'none'|'single'|'headers'|'body'): 'none'|'single'|'headers'|'body' {
  const prev = environment.logLevel
  environment.logLevel = logLevel;
  return prev === undefined ? 'none' : prev
}  