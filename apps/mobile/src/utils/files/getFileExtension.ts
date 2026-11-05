// Returns file extension from given file name
// getFileExtension("IMG_0027.JPG")
//   => "JPG"
export default function getFileExtension(filename: string): string | undefined {
  // https://stackoverflow.com/questions/680929/how-to-extract-extension-from-filename-string-in-javascript
  const re = /(?:\.([^.]+))?$/;
  // The pattern matches every string (its group is optional), so exec never returns null.
  return re.exec(filename)![1];
}
