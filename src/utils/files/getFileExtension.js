// Returns file extension from given file name
// getFileExtension("IMG_0027.JPG")
//   => "JPG"
export default function getFileExtension(filename) {
  // https://stackoverflow.com/questions/680929/how-to-extract-extension-from-filename-string-in-javascript
  const re = /(?:\.([^.]+))?$/;
  return re.exec(filename)[1];
}
