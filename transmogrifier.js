const fs = require('fs');
const csv = require('csv-parser');
const xml2js = require('xml-js');
const Handlebars = require('handlebars');

const csvFilePath = 'src/metadata-raw.csv';
const kmlFilePath = 'src/landuse-raw.kml';
const templatePath = 'src/template.html';
const outputKmlFilePath = 'dist/landuse-example.kml';
const outputTemplatePath = 'dist/template-example.html';

Handlebars.registerHelper('nl2br', function(text) {
  const escapedText = Handlebars.Utils.escapeExpression(text);
  return new Handlebars.SafeString(escapedText.replace(/(\r\n|\n|\r)/gm, '<br>'));
});

// Read CSV data into memory
let csvData = [];
fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    csvData.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');

    // Load and parse KML file
    fs.readFile(kmlFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      const kmlObj = xml2js.xml2js(data, {compact: true, spaces: 4});
      const placemarks = kmlObj.kml.Document.Folder.Placemark;

      // Update Placemark descriptions based on CSV data
      placemarks.forEach(placemark => {
        const id = placemark._attributes.id;
        const matchingRow = csvData.find(row => row['Placemark ID'] === id);
        if (matchingRow) {
          placemark.description = {_cdata: formatDescriptionAsTable(matchingRow)};
          placemark.styleUrl = {_text: formatStyle(matchingRow)};
        }
        else {
          placemark.description = {_cdata: formatNoDataDescription()};
        }
      });

      // Convert back to XML and save
      const updatedKml = xml2js.js2xml(kmlObj, {compact: true, spaces: 4});
      fs.writeFile(outputKmlFilePath, updatedKml, err => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('KML file has been updated');
      });
    });
  });

function formatDescriptionAsTable(row) {

  console.log(row);

  // Compile the source template
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiledTemplate = Handlebars.compile(source);

  // Execute the compiled template function with the row data
  const result = compiledTemplate(row);

  fs.writeFileSync(outputTemplatePath, result, err => {
      if (err) {
          console.error(err);
          return;
      }
      console.log('Example markup file updated');
  });

  return result;
}

function formatStyle(row) {

  const type = row['Proposed Residential Group'].trim();
  const style = "#PolyStyle" + type;
  console.log(style);

  return style;
}

function formatNoDataDescription() {
  const message = `
    <div>
      <p>
      The area you have selected is a non-residential Land Use District. Some small changes to non-residential districts are being proposed to increase housing opportunities in these districts. These include, but are not limited to:
      </p>
      <ul>
        <li>Changes to allowable uses based on the new and amended definitions of different housing types;</li>
        <li>Including the requirements that all homes must have a minimum of 5 m2 of Outdoor Amenity Area;</li>
        <li>Limiting the maximum number of bedrooms to six (6) per home;</li>
        <li>Removing some unnecessary informational clauses; and,</li>
        <li>Removing some district specific restrictions on housing (e.g. maximum home size, minimum bedroom size, additional reporting, location within a building).</li>
      </ul>
    </div>
  `;
  return message;
}
