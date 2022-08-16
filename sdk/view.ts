import { environment } from './environment.ts';
import { Client } from './client.ts';
import { Project } from './project.ts';
import { FileInfo } from './files.ts';
import { VirtualFile } from './virtual.ts';
import { listObject } from './listObject.ts';
import { Parser } from './parser.ts';

/**
 * CreateBag creates a free bag without an association to an Enterprise project.
 */
export async function createBag(qid?: string): Promise<View> {
  return await createBagInternal(new Client(), undefined, qid);
}

/**
 * CreateBagInternal is the internal createBag function.
 *
 * @internal */
export async function createBagInternal(client: Client, project?: Project, qid?: string): Promise<View> {
  let viewReq: viewRequest;

  if (qid && qid != '') {
    viewReq = {
      id: qid,
      type: 'user',
      data: {
        rights: ['read', 'list'],
        isCanocical: 1,
      },
    };
  } else {
    viewReq = {
      type: 'owner',
      data: undefined,
    };
  }

  const path = environment.host + '/api/v1/views';
  const [data, err] = await client.put<viewObject>(path, viewReq);
  if (err) {
    err.setMessage(`failed to create a twintag`)
    throw err
  }

  const view = new View(data.id);

  // Pass state
  view._setConfig({ project: project, client: client, data: data });

  return view;
}

/**
 * View request object, used to create new views.
 *
 * @internal */
interface viewRequest {
  id?: string;
  type: string;
  data: viewRequestData | undefined;
  bagStorageQid?: string;
}

/**
 * View request data object, used to create new views.
 *
 * @internal */
interface viewRequestData {
  ownerId?: string;
  rights: string[];
  isCanocical: number;
}

/**
 * File move request object, used to move/copy/rename files.
 *
 * @internal */
interface fileMoveRequest {
  fileQid: string;
  targetBag: string;
  targetFolder: string;
  targetName: string;
  isCopy: boolean;
}

/**
 * viewInit allows passing internal state to the View object.
 *
 * @internal */
interface viewInit {
  project?: Project; // We pass on the project if the view was created from a project object.
  client?: Client; // We pass on the client if it isn't using an incompatible token.
  data?: viewObject; // We pass on the data to avoid fetching it twice.
}

/**
 * The view class allows you to interact with a view into a bag.
 * A view is represented by a `qid`. This is the string you see in its url:
 * `https://zaza.rocks/<qid>`.
 * A bag can have multiple views, each view can have different rights associated.
 * For example: owner, download-only, upload-only, ...
 *
 * To construct a view object, you pass its QID, E.g.:
 * ```
 * let view = new Zaza.View(viewId)
 * ```
 */
export class View {
  /**
   * The view QID
   */
  readonly qid: string;

  private _client?: Client;
  private project?: Project;
  private _data?: viewObject;
  private _useCaching: boolean = false;

  /**
   * Construct a view by its QID.
   *
   * @param init Internal parameter.
   */
  constructor(qid: string) {
    this.qid = qid;
  }

  /**
   * _setConfig allows us to pass internal state.
   *
   * @internal */
  _setConfig(init: viewInit): void {
    this.project = init?.project;
    this._client = init?.client;
    this._data = init?.data;
  }

  /**
   * set caching host
   * @param val
   * @hidden
   */
  public useCaching(val: boolean) {
    this._useCaching = val
  }

  private viewURL(): string {
    return environment.host + '/api/v1/views/' + this.qid;
  }

  private twintagURL(): string{
    return environment.host + '/api/v1/twintags/' + this._data?.bagQid;
  }

  private async client(): Promise<Client> {
    if (!this._client) {
      this._client = new Client();
    }

    if (!this._client.token) {
      const data = await this.data();
      this.setToken(data.authToken);
    }
    return this._client;
  }

  /**
   * Data gets the view definition. This includes the view rights.
   */
  public async data(): Promise<viewObject> {
    const data = this._data;
    if (data) {
      return data;
    }

    let client = this._client;
    if (!client) {
      client = new Client();
      this._client = client;
    }
    const [newData, err] = await client.get<viewObject>(this.viewURL());
    if (err) {
      err.setMessage(`failed to get twintag data`)
      throw err
    }

    this._data = newData;
    return this._data;
  }

