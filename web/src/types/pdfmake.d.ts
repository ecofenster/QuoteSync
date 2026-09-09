declare module "pdfmake/build/pdfmake" {
  type PdfBlobCallback = (blob: Blob) => void;
  type CreatedPdf = { getBlob: (callback: PdfBlobCallback) => void };
  const pdfMake: {
    addVirtualFileSystem: (fonts: Record<string, string>) => void;
    createPdf: (definition: unknown) => CreatedPdf;
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const fonts: Record<string, string>;
  export default fonts;
}
