import { Access } from './project.ts';
import { Client } from './client.ts';
import { environment } from './environment.ts';

/**
 * StructuredObject class represents an object of a project.
 * Operations like creating attributes, getting attributes can be informed.
 */
export class StructuredObject {
  $schemaScope?: string;
  $qid?: string;
  name = '';
  apiName = '';
  isList = false;
  isGlobal = false;
  keyProperty?: string;
  access?: Access;

  private _useCaching = false;

  private client: Client;

  /**
   * Create an object of StructuredObject
   *
   * @param apiKey You'll find the API Key on the ZAZA Enterprise project page.
   */
  constructor(apiKey: string, useCaching: boolean = false) {
    this.client = new Client(apiKey);
    this._useCaching = useCaching;
  }

  /**
   * Get the attributes of the object of the project. Returns the list of attributes.
   */
  public async getAttributes(): Promise<Attribute[]> {
    const url = this.getURL(
      `/property?object=${this.apiName}&`,
      this.$schemaScope
    );
    const [res, err] = await this.client.get<Attribute[]>(url);
    if (err) {
      err.setMessage(`failed to get attributes: ${err.message}`);
      throw err;
    }

    return res;
  }

  /**
   * Get a specific attribute by name
   *
   * @param attributeName Name of the attribute
   */
  public async getAttribute<attribute>(
    attributeName: string
  ): Promise<attribute> {
    const url = this.getURL(
      `/property?object=${this.apiName}&property=${attributeName}&`,
      this.$schemaScope
    );

    const [res, err] = await this.client.get<attribute>(url);
    if (err) {
      err.setMessage(
        `failed to get attribute for ${attributeName}: ${err.message}`
      );
      throw err;
    }

    return res;
  }

  /**
   * Create a new attribute for the object of a project
   *
   * @param attributeName Name of the attribute
   * @param type Type of the attribute. Use the {@link AttributeType | AttributeType} enum or "string" for string type, "number" for number type and "datetime" for a datetime type, "richtext" for rich text type, "file" for file type, "boolean" for boolean type
   * @param positionBefore The apiName of the property before which the newly created property is placed
   */
  public async newAttribute(
    attributeName: string,
    type?: string | AttributeType,
    positionBefore?: string
  ): Promise<Attribute> {
    const url = environment.adminHost + '/api/v1/property';

    const reqProperty = {
      $object: this.apiName,
      name: attributeName,
      type: this.getTypeByName(type),
      nextProperty: positionBefore,
    };

    const [res, err] = await this.client.put<Attribute>(url, reqProperty);
    if (err) {
      err.setMessage(`failed to create new attribute: ${err.message}`);
      throw err;
    }

    return res;
  }

  /**
   * Delete a attribute for the object of a project
   *
   * @param attributeName Name of the attribute
   */
  public async deleteAttribute(attributeName: string): Promise<void> {
    const url = environment.adminHost + '/api/v1/property';

    const reqProperty = {
      $object: this.apiName,
      name: attributeName,
    };

    const [, err] = await this.client.delete<Attribute>(url, reqProperty);
    if (err) {
      err.setMessage(
        `failed to delete attribute: ${attributeName}: ${err.message}`
      );
      throw err;
    }
  }

  /**
   * Update an attribute for an object of a project
   *
   * @param property The desired state of the attribute. $qid is required in the object
   *
   */
  public async updateAttribute<attribute>(
    property: Attribute
  ): Promise<attribute> {
    const url = environment.adminHost + '/api/v1/property';

    if (!property.$qid) {
      throw new Error(`$qid is not provided in the request object`);
    }

    const reqProperty = {
      $object: this.apiName,
      $qid: property.$qid,
      name: property.name,
      nextProperty: property.nextProperty,
      apiName: property.apiName,
    };

    const [res, err] = await this.client.put<attribute>(url, reqProperty);
    if (err) {
      err.setMessage(
        `failed to update attribute: ${property.name}: ${err.message}`
      );
      throw err;
    }

    return res;
  }