  /**
   * Set the token used for authorization. This can be used to authorize
   * requests by the project API key rather than the view QID. However,
   * It is recommended use the {@link Project} object instead.
   */
  public setToken(token: string): void {
    if (!this._client) {
      this._client = new Client();
    }
    this._client.token = token;
  }

  private fileURL(obj: string, qid?: string, op?: string, useCachingHost = false): string {
    let url = (useCachingHost && this._useCaching ? environment.cachingHost : environment.host) + '/api/v1/views/' + this.qid + '/' + obj;
    if (qid) {
      url += '/' + qid;
    }
    if (op) {
      url += '/' + op;
    }

    return url;
  }

  private async fileURLUpload(obj: string, qid?: string, op?: string): Promise<string> {
    const data = await this.data();

    let url = this.fileURL(obj, qid, op);
    if (data.uploadsession) {
      url += '?uploadsession=' + data.uploadsession;
    }
    return url;
  }

  /**
   * Upload allows you to upload a file into a bag.
   *
   * Required rights: upload.
   *
   * @param name Optionally overwrite the file name.
   * @param parent: parent of the file. FileQid of the folder
   *
   * @category File management
   */
  public async upload(f: File, name?: string, parent?: string): Promise<FileInfo> {
    // Start
    const uploadStartReq: uploadRequest = {
      mode: 420,
      name: name ? name : f.name,
      size: f.size,
      parent: parent ? parent : undefined
    };

    let url = await this.fileURLUpload('files');

    const client = await this.client();
    const [startResp, startErr] = await client.put<uploadResponse>(url, uploadStartReq);
    if (startErr) {
      startErr.setMessage(`failed to start upload file to twintag`)
      throw startErr
    }

    // Upload
    const [, uploadErr] = await client.do<void>(startResp.uploadUrl, { method: 'PUT', body: f }, true, true);
    if (uploadErr) {
      uploadErr.setMessage(`failed to upload file to twintag`)
      throw uploadErr
    }

    // End
    url = await this.fileURLUpload('files', startResp.metafest.fileQid, 'end');

    const [, endErr] = await client.do<void>(url, { method: 'PUT', body: '{}' }, true);
    if (endErr) {
      endErr.setMessage(`failed to complete the file upload to twintag`)
      throw endErr
    }

    const fileInfo: FileInfo = {
      FileQid: startResp.metafest.fileQid,
      Name: startResp.metafest.fileName,
      Parent: undefined,
      Size: startResp.metafest.size,
      MTime: startResp.metafest.modTime,
      FileMode: startResp.metafest.fileMode.toString(),
    };
    return fileInfo;
  }

  /**
   * Upload a {@VirtualFile | virtual file} into a bag.
   *
   * Required rights: owner.
   *
   * @category File management
   */
  public async uploadVirtual(f: VirtualFile, name: string): Promise<void> {
    const uploadReq: uploadRequest = {
      mode: f.mode,
      name: name,
      size: 0,
      fileContent: f.GetDefinition(),
    };

    const url = await this.fileURLUpload('virtual');

    const client = await this.client();
    const [, err] = await client.put<void>(url, uploadReq, {}, true);
    if (err) {
      err.setMessage(`failed to upload virtual file to twintag`)
      throw err
    }

    // TODO: Parse FileInfo in response
  }

  /**
   * Download a file from a bag.
   *
   * Required rights: download.
   *
   * @category File management
   */
  public async download(name: string): Promise<ReadableStream> {
    // TODO: support name & fileInfo
    const url = this.fileURL('web', name);

    const client = await this.client();
    const [res, err] = await client.do<ReadableStream>(
      url,
      { method: 'get', headers: { 'Content-Type': 'application/octet-stream' } },
      true,
      true,
    );
    if (err) {
      err.setMessage(`failed to download file from twintag`)
      throw err
    }

    return res;
  }

  /**
   * Convenience method to download a JSON file from a bag and parse it.
   *
   * Required rights: download.
   *
   * @category File management
   */
  public async downloadJSON<T>(name: string): Promise<T> {
    // TODO: support name & fileInfo
    const url = this.fileURL('web', name);

    const client = await this.client();
    const [res, err] = await client.get<T>(url, { headers: { 'Content-Type': 'application/json' } }, true);
    if (err) {
      err.setMessage(`failed to downlaod JSON file from twintag`)
      throw err
    }
    return res;
  }

