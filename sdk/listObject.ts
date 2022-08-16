// deno-lint-ignore-file
import { environment } from './environment.ts';
import { Client } from './client.ts';
import { Parser } from './parser.ts';
import { FileUploader } from './fileUploader.ts';


/**
 * A list object class represents data from a list type of object.
 * This object can be used to interact with the list of data of a list object.
 * CRUD operations can be performed on this object
 */
export class listObject {
  viewId: string;
  objectApiName: string;

  private _client: Client;

  private _projectId: string;
  private _useCaching: boolean = false;

  /**
   * Construct listObject with objectApiName, scemaScope, viewId and client.
   *
   * @param objectAPIName
   * @param client
   * @param viewId
   * @param projectId
   * @param useCaching
   *
   * @internal
   */
  constructor(
    objectAPIName: string,
    client: Client,
    viewId: string,
    projectId: string,
    useCaching: boolean = false
  ) {
    this._client = client;

    this.viewId = viewId;
    this.objectApiName = objectAPIName;
    this._projectId = projectId;
    this._useCaching = useCaching;
  }

  /**
   * Get a record from list object with the specified id.
   * Optional parameter lang can be passed to get data in a specific language.
   *
   * Example:
   * Without language
   * ```js
   *  await object.get('')
   * ```
   *
   * With language parameter
   * ```js
   *  await object.get('', 'en')
   * ```
   *
   * @param id Id value of the record
   * @param lang: optional language value. Allowed inputs are "all" or any language defined in project languages. If no value is passed, then project's default language will be used for returning data
   *
   * @category ListObject
   */
  public async get<T>(id: string, lang?: string): Promise<T> {
    let url = '';

    if (this._useCaching) {
      if (this.viewId == '') {
        url = `${environment.cachingHost}/data/${this.objectApiName}/${id}?schemaScope=${this._projectId}`;
      } else {
        url = `${environment.cachingHost}/api/v1/views/${this.viewId}/data/${this.objectApiName}/${id}`;
      }
    } else {
      url = this.dataUrl(id);
    }

    url += lang
      ? `${url.indexOf('?') < 0 ? '?' : '&'}language=${lang == 'all' ? '*' : lang
      }`
      : '';
    const [res, err] = await this._client.get<T>(url);
    if (err) {
      err.setMessage(`failed to get data: ${err.message}`);
      throw err;
    }

    return Parser.parseSpecialTypes(res);
  }

