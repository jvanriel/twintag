import { Project } from "./project.ts"
import { View } from "./view.ts"
import { setHost, setAdminHost, setLogLevel } from "./sdk.ts";

const validateProjectKey = (_projectApiKey: string) => {
  // TODO
}
  
const validateTemplateViewerQid = (_templateViewerQid: string)=> {
  // TODO
}
  
const validateSubdomain = (_subdomain: string) => {
  // TODO
}

export class Twintag {
  subdomain: string
  protocol: string
  project:Project
  view:View

  constructor(projectApiKey: string, templateViewerQid:string, subdomain:string) {
    validateProjectKey(projectApiKey)
    validateTemplateViewerQid(templateViewerQid)
    validateSubdomain(subdomain)
    this.subdomain = subdomain
    this.protocol = 'https://'
    this.project = new Project(projectApiKey)
    this.view = new View(templateViewerQid)
    this.view._setConfig({project: this.project}) 
  }

  /**
   * 
   * @param path is a relative URL pathname starting with a '/'
   * 
   * @returns https://<subdomain>twintag.io<path>
   */
  Url(path:string) {
    if (!path.startsWith('/')) {
      throw Error(`bad path; have '${path}'; must start with '/'`)
    }
    return `https://${this.subdomain}.twintag.io${path}`
  }

  setHost(host:string) {setHost(host) }
  setAdminHost(host:string) {setAdminHost(host) }
  setLogLevel(logLevel:'none'|'single'|'headers'|'body') {setLogLevel(logLevel) }

}