  /**
   * Rename a file from a bag.
   *
   * Required rights: upload & download.
   *
   * @category File management
   */
  public async rename(source: FileInfo, name: string): Promise<FileInfo> {
    return await this.doMove(source, name, undefined, undefined, false);
  }

  /**
   * Move a file.
   *
   * Required rights: upload & download, plus owner rights when specifying a bag.
   *
   * @category File management
   */
  public async move(source: FileInfo, name?: string, parent?: string, view?: string): Promise<FileInfo> {
    return await this.doMove(source, name, parent, view, false);
  }

  /**
   * Copy a file.
   *
   * Required rights: upload & download, plus owner rights when specifying a bag.
   *
   * @category File management
   */
  public async copy(source: FileInfo, name?: string, parent?: string, view?: string): Promise<FileInfo> {
    return await this.doMove(source, name, parent, view, true);
  }

  private async doMove(
    source: FileInfo,
    name?: string,
    parent?: string,
    view?: string,
    copy?: boolean,
  ): Promise<FileInfo> {
    // TODO: implementation
    if (parent === undefined) parent = '';
    if (view === undefined) view = '';
    if (name === undefined) name = '';
    if (copy === undefined) copy = false;

    const url = this.fileURL('files/' + source.FileQid + '/move');

    const fileMoveRequest: fileMoveRequest = {
      fileQid: source.FileQid,
      targetBag: view,
      targetFolder: parent,
      targetName: name,
      isCopy: copy,
    };
    const client = await this.client();
    const [resp, err] = await client.put<FileInfo>(url, fileMoveRequest);
    if (err) {
      err.setMessage(`failed to move file in twintag`)
      throw err
    }

    return resp;
  }

  /**
   * Delete a file from a bag.
   *
   * Required rights: delete.
   *
   * @category File management
   */
  public async delete(file: FileInfo): Promise<void> {
    // TODO: support filename; filename[], FileInfo & fileInfo[]
    const url = this.fileURL('files');

    const client = await this.client();
    const [, err] = await client.delete<void>(url, [file.FileQid.toString()]);
    if (err) {
      err.setMessage(`failed to delete file from twintag`)
      throw err
    }
  }

  /**
   * Delete an entire bag.
   *
   * Required rights: owner.
   */
  public async deleteBag(): Promise<void> {
    const url = this.viewURL();

    const client = await this.client();
    const [, err] = await client.delete<void>(url);
    if (err) {
      err.setMessage(`failed to delete twintag`)
      throw err
    }
  }

  /**
   * Delete a project twintag along with its metadata (if any)
   * This view instance should be generated with project.
   * 
   * Example:
   * ```js
   * const vi = project.getView('viewid')
   * await vi.deleteProjectTwintag()
   * ```
   */
  public async deleteProjectTwintag(): Promise<void>{
    if (!this._data) {
      await this.data()
    }
    const url = this.twintagURL();

    const client = await this.client();
    const [, err] = await client.delete<void>(url);
    if (err) {
      err.setMessage(`failed to delete project twintag`)
      throw err
    }
  }

  /**
   * Get a view with limited rights.
   *
   * Required rights: owner.
   */
  public async getUserView(rights: string[]): Promise<View> {
    const url = environment.host + '/api/v1/views';
    if (!this._data) {
      await this.data()
    }
    const viewReq: viewRequest = {
      id: undefined,
      type: 'user',
      data: {
        ownerId: this.qid,
        rights: rights,
        isCanocical: 1,
      },
      bagStorageQid: this._data?.bagQid
    };
    const client = await this.client();
    const [data, err] = await client.put<viewObject>(url, viewReq);
    if (err) {
      err.setMessage(`failed to get view information`)
      throw err
    }

    const userView = new View(data.id);

    // Pass state
    userView._setConfig({ project: this.project, data: data });

    return userView;
  }

  /**
   * List the files in the bag or a sub-folder.
   *
   * Required rights: list.
   *
   * @category File management
   */
  public async list(folder?: string): Promise<FileInfo[]> {
    // TODO: support path
    const url = this.fileURL('folders', folder);

    const client = await this.client();
    const [res, err] = await client.get<FileInfo[]>(url);
    if (err) {
      err.setMessage(`failed to get list of files from twintag`)
      throw err
    }

    return res;
  }

