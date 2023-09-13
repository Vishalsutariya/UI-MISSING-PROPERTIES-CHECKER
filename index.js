import express from 'express';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import cors from 'cors';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

const repoOwner = 'QQyrus';
const repoName = 'ui-configuration';
var accessToken = '';

// Define the base folder and the folders to compare
const baseFolder = 'stg-ui-config';
// const foldersToCompare = ['ccep-ui-config'
//   , 'cleco-ui-config', 'johndeere-ui-config', 'monument-ui-config', 'prod-ui-config', 'qyrus-ui-config',
//   'qyrus-uk-ui-config', 'rccd-ui-config', 'shawbrook-ui-config', 'sia-ui-config', 'truist-ui-config', 'tsb-ui-config', 'uat-ui-config',
//   'unum-ui-config', 'valley-ui-config', 'vitas-ui-config', 'wm-ui-config']; // Add more folders as needed

app.get('/', (req, res) => {
  res.send('Welcome to the API for comparing and adding missing properties.');
});

app.post('/compare-and-add', async (req, res) => {

  accessToken = req.body.githubToken;
  
  const foldersToCompare = await fetchEnvironmentFolders();
  // console.log('Folders:', folders);

  try {
    const baseContent = await fetchEnvironmentFileContent(`${baseFolder}/environment.prod.ts`);
    if (!baseContent) {
      console.error(`Failed to fetch ${baseFolder}/environment.prod.ts`);
      return;
    }

    console.log("extracting base properties...")
    const baseProperties = extractProperties(baseContent);
    console.log("base properties extracted...")

    let missingPropertiesObject = {};
    for (const folder of foldersToCompare) {
      const contentToCompare = await fetchEnvironmentFileContent(`${folder}/environment.prod.ts`);

      if (!contentToCompare) {
        console.error(`Failed to fetch ${folder}/environment.prod.ts`);
        continue;
      }

      const propertiesToCompare = extractProperties(contentToCompare);

      console.log(`Missing properties in ${folder}:`);
      const basePropertiesSet = new Set(baseProperties)
      const propertiesToCompareSet = new Set(propertiesToCompare)

      const missingProperties = [];
      basePropertiesSet.forEach(item => {
        if (!propertiesToCompareSet.has(item)) {
          missingProperties.push(item);
        }
      });
      // const missingProperties = baseProperties.filter(prop => !propertiesToCompare.includes(prop));
      missingProperties.forEach(prop => console.log(prop));

      if (missingProperties.length > 0) missingPropertiesObject[folder] = missingProperties;
      console.log('-----------------------');
    }
    res.status(200).json(missingPropertiesObject);
  }
  catch (error) {
    console.log(error);
    res.status(500).json({ error: 'An error occurred while fetching the missing properties.' });
  }


  // if (missingProperties.length > 0) {
  //     await addMissingProperties(folder, missingProperties);
  //     await commitChanges(folder);
  //     res.status(200).json({ message: 'Missing properties added and changes committed.' });
  // } else {
  //     res.status(200).json({ message: 'No missing properties found.' });
  // }
});

async function fetchEnvironmentFolders(){
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents`;
  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const environmentFolders = data.filter(item => item.type === 'dir').map(item => item.name);
      console.log('Folders:', environmentFolders);
      return environmentFolders;
    } else {
      throw new Error(`Failed to fetch environement folders`);
    }
  } catch (error) {
    console.error(error);
    return error;
  }
}

async function fetchEnvironmentFileContent(filePath) {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const fileContentResponse = await fetch(data.download_url);
      const fileContent = await fileContentResponse.text();
      return fileContent;
    } else {
      throw new Error(`Failed to fetch ${filePath}`);
    }
  } catch (error) {
    console.error(error);
    return error;
  }
}

function extractProperties(fileContent) {
  // Extract property keys using a regular expression
  const propertyPattern = /^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)[ \t]*:[ \t]*(.*)/gm;
  const matches = fileContent.match(propertyPattern);
  if (matches) {
    return matches.map(match => match.trim().split(':')[0].trim());
  }
  console.log("match:", matches)
  return matches || [];
}

app.post('/add-missing-properties', async (req, res) => {
  const missingProperties = req.body.missingProperties;
  accessToken = req.body.githubToken;

  let commitLinkArray = [];

  const promises = missingProperties.map(async (prop) => {
    const contentOnTargetFolder = await fetchEnvironmentFileContent(`${prop.environment}/environment.prod.ts`);

    if (!contentOnTargetFolder) {
      console.error(`Failed to fetch ${prop.environment}/environment.prod.ts`);
      return;
    }

    const commitLink = await addMissingPropertiesToFile(accessToken, prop.environment, contentOnTargetFolder, prop.values);
    // commitLinkArray["Added missing properties for " + prop.environment] = commitLink;
    commitLinkArray.push({ environment: prop.environment, commitLink });
  })

  await Promise.all(promises);

  console.log("commitLinkArray:", commitLinkArray);
  await res.status(200).json(commitLinkArray);
});


async function addMissingPropertiesToFile(githubToken, folder, contentOnTargetFolder, missingProperties) {
  // const lines = contentOnTargetFolder.split('\n');

  // // console.log("Lines", lines);
  // // Add the missing properties to the content
  // const updatedContent = lines.map(line => {
  //   if (line.includes('export const environment = {')) {
  //     return [...line, ...missingProperties].join(',\n');
  //   }
  //   return line;
  // }).join('\n');

  // Convert the object to an array
  var propertyArray = Object.keys(missingProperties).map(function (key) {
    return {
      key: key,
      value: missingProperties[key]
    };
  });

  // Now propertyArray contains the array of objects
  // console.log("Property Array", propertyArray);
  // console.log("Content on Target Folder", contentOnTargetFolder);

  const insertionPoint = contentOnTargetFolder.lastIndexOf('}');

  if (insertionPoint !== -1) {
    let propertiesToAdd = propertyArray.map(prop => `  ${prop.key}: '${prop.value}',`).join('\n');

    // Check if there's already a comma at the end of the initial data
    const initialData = contentOnTargetFolder.slice(0, insertionPoint).trim();
    if (initialData.charAt(initialData.length - 1) === ',') {
      propertiesToAdd = '\n' + propertiesToAdd // Remove leading spaces on each line
    } else {
      propertiesToAdd = ',\n' + propertiesToAdd; // Add a comma and a new line before properties
    }

    contentOnTargetFolder =
      initialData + propertiesToAdd + '\n' + contentOnTargetFolder.slice(insertionPoint).trim();
  }



  // console.log('Added missing properties: ', contentOnTargetFolder);

  const commitURL = await commitChanges(githubToken, folder, contentOnTargetFolder);
  return commitURL;
}

async function commitChanges(githubToken, folder, content) {
  const octokit = new Octokit({
    auth: githubToken // Replace with your GitHub Personal Access Token
  });

  const commitMessage = 'Added Missing Properties';

  try {

    // Fetch the current SHA-1 hash of the file
    const fileInfo = await octokit.rest.repos.getContent({
      owner: 'QQyrus', // Replace with your GitHub username
      repo: 'ui-configuration',
      path: `${folder}/environment.prod.ts`
    });

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: 'QQyrus', // Replace with your GitHub username
      repo: 'ui-configuration',
      path: `${folder}/environment.prod.ts`,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      sha: fileInfo.data.sha // Provide the current SHA-1 hash of the file
    });

    console.log(`Changes committed to ${folder}/environment.prod.ts: ${response.data.commit.html_url}`);
    return response.data.commit.html_url;
  } catch (error) {
    console.error(`Failed to commit changes to ${folder}/environment.prod.ts`, error);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
