import express from 'express';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const repoOwner = 'QQyrus';
const repoName = 'ui-configuration';
const accessToken = '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';

// Define the base folder and the folders to compare
const baseFolder = 'stg-ui-config';
const foldersToCompare = ['ccep-ui-config', 'cleco-ui-config', 'johndeere-ui-config', 'monument-ui-config', 'prod-ui-config', 'qyrus-ui-config',
  'qyrus-uk-ui-config', 'rccd-ui-config', 'shawbrook-ui-config', 'sia-ui-config', 'truist-ui-config', 'tsb-ui-config', 'uat-ui-config',
  'unum-ui-config', 'valley-ui-config', 'vitas-ui-config', 'wm-ui-config']; // Add more folders as needed

app.get('/', (req, res) => {
  res.send('Welcome to the API for comparing and adding missing properties.');
});

app.get('/compare-and-add', async (req, res) => {

  const baseContent = await fetchEnvironmentFileContent(`${baseFolder}/environment.prod.ts`);
  if (!baseContent) {
    console.error(`Failed to fetch ${baseFolder}/environment.prod.ts`);
    return;
  }

  console.log("extracting base properties...")
  const baseProperties = extractProperties(baseContent);
  console.log("base properties extracted...")

  let missingPropertiesObject = [];
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

    const temp = {
      folder: missingProperties
    }

    if(missingProperties.length>0) missingPropertiesObject.push(temp);

    console.log('-----------------------');
  }

  if (missingPropertiesObject.length > 0) {
    res.status(200).json(missingPropertiesObject);
  } else {
    res.status(200).json(`No missing properties found`);
  }


  // if (missingProperties.length > 0) {
  //     await addMissingProperties(folder, missingProperties);
  //     await commitChanges(folder);
  //     res.status(200).json({ message: 'Missing properties added and changes committed.' });
  // } else {
  //     res.status(200).json({ message: 'No missing properties found.' });
  // }
});

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
    return null;
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

async function addMissingPropertiesToFile(folder, contentOnTargetFolder, missingProperties) {
  // const lines = contentOnTargetFolder.split('\n');

  // // console.log("Lines", lines);
  // // Add the missing properties to the content
  // const updatedContent = lines.map(line => {
  //   if (line.includes('export const environment = {')) {
  //     return [...line, ...missingProperties].join(',\n');
  //   }
  //   return line;
  // }).join('\n');

  const insertionPoint = contentOnTargetFolder.lastIndexOf('}');
  if (insertionPoint !== -1) {
    const propertiesToAdd = missingProperties.map(prop => `  ${prop}: 'NEW_VALUE',`).join('\n');
    contentOnTargetFolder = contentOnTargetFolder.slice(0, insertionPoint) + propertiesToAdd + contentOnTargetFolder.slice(insertionPoint);
  }

  // console.log('Added missing properties: ', contentOnTargetFolder);

  await commitChanges(folder, contentOnTargetFolder);
}

async function commitChanges(folder, content) {
  const octokit = new Octokit({
    auth: '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' // Replace with your GitHub Personal Access Token
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
  } catch (error) {
    console.error(`Failed to commit changes to ${folder}/environment.prod.ts`, error);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