  /**
   * This method creates a folder for a twintag.
   * @param folderName
   * @param folderParent
   * @returns
   */
  public async addFolder<T>(folderName: string, folderParent?: string): Promise<T> {
    if (folderName.trim().length == 0) {
      throw new Error("Invalid folder name.")
    }
    const url = this.fileURL('folders')
    let body = {
      name: folderName,
      parent: folderParent ? folderParent : null
    }
    const client = await this.client();

    const [res, err] = await client.put<T>(url, body)
    if (err) {
      err.setMessage(`failed to create folder: ${err.message}`)
      throw err
    }
    return res;
  }

  /**
   * Seal the bag.
   *
   * Required rights: list.
   *
   * @hidden
   */
  public async seal(): Promise<void> {
    const url = this.fileURL('seal');

    const client = await this.client();
    const [, err] = await client.put<viewObject>(url, {});
    if (err) {
      err.setMessage(`failed to seal`)
      throw err
    }
  }

  /**
   * Get the bag metadata of this specific bag. The metadata is returned as an object.
   *
   * Required rights: download.
   *
   * @param lang: optional language value. Allowed inputs are "all" or any language defined in project languages. If no value is passed, then project's default language will be used for returning data
   * @category Metadata
   */
  public async getMetadata<T>(lang?: string): Promise<T> {

    let url = this.fileURL('data/metadata', undefined, undefined, true);
    url += lang ? `?language=${(lang == 'all' ? '*' : lang)}` : ''

    const client = await this.client();
    const [res, err] = await client.get<T>(url);
    if (err) {
      err.setMessage(`failed to get metadata of twintag`)
      throw err
    }

    return Parser.parseSpecialTypes(res);
  }

  /**
   * Set the bag metadata of this specific bag. Returns a full view of the resulting metadata.
   *
   * Required rights: owner.
   *
   * @param data An object representing the metadata.
   *
   * @category Metadata
   */
  public async setMetadata<T>(data: T): Promise<T> {
    const url = this.fileURL('data/metadata');

    const client = await this.client();
    const [res, err] = await client.put<T>(url, data, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage(`failed to set metadata to twintag`)
      throw err
    }

    return res;
  }

  /**
   * Get the bag data of a specific bag and object. The data is returned as an object.
   *
   * Required rights: download.
   *
   * @param objectAPIName The apiName of the object for which the data is being requested
   *
   * @param attribute Optional parameter to specify the attribute for which the data is required
   *
   * @category Structured Data
   */
  public async getData<T>(objectAPIName: string, attribute?: string): Promise<T> {
    let url = this.fileURL('data/' + objectAPIName, undefined, undefined, true);

    if (attribute && attribute != '') {
      url = url + '?property=' + attribute;
    }

    const client = await this.client();
    const [res, err] = await client.get<T>(url);
    if (err) {
      err.setMessage(`failed to get data to twintag object: ${objectAPIName}`)
      throw err
    }

    return Parser.parseSpecialTypes(res);
  }

  /**
   * Set the bag data of this specific bag and object. Returns a full view of the resulting data.
   *
   * Required rights: owner.
   *
   * @param data An object representing the data.
   * @param objectApiName APIName of the object for which the data is being set.
   *
   * @category Structured Data
   */
  public async setData<T>(objectApiName: string, data: T): Promise<T> {
    const url = this.fileURL('data/' + objectApiName);

    const client = await this.client();
    const [res, err] = await client.put<T>(url, data, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage(`failed to set data to twintag object: ${objectApiName}`)
      throw err
    }

    return res;
  }

  /**
   * Get an object for the view
   *
   * Required rights: owner.
   *
   * @param objectApiName APIName of the object
   *
   * @category Structured Data
   */
  public async object(objectApiName: string): Promise<listObject> {
    const client = await this.client();
    const data = await this.data();

    if (!data.data.project || !data.data.project.projectId || data.data.project.projectId == '') {
      throw new Error(`view not tagged to any project`);
    }

    return new listObject(objectApiName, client, data.id, '', this._useCaching);
  }

