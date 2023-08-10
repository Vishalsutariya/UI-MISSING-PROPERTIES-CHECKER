import fetch from 'node-fetch';


const repoOwner = 'QQyrus';
const repoName = 'ui-configuration';
const accessToken = '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';

// Define the base folder and the folders to compare
const baseFolder = 'stg-ui-config';
const foldersToCompare = ['prod-ui-config', 'qyrus-ui-config']; // Add more folders as needed

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
      throw new Error(`Failed to fetch ${filePath}/environment.prod.ts`);
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

compareEnvironments();
