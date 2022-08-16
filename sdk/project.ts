import { createBagInternal, View, EmailRequest } from './view';
import { Client } from './client';
import { environment } from './environment';
import { StructuredObject } from './structuredObject';
import { listObject } from './listObject';

/**
 * The project class allows you to interact with a ZAZA Enterprise project.
 *
 * To construct a project object you pass the API key you find
 * on the ZAZA Enterprise project page. E.g.:
 * ```
 * let project = new Zaza.Project('<Project API key>')
 * ```
 */
export class Project {
  /**
   * The API key passed when constructing the project object.
   */
  readonly apiKey: string;
  private client: Client;
  private projectId: string = '';
  private _useCaching: boolean = false;

  /**
   * Create a project
   *
   * @param apiKey You'll find the API Key on the ZAZA Enterprise project page.
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Client(apiKey);
  }

  /**
   * set caching host
   * @param val
   * @hidden
   */
  public useCaching(val: boolean) {
    this._useCaching = val;
    this.getProjectId();
  }

  /**
   * Create a bag, automatically linked to the project.
   */
  public async createBag(): Promise<View> {
    return await createBagInternal(this.client, this);
  }

  /**
   * Create a {@link View | view } object with project-level privileges.
   * Your project API key is automatically used for all changes.
   */
  public getView(qid: string): View {
    const view = new View(qid);

    // Pass state
    view._setConfig({ project: this, client: this.client });
    return view;
  }

  /**
   * List the metadata of a all bags within your project.
   * @param lang: optional language value. Allowed inputs are "all" or any language defined in project languages. If no value is passed, then project's default language will be used for returning data
   * @typeParam T The objects in the resulting array will be cast to this type.
   */
  public async getMetadata<T>(lang?: string): Promise<T[]> {
    let langParam = lang ? `language=${(lang == 'all' ? '*' : lang)}` : ''

    const url = this.getURL('/data/metadata', false, langParam);

    const [res, err] = await this.client.get<T[]>(url);
    if (err) {
      err.setMessage('failed to get metadata')
      throw err
    }

    return res;
  }

  /**
   * Create an object for the project. Returns a StructuredObject object on which various operations can be performed.
   *
   * @param objectName Name with which the object is to be created
   * @param objectAPIName APIName with which the object is to be created
   * @param isList Optional paramaeter to specify if the object is of list type. By default false is set as the value for this param.
   * @param isGlobal Optional parameter to specify if the object is of global type. By default false is set as the value for this param.
   * @param keyProperty Optional parameter to specify the key property for the object is. By default no key property will be created.
   */
  public async newObject(
    objectName: string,
    objectAPIName: string = "",
    isList?: boolean,
    isGlobal?: boolean,
    keyProperty?: string,
    access?: Access,
  ): Promise<StructuredObject> {
    const url = environment.adminHost + '/api/v1/object';

    const reqobject = {
      name: objectName,
      apiName: objectAPIName,
      isList: isList ? isList : false,
      isGlobal: isGlobal ? isGlobal : false,
      keyProperty: keyProperty ? keyProperty : '',
      access: access,
    };

    const [obj, err] = await this.client.put<StructuredObject>(url, reqobject);
    if (err) {
      err.setMessage('failed to create object')
      throw err
    }

    const object = new StructuredObject(this.apiKey, this._useCaching);
    object.$qid = obj.$qid;
    object.$schemaScope = obj.$schemaScope;
    object.isGlobal = obj.isGlobal;
    object.isList = obj.isList;
    object.keyProperty = obj.keyProperty;
    object.name = obj.name;
    object.apiName = obj.apiName
    object.access = obj.access;

    return object;
  }

  /**
   * Get an object by name. Returns a StructuredObject object on which various operations can be performed.
   *
   * @param objectAPIName APIName of the object
   */
  public async getObject(objectAPIName: string): Promise<StructuredObject> {
    const url = this.getURL(`/object?object=${objectAPIName}`, true);

    const [obj, err] = await this.client.get<StructuredObject>(url);
    if (err) {
      err.setMessage('failed to get object')
      throw err
    }
    const object = new StructuredObject(this.apiKey, this._useCaching);

    object.$qid = obj.$qid;
    object.$schemaScope = obj.$schemaScope;
    object.isGlobal = obj.isGlobal;
    object.isList = obj.isList;
    object.keyProperty = obj.keyProperty;
    object.name = obj.name;
    object.apiName = obj.apiName;

    return object;
  }

  /**
   * Delete an object by its name
   *
   * @param objectAPIName Name of the object
   */
  public async deleteObject(objectAPIName: string): Promise<void> {
    const url = environment.adminHost + '/api/v1/object?object=' + objectAPIName;

    const reqobject = {
      apiName: objectAPIName,
    };

    const [, err] = await this.client.delete<StructuredObject>(url, reqobject);
    if (err) {
      err.setMessage('failed to delete object')
      throw err
    }

    return;
  }

  /**
   * Delete project twintag. 
   * @param viewID view id of the twintag to be deleted.
   * 
   * Example:
   * ```js
   * await project.deleteTwintag('viewid')
   * ```
   */
  public async deleteTwintag(viewID: string) : Promise<void>{
    const data = await (new View(viewID)).data()
    const url = environment.host + '/api/v1/twintags/' + data.bagQid; 
    const [, err] = await this.client.delete<void>(url);
    if (err) {
      err.setMessage(`failed to delete project twintag`)
      throw err
    }
  }

  /**
   * Get an object for the view
   *
   * Required rights: owner.
   *
   * @param objectAPIName Name of the object
   *
   * @category Structured Data
   */
  public object(objectAPIName: string): listObject {
    return new listObject(objectAPIName, this.client, '', this.projectId, this._useCaching);
  }

