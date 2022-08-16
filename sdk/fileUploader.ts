import { Client } from './client.ts';
import { environment } from './environment.ts';

export class FileUploader {
  signedUrl: string;

  instanceQid: string;
  fileQid: string;
  viewId: string;
  private _client: Client;

  /**
   * Construct listObject with objectApiName, scemaScope, viewId and client.
   *
   * @param client
   * @param viewId
   * @param signedUrl
   * @param fileQid
   * @param instanceQid
   *
   * @internal
   */
  constructor(
    client: Client,
    viewId: string,
    signedUrl: string,
    fileQid: string,
    instanceQid: string
  ) {
    this._client = client;

    this.viewId = viewId;
    this.instanceQid = instanceQid;
    this.fileQid = fileQid;
    this.signedUrl = signedUrl;
  }

  /**
   * Upload uploads the file provided file to the resppective structured data column
   *
   * @param file, file to be uploaded
   *
   */
  public async Upload(file: File): Promise<void> {
    await this.uploadFile(file);
  }

  /**
   * Private method to upload file.
   *
   * @param file type properties
   *
   * @internal
   */
  private async uploadFile(file: File) {
    await this.uploadToS3(this.signedUrl, file);
    await this.endUpload(this.instanceQid, this.fileQid);
  }

  /**
   * Private method to upload file to s3.
   *
   * @param uploadUrl presigned s3 upload url
   * @param file file object to upload
   *
   * @internal
   */
  private async uploadToS3<T>(uploadUrl: string, file: File) {
    const body = await file.arrayBuffer();
    return this._client.do<T>(
      uploadUrl,
      { method: 'put', body: body },
      true,
      true
    );
  }

  /**
   * Private method to end upload call.
   *
   * @param fileContext instance qid
   * @param fileQid file qid
   *
   * @internal
   */
  private async endUpload(fileContext: string, fileQid: string) {
    let url = this.fileUrl();
    url += '/end';

    const body = {
      fileQid: fileQid,
      fileContext: fileContext,
    };

    await this._client.put(url, body);
  }

  private fileUrl(): string {
    if (this.viewId != '') {
      return environment.host + '/api/v1/views/' + this.viewId + '/data/files';
    } else {
      return environment.adminHost + '/api/v1/data/files';
    }
  }
}
