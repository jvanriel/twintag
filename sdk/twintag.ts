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
  templateViewQid:string

  constructor(projectApiKey: string, templateViewQid:string, subdomain:string) {
    validateProjectKey(projectApiKey)
    validateTemplateViewerQid(templateViewQid)
    validateSubdomain(subdomain)
    this.templateViewQid = templateViewQid
    this.subdomain = subdomain
    this.protocol = 'https://'
    this.project = new Project(projectApiKey)
    this.view = new View(templateViewQid)
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
    if (path === '/') {
      return `https://${this.subdomain}.twintag.io/${this.templateViewQid}`
    } else {
      return `https://${this.subdomain}.twintag.io${path}`
    }
  }

  setHost(host:string) {setHost(host) }
  setAdminHost(host:string) {setAdminHost(host) }
  setLogLevel(logLevel:'none'|'single'|'headers'|'body') {setLogLevel(logLevel) }

}