  /**
   * @internal
   * Get project id for when caching is enabled
   */
  private getProjectId() {
    this.projectId = '';

    let claim:any;
    //adding checks for various platforms that uses sdk

    if (typeof atob !== 'undefined') {
      //from epsilon pluglet
      claim = JSON.parse(atob(this.apiKey.split('.')[1]));
    } else if (typeof window !== 'undefined') {
      //from document (e.g. index.js)
      claim = JSON.parse(window.atob(this.apiKey.split('.')[1]));
      // @ts-ignore
    } else if (typeof Buffer !== 'undefined') {
      //from any nodejs application
      // @ts-ignore
      claim = JSON.parse(Buffer.from(this.apiKey.split('.')[1], 'base64').toString())
    }
    if (claim == null) return
    this.projectId = claim.ProjectId;

    return this.projectId
  }

  /**
   * @internal
   * @param url
   */
  private getURL(url: string, argumentPreset: boolean, langParam: string = '') {
    let append = argumentPreset ? `&schemaScope=${this.projectId}` : `?schemaScope=${this.projectId}`;
    if (this._useCaching) {
      langParam = langParam ? `&${langParam}` : ''
      return `${environment.cachingHost}/${url}${append}${langParam}`;
    } else {
      langParam = langParam ? `?${langParam}` : ''
      return `${environment.adminHost}/api/v1/${url}${langParam}`;
    }
  }

  /**
   * Get bags in a project
   */
  public async getBags(): Promise<Bag[]> {
    const url = environment.adminHost + '/api/v1/twintags';

    const [res, err] = await this.client.get<Bag[]>(url);
    if (err) {
      err.setMessage('failed to get bag details for the project')
      throw err
    }
    return res;
  }

  /**
   * Sends email
   *
   * @param request EmailRequest object
   *
   * Example:
   *
   * You can call this method by passing {@link EmailRequest}:
   * ```js
   * await projectObj.sendToSubscribers({
   *    recepients: ["to@mail.com"]
   *    body: "email body"
   *    subject: "email subject"
   *    cc: ["cc@mail.com"]
   *    bcc: ["bcc@mail.com"]
   * })
   * ```
   * @category Notifications
   */
  public async sendToSubscribers<T>(request: EmailRequest): Promise<T> {

    const client = await this.client;
    const url = environment.adminHost + '/api/v1/subscribers/send';
    const [res, err] = await client.post<T>(url, request, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage('failed to notify to all the subsribers')
      throw err;
    }

    return res;
  }

  /**
   * Adds languages for a project.
   * Example:
   * ```js
   * await project.setAllowedLanguages(['en','nl'])
   * ```
   *
   * You can set default language for project in same function as well
   * Example:
   * ```js
   * await project.setAllowedLanguages(['en','nl'], 'nl')
   * ```
   *
   * @param request: array of languages
   * @param defaultLanguage: optional
   * @category Languages
   */
  public async setAllowedLanguages(request: string[], defaultLanguage?: string): Promise<Language[]> {
    const req = { allowedLanguages: request };
    const url = environment.adminHost + `/api/v1/project/allowedLanguages`
    const [res, err] = await this.client.put<Language[]>(url, req)
    if (err) {
      err.setMessage(`failed to add languages: ${err.message}`)
      throw err
    }
    if (defaultLanguage) {
      await this.setDefaultLanguage(defaultLanguage)
    }
    return res
  }

  /**
   * Get all allowed languages for a project.
   * Example:
   * ```js
   * let res = await project.getAllowedLanguages()
   * ```
   * @returns Promise<string[]>
   */
  public async getAllowedLanguages(): Promise<Language[]> {
    const url = environment.adminHost + `/api/v1/project/allowedLanguages`
    const [res, err] = await this.client.get<Language[]>(url)
    if (err) {
      err.setMessage(`failed to get allowed languages: ${err.message}`)
      throw err
    }
    return res
  }

  /**
   * Sets default language for the project.
   * Example:
   * ```js
   * await project.setDefaultLanguage('nl')
   * ```
   *
   * @param request: default language.
   * @category Languages
   */
  public async setDefaultLanguage<T>(request: string): Promise<Language> {
    const req = { defaultLanguage: request };
    const url = environment.adminHost + `/api/v1/project/defaultLanguage`
    const [res, err] = await this.client.put<Language>(url, req)
    if (err) {
      err.setMessage(`failed to set default language: ${err.message}`)
      throw err
    }
    return res
  }

  /**
   * gets default language for the project.
   * Example:
   * ```js
   * await project.getDefaultLanguage()
   * ```
   *
   * @category Languages
   */
  public async getDefaultLanguage(): Promise<Language> {
    const url = environment.adminHost + `/api/v1/project/defaultLanguage`
    const [res, err] = await this.client.get<Language>(url)
    if (err) {
      err.setMessage(`failed to get default language: ${err.message}`)
      throw err
    }
    return res
  }
}


interface Bag {
  projectId: string;
  viewId: string;
  type: string;
  path: string;
  StorageQid: string;
}

/**
 * Access definition for an object.
 *
 * eg:
 * <Access>{
 *    read: [BagType.Download, BagType.Owner]
 * }
 *
 * Above definition means Read access is available only for Download and Owner bags.
 * Download and owner bags can't access the object.
 */
export interface Access {
  read?: BagType[];
  insert?: BagType[];
  update?: BagType[];
  delete?: BagType[];
}

/**
 * BagType: Enum for type of bag.
 */
export enum BagType {
  Download = 'download',
  Upload = 'upload',
  UploadDownload = 'upload-download',
  Owner = 'owner',
}

/**
 * Languages for a project
 */
interface Language {
  name: string;
  apiName: string;
}