  /**
   * Rename the object
   * @param newName
   */
  public async rename(newName: string): Promise<StructuredObject> {
    const url = environment.adminHost + '/api/v1/object';

    const reqobject = {
      $qid: this.$qid,
      name: newName,
    };

    const [resp, err] = await this.client.put<StructuredObject>(url, reqobject);
    if (err) {
      err.setMessage(`failed to rename structured object: ${err.message}`);
      throw err;
    }

    return resp;
  }

  /**
   * Update the key property of the object.
   * If a attribute by the given name already exists, the attribute will be marked as key attribute.
   * If the attribute by the given name doesnot exists, a new attribute will be created and marked as key attribute.
   * If instances for the object already exist, key property for the object cannot be updated.
   * @param attributeName
   */
  public async updateKeyAttribute(
    attributeName: string
  ): Promise<StructuredObject> {
    const url = environment.adminHost + '/api/v1/object';

    const reqobject = {
      $qid: this.$qid,
      keyProperty: attributeName,
    };

    const [resp, err] = await this.client.put<StructuredObject>(url, reqobject);
    if (err) {
      err.setMessage(`failed to update key property of object: ${err.message}`);
      throw err;
    }

    return resp;
  }

  /**
   * Update the access of the object.
   */
  public async updateAccess(access: Access): Promise<StructuredObject> {
    const url = environment.adminHost + '/api/v1/object';

    const reqobject = {
      $qid: this.$qid,
      access: access,
    };

    const [resp, err] = await this.client.put<StructuredObject>(url, reqobject);
    if (err) {
      err.setMessage(`failed to update access of object: ${err.message}`);
      throw err;
    }

    return resp;
  }

  /**
   * Add translation column for an existing structured data object column
   * @param langAttributes: indexed type. pass key value pair for language and corresponding column name (see example below)
   * @param parent: api name of column for which translation column is being created
   * Example
   * ```js
   * //first create column for which translation has to be added
   * const col = await object.newAttribute('col name')
   *
   * let langAttr = {
   * 'fr':'french column name',
   * 'nl':'dutch column name'
   * }
   *
   * const res = await object.addTranslationAttribute(langAttr, col.apiName)
   * ```
   * This will create 2 language columns, each for french and dutch language.
   * @returns Promise<Attribute[]>
   */
  public async addTranslationAttribute(
    langAttributes: languageAttributes,
    parent: string
  ): Promise<Attribute[]> {
    const resAttributes: Attribute[] = [];
    if (langAttributes == null) {
      return [];
    }
    for (const [language, columnName] of Object.entries(langAttributes)) {
      const reqBody = {
        $object: this.apiName,
        $schemaScope: this.$schemaScope,
        name: columnName,
        parent: parent,
        language: language,
        type: this.getTypeByName('string'),
      };
      const url = environment.adminHost + '/api/v1/property';
      const [resp, err] = await this.client.put<Attribute>(url, reqBody);
      if (err) {
        err.setMessage(
          `failed to add translation attribute ${columnName}: ${err.message}`
        );
      }
      if (resp) {
        resAttributes.push(resp);
      }
    }
    return resAttributes;
  }

  private getTypeByName(type?: string): number {
    switch (type?.toLowerCase()) {
      case 'number':
        return 2;
      case 'datetime':
        return 3;
      case 'richtext':
        return 4;
      case 'file':
        return 5;
      case 'boolean':
        return 6;
      default:
        return 1;
    }
  }

  /**
   * Get URL
   * @internal
   */
  public getURL(url: string, schemaScope?: string): string {
    if (this._useCaching) {
      return environment.cachingHost + url + `schemaScope=${schemaScope}`;
    }
    return environment.adminHost + '/api/v1' + url;
  }
}

interface Attribute {
  $schemaScope: string;
  $object: string;
  $qid: string;
  name: string;
  apiName: string;
  type: number;
  nextProperty: string;
  parent: string;
  language: string;
}

export interface languageAttributes {
  [language: string]: string;
}

/**
 * Types of attributes
 */
export enum AttributeType {
  String = 'string',
  Number = 'number',
  Datetime = 'datetime',
  Richtext = 'richtext',
  File = 'file',
  Boolean = 'boolean',
}