  /**
   * Sends notification to the registered users of the view.
   *
   * Required rights: owner.
   *
   * @param message message to be sent as a notification.
   * @param channel optional, if not specified then default channel is 'email'
   *
   * Example:
   * ```js
   * await viewObj.notify(`This is a custom email body.`)
   * ```
   *
   * You can further customize email body by passing {@link NotificationRequest}:
   * ```js
   * await viewObj.notify({
   *    message: "custom user message"
   *    subject: "custom email subject"
   *    bagAlias: "Custom alias for bag"
   *    showBagReport: true
   *    language: "en-GB"
   * })
   * ```
   * You can provide any ISO 15897 locale for language attribute.
   * Currently supported values: en_GB, nl_BE, fr_BE
   * @category Notification
   */
  public async notify<T>(request: string | NotificationRequest, channel?: string): Promise<T> {
    const client = await this.client();
    let body: NotificationRequest;
    if (typeof request == 'string') {
      body = {
        message: request,
      };
    } else {
      body = request;
    }
    channel = channel ? channel : 'email';
    const url = this.viewURL() + '/notification?type=' + channel;
    const [res, err] = await client.post<T>(url, body, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage('failed to notify to all subcribers of twintag')
      throw err
    }

    return res;
  }

  /**
 * Sends email to the registered users of the view.
 *
 * @param request message to be sent.
 *
 * Example:
 * ```js
 * await viewObj.sendFeedback({content: 'This is test content'})
 * ```
 *
 * You can further customize email body by passing {@link FeedbackRequest}:
 * ```js
 * await viewObj.sendFeedback({
 *    content: 'This is test content',
 *    subject: "custom email subject",
 *    email: 'email';
 * })
 * ```
 * @category Notification
 */
  public async sendFeedback<T>(request: string | FeedbackRequest): Promise<T> {
    const client = await this.client();
    let body: FeedbackRequest;
    if (typeof request == 'string') {
      body = {
        content: request,
      };
    } else {
      body = request;
    }
    const url = this.viewURL() + '/feedback';
    const [res, err] = await client.put<T>(url, body, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage(`failed to submit feedback`);
      throw err
    }
    return res
  }


  /**
   * Sends email
   *
   * Required rights: Any.
   *
   * @param request EmailRequest object
   *
   * Example:
   *
   * You can call this method by passing {@link EmailRequest}:
   * ```js
   * await viewObj.sendToSubscribers({
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

    const client = await this.client();
    const data = await this.data();

    const url = this.viewURL() + `/notification?type=customEmail`;
    const [res, err] = await client.post<T>(url, request, { headers: { 'Content-Type': 'application/json' } });
    if (err) {
      err.setMessage('failed to notify to all subcribers of twintag through custom email')
      throw err
    }

    return res;
  }
}

/**
 * Notification request message.
 */
interface NotificationRequest {
  message: string;
  subject?: string;
  bagAlias?: string;
  showBagReport?: boolean;
  language?: string;
}

/**
 * Notification request message.
 */
export interface EmailRequest {
  sender?: string;
  recipients?: string[];
  body?: string;
  subject?: string;
  cc?: string[];
  bcc?: string[];
  toSubscribers?: boolean;
  mergeVars?: {};
  /**
   * template used for mailchimp templates. This will override the default template in admin settings.
   */
  template?: string;
}




/**
 * FeedbackRequest message.
 */
interface FeedbackRequest {
  email?: string;
  subject?: string;
  content: string;
  rating?: number;
}
/**
 * View information data
 */
interface viewObjectData {
  rights: string[];
  project: projectData;
  // bagPublic: BagPublic;
}

/**
 * Project information data
 */
interface projectData {
  projectId: string;
  projectName: string;
  companyName: string;
}

/**
 * View information
 */
interface viewObject {
  id: string;
  type: string;
  bagQid: string;
  data: viewObjectData;
  uploadsession: string;
  state: string;
  wsToken: string;
  wsSeed: string;
  authToken: string;
}

/**
 * Details of a file
 *
 * @internal
 */
interface newFileInfo {
  fileQid: string;
  fileMode: number;
  fileName: string;
  size: number;
  modTime: Date;
}

/**
 * Upload request
 *
 * @internal
 */
interface uploadRequest {
  mode: number;
  name: string;
  size: number;
  fileContent?: any;
  parent?: string;
}

/**
 * Upload response
 *
 * @internal
 */
interface uploadResponse {
  metafest: newFileInfo;
  uploadUrl: string;
}
