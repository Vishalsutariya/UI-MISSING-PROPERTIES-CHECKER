import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';

const repoOwner = 'QQyrus';
const repoName = 'ui-configuration';
const accessToken = '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';

// Define the base folder and the folders to compare
const baseFolder = 'stg-ui-config';
const foldersToCompare = ['prod-ui-config']; // Add more folders as needed

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

async function compareEnvironments() {
  const baseContent = await fetchEnvironmentFileContent(`${baseFolder}/environment.prod.ts`);

  if (!baseContent) {
    console.error(`Failed to fetch ${baseFolder}/environment.prod.ts`);
    return;
  }

  for (const folder of foldersToCompare) {
    const contentToCompare = await fetchEnvironmentFileContent(`${folder}/environment.prod.ts`);

    if (!contentToCompare) {
      console.error(`Failed to fetch ${folder}/environment.prod.ts`);
      continue;
    }

    console.log("extracting base properties...")
    const baseProperties = extractProperties(baseContent);
    console.log("base properties extracted...")


    console.log("extracting target properties...")
    const propertiesToCompare = extractProperties(contentToCompare);
    console.log("target properties extracted...")

    console.log('-----------------------');

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

    if (missingProperties.length > 0) {
      await addMissingPropertiesToFile(folder, contentToCompare, missingProperties);
    } else {
      console.log(`No missing properties in ${folder}`);
    }

    console.log('-----------------------');
  }
}

function extractProperties(fileContent) {
  // Extract property keys using a regular expression
  const propertyPattern = /^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)[ \t]*:[ \t]*(.*)/gm;
  const matches = fileContent.match(propertyPattern);
  if (matches) {
    return matches.map(match => match.trim().split(':')[0].trim());
  }
  console.log("match:",matches)
  return matches || [];
}

async function addMissingPropertiesToFile(folder, contentOnTargetFolder, missingProperties){
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

compareEnvironments();
