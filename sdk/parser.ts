// deno-lint-ignore-file
export class Parser {

  static parseSpecialTypes(data:any) {
    let singleInstance = false;
    if (!(data instanceof Array)) {
      singleInstance = true;
      data = [data];
    }
    data.forEach((instance:any) => {
      for (const prop in instance) {
        if (prop.startsWith('$')) {
          continue;
        }
        if (instance[`$${prop}Type`]) {
          switch (instance[`$${prop}Type`]) {
            case 'dateTime':
              instance[prop] = new Date(instance[prop]);
              break;
            default:
              break;
          }
        }
      }
    });

    return singleInstance ? data[0] : data;
  }
}