  /**
   * Add data to list object for the specified view.
   *
   * @param data An object representing the data
   *
   * @category ListObject
   */
  public async insert<T>(data: T): Promise<T> {
    const url = this.dataUrl();

    const fileTypes = this.parseForFileType<T>(data);

    const [res, err] = await this._client.put<T>(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (err) {
      err.setMessage(`failed to insert data: ${err.message}`);
      throw err;
    }

    return await this.parseResponse(res, fileTypes);
  }

  /**
   * Private method to parse file types in request.
   *
   * @param data
   *
   * @internal
   */
  private parseForFileType<T>(data: any): {}[] {
    const fileType: {}[] = [];
    Object.entries(data).forEach(([key, value]) => {
      //Ideally vaidate if the value is of File type
      //Since at the time of development File polyfill was not injected to epsilon, checking for instance of File is not possible
      //adding null check for value deletion support
      if (value && typeof value === 'object') {
        fileType.push({
          apiName: key,
          file: data[key],
        });
        data[key] = {
          name: (value as any).name,
          size: (value as any).size,
        };
      }
    });

    return fileType;
  }

  /**
   * Private method to parse the insert/update response and assign FileUploader to file type columns
   * @param resp
   * @param fileTypes
   *
   * @internal
   */
  private async parseResponse(resp:any, fileTypes: {}[]) {
    fileTypes.forEach(async (obj: any) => {
      let fileResp = resp[obj.apiName];
      resp[obj.apiName] = new FileUploader(
        this._client,
        this.viewId,
        fileResp.uploadUrl,
        fileResp.metafest.fileQid,
        resp.$qid
      );
      if (obj.file instanceof Blob) {
        await resp[obj.apiName].Upload(obj.file);
        resp[obj.apiName] = fileResp.metafest
      }
    });
    return resp
  }

  /**
   * Add data to list object in insertInBulk.
   *
   * @param data array of object representing the data
   *
   * @category ListObject
   */
  public async insertInBulk<T>(data: T): Promise<T> {
    let url = this.dataUrl();
    url += '/import';
    const [res, err] = await this._client.put<T>(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (err) {
      err.setMessage(`failed to insert bulk data: ${err.message}`);
      throw err;
    }

    return res;
  }

  /**
   * Update an existing record on the list type object
   *
   * @param data An object representing the data. The QID of the record is required in the data object
   *
   * @category ListObject
   */

  public async update<T>(data: T): Promise<T> {
    const url = this.dataUrl();

    const fileTypes = this.parseForFileType(data);

    const [res, err] = await this._client.put<T>(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (err) {
      err.setMessage(`failed to update data: ${err.message}`);
      throw err;
    }

    return this.parseResponse(res, fileTypes);
  }

  /**
   * Delete a record in the list object.
   *
   * @param id ID value of the record
   *
   * @category ListObject
   */
  public async delete<T>(id: string, dataScope = ''): Promise<void> {
    const url = this.dataUrl();

    const req = {
      id: id,
      $dataScope: dataScope
    };

    const [, err] = await this._client.delete<T>(url, req, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (err) {
      err.setMessage(`failed to delete data: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get a record from list object using a filter.
   * Example:
   * ```js
   * let f: Filter = {
   *   "strCol": "test",
   *   "numCol":{
   *     lt: 10
   *   }
   * }
   * let res = await obj.match(f)
   * ```
   *
   * Above input will filter "strCol" for "test" and "numCol" for values less than 10
   *
   * @param filter: {@link Filter}
   * @param lang: optional language value. Allowed inputs are "all" or any language defined in project languages. If no value is passed, then project's default language will be used for returning data
   * @category ListObject
   */
  public async match<T>(f: Filter, lang?: string): Promise<T> {
    let filterQueryArg = this.getFilterQuery(f);
    let url = '';

    if (this._useCaching) {
      if (this.viewId == '') {
        url = `${environment.cachingHost}/data/${this.objectApiName}?schemaScope=${this._projectId}${filterQueryArg}`;
      } else {
        url = `${environment.cachingHost}/api/v1/views/${this.viewId}/data/${this.objectApiName}?${filterQueryArg}`;
      }
    } else {
      url = this.dataUrl(undefined, filterQueryArg);
    }
    url += lang
      ? `${url.indexOf('?') < 0 ? '?' : '&'}language=${lang == 'all' ? '*' : lang
      }`
      : '';

    const [res, err] = await this._client.get<T>(url);
    if (err) {
      err.setMessage('failed to get data');
      throw err;
    }

    return Parser.parseSpecialTypes(res);
  }

  public async getFile<T>(
    instanceQID: string,
    fileQID: string,
    forceDownload: boolean = false
  ): Promise<T> {
    let url = this.dataUrl(instanceQID);

    url += '/files/' + fileQID;

    if (forceDownload) {
      url += '?forcedownload=' + forceDownload;
    }

    let [res, err] = await this._client.get<T>(url);
    if (err) {
      err.setMessage(`failed to get data: ${err.message}`);
      throw err;
    }

    if (forceDownload) {
      [res, err] = await this._client.do<T>(
        (<any>res).fileURL,
        {
          method: 'get',
          headers: { 'Content-Type': 'application/octet-stream' },
        },
        true,
        true
      );
      if (err) {
        err.setMessage(`failed to get data: ${err.message}`);
        throw err;
      }
    }

    return res;
  }

  /**
   * Private method to get filter query for match method.
   *
   * @param Filter
   *
   * @internal
   */
  private getFilterQuery(f: Filter): string {
    let filterPredicate = '';
    if (f != null) {
      for (const [objName, objectsData] of Object.entries(f)) {
        if (typeof objectsData == 'object') {
          let fe: FilterExpression = <FilterExpression>objectsData;
          filterPredicate += fe.gt
            ? this.getFilterValue(objName, fe.gt, '>')
            : '';
          filterPredicate += fe.lt
            ? this.getFilterValue(objName, fe.lt, '<')
            : '';
          filterPredicate += fe.gte
            ? this.getFilterValue(objName, fe.gte, '>=')
            : '';
          filterPredicate += fe.lte
            ? this.getFilterValue(objName, fe.lte, '<=')
            : '';
        } else {
          filterPredicate += `&filter=${objName}=${encodeURIComponent(this.handleTypes(
            objectsData
          ))}`;
        }
      }
    }
    return filterPredicate;
  }

  /**
   * Private method to get create filter string.
   * @param objName
   * @param input
   * @param op
   * @internal
   */
  private getFilterValue(objName: string, input: custom, op: string): string {
    let v = this.handleTypes(input);
    if (v) {
      console.log("_________ getfilter ??? ", `&filter=${objName}${op}${encodeURIComponent(v)}`)
      return `&filter=${objName}${op}${encodeURIComponent(v)}`;
    }
    return '';
  }

  /**
   * Private method to handle different types.
   * @param input
   * @internal
   */
  private handleTypes(input: custom): any {
    switch (typeof input) {
      case 'string':
      case 'number': {
        return input;
      }
      default: {
        if (input instanceof Date) {
          return input.toISOString().replace('T', '%20').replace('Z', '');
        }
        return '';
      }
    }
  }

  /**
   * Private method to form the url.
   *
   * @param instanceId
   *
   * @internal
   */
  private dataUrl(instanceId?: string, fp?: string): string {
    let url = '';

    if (this.viewId == '') {
      url = environment.adminHost + '/api/v1/data/' + this.objectApiName;
    } else {
      url =
        environment.host +
        '/api/v1/views/' +
        this.viewId +
        '/data/' +
        this.objectApiName;
    }

    if (instanceId) {
      url += '/' + instanceId;
    }

    if (fp) {
      url += `?${fp}`;
    }

    return url;
  }
}

export type custom = string | number | Date;

/**
 * Filter input. Key value pair
 */
export interface Filter {
  [key: string]: custom | FilterExpression;
}

/**
 * Filter expression
 * gt: greater than
 * lt: less than
 * gte: greater than equal to
 * lte: less than equal to
 */
export interface FilterExpression {
  gt?: custom;
  lt?: custom;
  gte?: custom;
  lte?: custom;
}
