declare module 'cloudinary-angular' {
  export class Cloudinary {
    constructor(config: { cloud_name: string });
    url(publicId: string, transformations?: any): string;
  }
}






